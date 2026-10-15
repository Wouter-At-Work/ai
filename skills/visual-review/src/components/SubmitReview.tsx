import { useRef, useState } from "react";
import type { Draft } from "../lib/review";

export interface VerdictOption<V extends string> {
  value: V;
  label: string;
  hint: string;
}

interface SubmitReviewProps<V extends string> {
  drafts: Draft[];
  verdicts: VerdictOption<V>[];
  title: string;
  buttonLabel: string;
  submitLabel: string;
  note?: string;
  disabled?: boolean;
  allowEmpty?: (verdict: V) => boolean;
  onSubmit(input: { verdict: V; summary: string }): Promise<void>;
  onDismiss?(): Promise<void>;
}

export function SubmitReview<V extends string>({
  drafts,
  verdicts,
  title,
  buttonLabel,
  submitLabel,
  note,
  disabled,
  allowEmpty,
  onSubmit,
  onDismiss,
}: SubmitReviewProps<V>) {
  const dialog = useRef<HTMLDialogElement>(null);
  const firstVerdict = verdicts[0]?.value;
  const [verdict, setVerdict] = useState<V | undefined>(firstVerdict);
  const [summary, setSummary] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setSubmitting(true);
    setError(null);
    try {
      await action();
      setSummary("");
      setVerdict(firstVerdict);
      dialog.current?.close();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setSubmitting(false);
    }
  }

  const empty = drafts.length === 0 && summary.trim() === "";
  const blocked = verdict === undefined || (empty && !allowEmpty?.(verdict));

  return (
    <>
      <button
        type="button"
        className="button primary"
        disabled={disabled}
        onClick={() => dialog.current?.showModal()}
      >
        {buttonLabel}
        {drafts.length > 0 && <span className="badge">{drafts.length}</span>}
      </button>
      <dialog ref={dialog} className="submit-dialog" onKeyDown={(event) => event.stopPropagation()}>
        <h2>{title}</h2>
        <p>
          {drafts.length === 0
            ? "No draft comments."
            : `${drafts.length} draft comment${drafts.length === 1 ? "" : "s"} included.`}
          {note && ` ${note}`}
        </p>
        <textarea
          rows={4}
          placeholder="Overall comment (optional)"
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
        />
        <fieldset className="verdicts">
          {verdicts.map((option) => (
            <label key={option.value} className="verdict">
              <input
                type="radio"
                name="verdict"
                checked={verdict === option.value}
                onChange={() => setVerdict(option.value)}
              />
              <span>
                <strong>{option.label}</strong>
                <span className="muted small"> — {option.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {error && <p className="error-text">{error}</p>}
        <div className="composer-actions">
          {onDismiss && (
            <button
              type="button"
              className="button ghost dismiss"
              disabled={submitting}
              onClick={() => run(onDismiss)}
            >
              Dismiss without review
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="button ghost" onClick={() => dialog.current?.close()}>
            Cancel
          </button>
          <button
            type="button"
            className="button primary"
            disabled={submitting || blocked}
            onClick={() => verdict !== undefined && run(() => onSubmit({ verdict, summary }))}
          >
            {submitting ? "Sending…" : submitLabel}
          </button>
        </div>
      </dialog>
    </>
  );
}
