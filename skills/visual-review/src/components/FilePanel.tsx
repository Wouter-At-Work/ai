import type {
  DiffLineAnnotation,
  FileDiffMetadata,
  FileDiffOptions,
  SelectedLineRange,
} from "@pierre/diffs/react";
import { FileDiff, useStableCallback } from "@pierre/diffs/react";
import type { Anchor, LineNotes } from "../lib/review";
import { lineStats } from "../lib/review";
import { CommentThread, DraftCard } from "./CommentThread";
import { Composer } from "./Composer";
import { useReview } from "./ReviewContext";
import { ChangeIcon, CommentCount } from "./Status";

function LineNotesView({ notes }: { notes: LineNotes }) {
  const review = useReview();
  const composer = notes.composer;
  return (
    <div className="line-notes">
      {notes.threads.map((thread) => (
        <CommentThread key={thread.root.id} thread={thread} drafts={review.drafts} />
      ))}
      {notes.drafts.map((draft) => (
        <DraftCard key={draft.id} draft={draft} />
      ))}
      {composer && <AnchorComposer anchor={composer} />}
    </div>
  );
}

function AnchorComposer({ anchor }: { anchor: Anchor }) {
  const review = useReview();
  return (
    <div className="thread">
      {anchor.line === 0 && <p className="muted small">Commenting on the whole file</p>}
      {anchor.startLine !== undefined && anchor.startLine !== anchor.line && (
        <p className="muted small">
          Commenting on lines {anchor.startLine}–{anchor.line}
        </p>
      )}
      <Composer
        onDraft={(body) => {
          review.saveDraft({ body, anchor });
          review.closeComposer();
        }}
        onPost={
          review.postNow &&
          (async (body) => {
            await review.postNow?.({ body, anchor });
            review.closeComposer();
          })
        }
        onCancel={review.closeComposer}
      />
    </div>
  );
}

interface FilePanelProps {
  file: FileDiffMetadata;
  index: number;
  annotations: DiffLineAnnotation<LineNotes>[];
  viewed: boolean;
  active: boolean;
  options: FileDiffOptions<LineNotes, undefined>;
  onToggleViewed(): void;
  onComment(range: SelectedLineRange): void;
  onCommentFile(): void;
}

export function FilePanel({
  file,
  index,
  annotations,
  viewed,
  active,
  options,
  onToggleViewed,
  onComment,
  onCommentFile,
}: FilePanelProps) {
  const handleComment = useStableCallback(onComment);
  const stats = lineStats(file);
  const threadCount = annotations.reduce((total, slot) => total + slot.metadata.threads.length, 0);
  // Line 0 holds whole-file comments (and outdated ones); they sit above the diff, even when collapsed.
  const fileNotes = annotations.filter((slot) => slot.lineNumber === 0);
  const lineNotes = annotations.filter((slot) => slot.lineNumber !== 0);

  return (
    <section id={`file-${index}`} className={`file-panel${active ? " active" : ""}`}>
      <header className="file-header">
        <button
          type="button"
          className="collapse-toggle"
          aria-expanded={!viewed}
          onClick={onToggleViewed}
          title={viewed ? "Expand" : "Collapse"}
        >
          {viewed ? "▸" : "▾"}
        </button>
        <ChangeIcon type={file.type} />
        <span className="file-name" title={file.name}>
          {file.prevName && file.prevName !== file.name && (
            <span className="muted">{file.prevName} → </span>
          )}
          {file.name}
        </span>
        <span className="stat-add">+{stats.added}</span>
        <span className="stat-del">−{stats.removed}</span>
        {threadCount > 0 && <CommentCount count={threadCount} />}
        <span className="spacer" />
        <button type="button" className="button small" onClick={onCommentFile} title="Comment on the whole file">
          Comment on file
        </button>
        <label className="viewed-toggle">
          <input type="checkbox" checked={viewed} onChange={onToggleViewed} />
          Viewed
        </label>
      </header>
      {fileNotes.map((slot) => (
        <div key={slot.side} className="file-notes">
          <LineNotesView notes={slot.metadata} />
        </div>
      ))}
      {!viewed && (
        <FileDiff<LineNotes>
          fileDiff={file}
          options={{
            ...options,
            disableFileHeader: true,
            enableGutterUtility: true,
            enableLineSelection: true,
            onGutterUtilityClick: handleComment,
          }}
          lineAnnotations={lineNotes}
          renderAnnotation={(annotation) => <LineNotesView notes={annotation.metadata} />}
        />
      )}
    </section>
  );
}
