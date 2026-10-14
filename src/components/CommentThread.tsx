import { useState } from "react";
import type { Comment } from "../api/types";
import type { Draft, Thread } from "../lib/review";
import { Composer } from "./Composer";
import { useReview } from "./ReviewContext";
import { Avatar, timeAgo } from "./Status";

function CommentBody({ comment }: { comment: Comment }) {
  if (comment.deleted) return <p className="muted small">This comment was deleted.</p>;
  return (
    <div
      className="markdown"
      // Bitbucket returns its own sanitised rendering of the comment's Markdown.
      dangerouslySetInnerHTML={{ __html: comment.content.html }}
    />
  );
}

function CommentItem({ comment }: { comment: Comment }) {
  return (
    <div className="comment">
      <Avatar account={comment.user} size={24} />
      <div className="comment-main">
        <div className="comment-meta">
          <strong>{comment.user.display_name}</strong>
          <span className="muted small" title={comment.created_on}>
            {timeAgo(comment.created_on)}
          </span>
          {comment.pending && <span className="tag">Pending</span>}
        </div>
        <CommentBody comment={comment} />
      </div>
    </div>
  );
}

export function DraftCard({ draft }: { draft: Draft }) {
  const review = useReview();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <Composer
        initial={draft.body}
        onDraft={(body) => {
          review.saveDraft({ ...draft, body });
          setEditing(false);
        }}
        onPost={async (body) => {
          await review.postNow({ body, anchor: draft.anchor, parentId: draft.parentId });
          review.discardDraft(draft.id);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }
  return (
    <div className="comment draft">
      <Avatar account={review.me} size={24} />
      <div className="comment-main">
        <div className="comment-meta">
          <strong>{review.me.display_name}</strong>
          <span className="tag draft-tag">Draft</span>
          {draft.anchor?.startLine !== undefined && (
            <span className="muted small">
              lines {draft.anchor.startLine}–{draft.anchor.line}
            </span>
          )}
          <span className="spacer" />
          <button type="button" className="link-button" onClick={() => setEditing(true)}>
            Edit
          </button>
          <button
            type="button"
            className="link-button danger"
            onClick={() => review.discardDraft(draft.id)}
          >
            Discard
          </button>
        </div>
        <p className="draft-body">{draft.body}</p>
      </div>
    </div>
  );
}

export function CommentThread({ thread, drafts }: { thread: Thread; drafts: Draft[] }) {
  const review = useReview();
  const [replying, setReplying] = useState(false);
  const resolved = Boolean(thread.root.resolution);
  const [expanded, setExpanded] = useState(!resolved);
  const replyDrafts = drafts.filter((draft) => draft.parentId === thread.root.id);
  const outdated = thread.root.inline?.outdated;

  return (
    <div className={`thread${resolved ? " resolved" : ""}`}>
      {(resolved || outdated) && (
        <button type="button" className="thread-banner" onClick={() => setExpanded(!expanded)}>
          {outdated && <span className="tag">Outdated</span>}
          {resolved && <span className="tag ok">Resolved</span>}
          {thread.root.inline && (
            <span className="muted small">
              {thread.root.inline.path}:{thread.root.inline.to ?? thread.root.inline.from}
            </span>
          )}
          <span className="spacer" />
          <span className="muted small">{expanded ? "Hide" : `Show ${1 + thread.replies.length}`}</span>
        </button>
      )}
      {expanded && (
        <>
          <CommentItem comment={thread.root} />
          {thread.replies.map((reply) => (
            <CommentItem key={reply.id} comment={reply} />
          ))}
          {replyDrafts.map((draft) => (
            <DraftCard key={draft.id} draft={draft} />
          ))}
          {replying ? (
            <Composer
              placeholder="Reply…"
              onDraft={(body) => {
                review.saveDraft({ body, parentId: thread.root.id, anchor: undefined });
                setReplying(false);
              }}
              onPost={async (body) => {
                await review.postNow({ body, parentId: thread.root.id });
                setReplying(false);
              }}
              onCancel={() => setReplying(false)}
            />
          ) : (
            <div className="thread-actions">
              <button type="button" className="button small" onClick={() => setReplying(true)}>
                Reply
              </button>
              {!thread.root.deleted && (
                <button
                  type="button"
                  className="button ghost small"
                  onClick={() => review.resolve(thread.root.id, !resolved)}
                >
                  {resolved ? "Reopen" : "Resolve"}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
