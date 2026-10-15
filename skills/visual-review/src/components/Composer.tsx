import { useEffect, useRef, useState } from "react";

interface ComposerProps {
  initial?: string;
  placeholder?: string;
  autoFocus?: boolean;
  onDraft?(body: string): void;
  onPost?(body: string): Promise<unknown> | void;
  onCancel?(): void;
  postLabel?: string;
}

export function Composer({
  initial = "",
  placeholder = "Leave a comment — Markdown supported",
  autoFocus = true,
  onDraft,
  onPost,
  onCancel,
  postLabel = "Comment now",
}: ComposerProps) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [body, setBody] = useState(initial);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const empty = body.trim() === "";

  useEffect(() => {
    if (!autoFocus) return;
    const frame = requestAnimationFrame(() => textarea.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [autoFocus]);

  async function post() {
    if (empty || !onPost) return;
    setPosting(true);
    setError(null);
    try {
      await onPost(body);
      setBody("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setPosting(false);
    }
  }

  function draft() {
    if (empty || !onDraft) return;
    onDraft(body);
    setBody("");
  }

  return (
    <div className="composer">
      <textarea
        ref={textarea}
        value={body}
        placeholder={placeholder}
        rows={3}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            if (onDraft) draft();
            else void post();
          }
          if (event.key === "Escape" && onCancel) onCancel();
        }}
      />
      {error && <p className="error-text">{error}</p>}
      <div className="composer-actions">
        {onCancel && (
          <button type="button" className="button ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
        {onPost && (
          <button type="button" className="button" disabled={empty || posting} onClick={post}>
            {posting ? "Posting…" : postLabel}
          </button>
        )}
        {onDraft && (
          <button
            type="button"
            className="button primary"
            disabled={empty}
            onClick={draft}
            title="Ctrl/⌘ + Enter"
          >
            Add to review
          </button>
        )}
      </div>
    </div>
  );
}
