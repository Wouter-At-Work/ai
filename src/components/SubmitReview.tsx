import { useRef, useState } from "react";
import type { Draft } from "../lib/review";

export type Verdict = "comment" | "approve" | "request-changes";

interface SubmitReviewProps {
  drafts: Draft[];
  myState: "approved" | "changes_requested" | null;
  onSubmit(input: { verdict: Verdict; summary: string }): Promise<void>;
}

export function SubmitReview({ drafts, myState, onSubmit }: SubmitReviewProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [verdict, setVerdict] = useState<Verdict>("comment");
  const [summary, setSummary] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ verdict, summary });
      setSummary("");
      setVerdict("comment");
      dialog.current?.close();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setSubmitting(false);
    }
  }

  const nothingToSend = verdict === "comment" && drafts.length === 0 && summary.trim() === "";

  return (
    <>
      <button type="button" className="button primary" onClick={() => dialog.current?.showModal()}>
        Finish review{drafts.length > 0 && <span className="badge">{drafts.length}</span>}
      </button>
      <dialog ref={dialog} className="submit-dialog" onKeyDown={(event) => event.stopPropagation()}>
        <h2>Finish your review</h2>
        <p className="muted small">
          {drafts.length === 0
            ? "No draft comments."
            : `${drafts.length} draft comment${drafts.length === 1 ? "" : "s"} will be posted.`}
          {myState === "approved" && " You currently approve this pull request."}
          {myState === "changes_requested" && " You currently request changes."}
        </p>
        <textarea
          rows={4}
          placeholder="Overall comment (optional)"
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
        />
        <fieldset className="verdicts">
          {(
            [
              ["comment", "Comment", "Post your comments without a verdict."],
              ["approve", "Approve", "Approve the pull request."],
              ["request-changes", "Request changes", "Block merging until addressed."],
            ] as const
          ).map(([value, label, hint]) => (
            <label key={value} className="verdict">
              <input
                type="radio"
                name="verdict"
                checked={verdict === value}
                onChange={() => setVerdict(value)}
              />
              <span>
                <strong>{label}</strong>
                <span className="muted small"> — {hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {error && <p className="error-text">{error}</p>}
        <div className="composer-actions">
          <button type="button" className="button ghost" onClick={() => dialog.current?.close()}>
            Cancel
          </button>
          <button
            type="button"
            className="button primary"
            disabled={submitting || nothingToSend}
            onClick={submit}
          >
            {submitting ? "Submitting…" : "Submit review"}
          </button>
        </div>
      </dialog>
    </>
  );
}
