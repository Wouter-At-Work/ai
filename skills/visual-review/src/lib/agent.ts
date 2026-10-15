import type { FileDiffMetadata } from "@pierre/diffs";
import type { AgentComment, AgentReview, AgentVerdict } from "../../shared/agent-review";
import { fileMatches, type Anchor, type Draft } from "./review";

function lineAt(file: FileDiffMetadata, side: Anchor["side"], line: number): string | undefined {
  const lines = side === "additions" ? file.additionLines : file.deletionLines;
  if (!file.isPartial) return lines[line - 1];
  for (const hunk of file.hunks) {
    const start = side === "additions" ? hunk.additionStart : hunk.deletionStart;
    const count = side === "additions" ? hunk.additionCount : hunk.deletionCount;
    const index = side === "additions" ? hunk.additionLineIndex : hunk.deletionLineIndex;
    if (line >= start && line < start + count) return lines[index + line - start];
  }
  return undefined;
}

/**
 * The source lines a comment anchor covers, read from the diff, without trailing newlines.
 * @example codeAt(file, { path: "a.ts", side: "additions", line: 4, startLine: 3 }) // → ["const a = 1;", "const b = 2;"]
 */
export function codeAt(file: FileDiffMetadata, anchor: Anchor): string[] {
  const first = anchor.startLine ?? anchor.line;
  const lines: string[] = [];
  for (let line = first; line <= anchor.line; line++) {
    const text = lineAt(file, anchor.side, line);
    if (text !== undefined) lines.push(text.replace(/\r?\n$/, ""));
  }
  return lines;
}

/**
 * Turns local drafts into the review an agent receives, with each inline comment's code attached.
 * @example buildAgentReview(files, drafts, "changes", "Mostly good") // → { verdict, summary, notes, comments }
 */
export function buildAgentReview(
  files: FileDiffMetadata[],
  drafts: Draft[],
  verdict: AgentVerdict,
  summary: string,
): AgentReview {
  const comments: AgentComment[] = [];
  const notes: string[] = [];
  for (const draft of drafts) {
    if (!draft.anchor) {
      notes.push(draft.parentId ? `(Reply to Bitbucket comment ${draft.parentId}) ${draft.body}` : draft.body);
      continue;
    }
    const anchor = draft.anchor;
    const file = files.find((candidate) => fileMatches(candidate, anchor.path));
    comments.push({
      path: anchor.path,
      side: anchor.side,
      line: anchor.line,
      startLine: anchor.startLine,
      body: draft.body,
      code: file ? codeAt(file, anchor) : undefined,
    });
  }
  const order = new Map(files.map((file, index) => [file.name, index]));
  comments.sort(
    (a, b) =>
      (order.get(a.path) ?? 1e9) - (order.get(b.path) ?? 1e9) ||
      (a.startLine ?? a.line) - (b.startLine ?? b.line),
  );
  return { verdict, summary, notes, comments };
}
