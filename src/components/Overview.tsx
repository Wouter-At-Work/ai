import type { PullRequest } from "../api/types";
import type { Thread } from "../lib/review";
import { CommentThread, DraftCard } from "./CommentThread";
import { Composer } from "./Composer";
import { useReview } from "./ReviewContext";
import { Avatar, ErrorBox, timeAgo } from "./Status";

interface OverviewProps {
  pr: PullRequest;
  threads: Thread[];
  orphanThreads: Thread[];
  commentsError: Error | null;
}

export function Overview({ pr, threads, orphanThreads, commentsError }: OverviewProps) {
  const review = useReview();
  const generalDrafts = review.drafts.filter((draft) => !draft.anchor && !draft.parentId);

  return (
    <section className="overview">
      <div className="overview-author">
        <Avatar account={pr.author} size={24} />
        <strong>{pr.author.display_name}</strong>
        <span className="muted small">opened {timeAgo(pr.created_on)}</span>
      </div>
      {pr.summary?.html ? (
        <div
          className="markdown description"
          // Bitbucket returns its own sanitised rendering of the description's Markdown.
          dangerouslySetInnerHTML={{ __html: pr.summary.html }}
        />
      ) : (
        <p className="muted">No description.</p>
      )}

      {commentsError && <ErrorBox title="Could not load comments" error={commentsError} />}

      {(threads.length > 0 || generalDrafts.length > 0) && (
        <h2 className="section-title">Conversation</h2>
      )}
      {threads.map((thread) => (
        <CommentThread key={thread.root.id} thread={thread} drafts={review.drafts} />
      ))}
      {generalDrafts.map((draft) => (
        <DraftCard key={draft.id} draft={draft} />
      ))}

      {orphanThreads.length > 0 && (
        <>
          <h2 className="section-title">Comments on files no longer in the diff</h2>
          {orphanThreads.map((thread) => (
            <CommentThread key={thread.root.id} thread={thread} drafts={review.drafts} />
          ))}
        </>
      )}

      <Composer
        autoFocus={false}
        placeholder="Comment on the pull request…"
        onDraft={(body) => review.saveDraft({ body })}
        onPost={(body) => review.postNow({ body })}
      />
    </section>
  );
}
