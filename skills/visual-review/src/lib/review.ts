import type { AnnotationSide, DiffLineAnnotation, FileDiffMetadata } from "@pierre/diffs";
import type { Comment, InlinePosition } from "../api/types";

export interface Anchor {
  path: string;
  side: AnnotationSide;
  line: number;
  startLine?: number;
}

export interface Draft {
  id: string;
  body: string;
  anchor?: Anchor;
  parentId?: number;
}

export interface Thread {
  root: Comment;
  replies: Comment[];
}

export interface LineNotes {
  threads: Thread[];
  drafts: Draft[];
  composer?: Anchor;
}

/**
 * Groups flat Bitbucket comments into threads keyed by their root comment.
 * @example buildThreads([root, replyToRoot]) // → [{ root, replies: [replyToRoot] }]
 */
export function buildThreads(comments: Comment[]): Thread[] {
  const byId = new Map(comments.map((comment) => [comment.id, comment]));
  const rootOf = (comment: Comment): Comment => {
    let current = comment;
    while (current.parent) {
      const parent = byId.get(current.parent.id);
      if (!parent) break;
      current = parent;
    }
    return current;
  };

  const threads = new Map<number, Thread>();
  const ordered = [...comments].sort((a, b) => a.created_on.localeCompare(b.created_on));
  for (const comment of ordered) {
    const root = rootOf(comment);
    const thread = threads.get(root.id) ?? { root, replies: [] };
    if (comment !== root) thread.replies.push(comment);
    threads.set(root.id, thread);
  }
  return [...threads.values()].filter(
    (thread) => !thread.root.deleted || thread.replies.some((reply) => !reply.deleted),
  );
}

function isLineInHunks(file: FileDiffMetadata, side: AnnotationSide, line: number) {
  return file.hunks.some((hunk) =>
    side === "additions"
      ? line >= hunk.additionStart && line < hunk.additionStart + hunk.additionCount
      : line >= hunk.deletionStart && line < hunk.deletionStart + hunk.deletionCount,
  );
}

/**
 * Where a thread sits in a file diff; line 0 is the file-level slot above the
 * first hunk, used for outdated comments and lines the diff does not show.
 * @example threadPosition(file, { path: "a.ts", to: 12 }) // → { side: "additions", line: 12 }
 */
export function threadPosition(file: FileDiffMetadata, inline: InlinePosition) {
  const side: AnnotationSide = inline.to != null ? "additions" : "deletions";
  const line = inline.to ?? inline.from ?? 0;
  if (inline.outdated || !isLineInHunks(file, side, line)) {
    return { side: "additions" as const, line: 0 };
  }
  return { side, line };
}

/**
 * Converts an anchor into Bitbucket's inline position for a new comment.
 * @example toInline({ path: "a.ts", side: "deletions", line: 4 }) // → { path: "a.ts", from: 4 }
 */
export function toInline(anchor: Anchor): InlinePosition {
  const ranged = anchor.startLine !== undefined && anchor.startLine !== anchor.line;
  return anchor.side === "additions"
    ? { path: anchor.path, to: anchor.line, ...(ranged ? { start_to: anchor.startLine } : {}) }
    : {
        path: anchor.path,
        from: anchor.line,
        ...(ranged ? { start_from: anchor.startLine } : {}),
      };
}

export const filePath = (file: FileDiffMetadata) => file.name;

export const fileMatches = (file: FileDiffMetadata, path: string) =>
  file.name === path || file.prevName === path;

/**
 * Builds the per-line annotations for one file: existing threads, local
 * drafts and the open composer, merged by side and line.
 * @example fileAnnotations(file, threads, drafts, null) // → [{ side, lineNumber, metadata }]
 */
export function fileAnnotations(
  file: FileDiffMetadata,
  threads: Thread[],
  drafts: Draft[],
  composer: Anchor | null,
): DiffLineAnnotation<LineNotes>[] {
  const slots = new Map<string, DiffLineAnnotation<LineNotes>>();
  const slot = (side: AnnotationSide, line: number) => {
    const key = `${side}:${line}`;
    let existing = slots.get(key);
    if (!existing) {
      existing = { side, lineNumber: line, metadata: { threads: [], drafts: [] } };
      slots.set(key, existing);
    }
    return existing.metadata;
  };

  for (const thread of threads) {
    const inline = thread.root.inline;
    if (!inline || !fileMatches(file, inline.path)) continue;
    const position = threadPosition(file, inline);
    slot(position.side, position.line).threads.push(thread);
  }
  for (const draft of drafts) {
    if (!draft.anchor || draft.parentId || !fileMatches(file, draft.anchor.path)) continue;
    slot(draft.anchor.side, draft.anchor.line).drafts.push(draft);
  }
  if (composer && fileMatches(file, composer.path)) {
    slot(composer.side, composer.line).composer = composer;
  }
  return [...slots.values()];
}

/**
 * Counts added and removed lines in a file diff.
 * @example lineStats(file) // → { added: 12, removed: 3 }
 */
export function lineStats(file: FileDiffMetadata) {
  return file.hunks.reduce(
    (total, hunk) => ({
      added: total.added + hunk.additionLines,
      removed: total.removed + hunk.deletionLines,
    }),
    { added: 0, removed: 0 },
  );
}

/**
 * A stable identity for a file's reviewed content, so "viewed" resets when it changes.
 * @example fileVersion(file) // → "a.ts@3f2c1d0"
 */
export const fileVersion = (file: FileDiffMetadata) =>
  `${file.name}@${file.newObjectId ?? file.prevObjectId ?? file.hunks.length}`;
