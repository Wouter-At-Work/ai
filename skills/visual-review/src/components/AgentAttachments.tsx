import { Marked } from "marked";
import { useEffect, useRef, useState } from "react";
import type { SessionInfo } from "../../shared/agent-review";
import { useStoredState } from "../lib/storage";

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Raw HTML in the description is shown as text, and only plain link schemes become links.
const markdown = new Marked({
  gfm: true,
  renderer: {
    html: ({ text }) => escapeHtml(text),
    link({ href, tokens }) {
      const text = this.parser.parseInline(tokens);
      return /^(https?:|mailto:|#|\/)/i.test(href)
        ? `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${text}</a>`
        : text;
    },
  },
});

/**
 * The agent's draft PR description, with the reviewer's edits kept per session in localStorage.
 * `edited` is the text to send back, or undefined when the reviewer left the draft alone.
 * @example const { text, edited } = useDraftDescription(session) // edited → undefined until changed
 */
export function useDraftDescription(session: SessionInfo | undefined) {
  const original = session?.description ?? "";
  const [stored, setStored] = useStoredState<string | null>(`description:${session?.id}`, null);
  const text = stored ?? original;
  return {
    text,
    edited: stored !== null && stored.trim() !== original.trim() ? stored : undefined,
    setText: (next: string) => setStored(() => next),
    reset: () => setStored(() => null),
  };
}

interface LightboxProps {
  sessionId: string;
  shots: { caption: string }[];
  index: number | null;
  onChange(index: number | null): void;
}

const screenshotUrl = (sessionId: string, index: number) =>
  `/__visual-review/sessions/${sessionId}/screenshots/${index}`;

/** Full-size screenshot viewer in a modal dialog: arrows step through, Esc or a backdrop click closes. */
function Lightbox({ sessionId, shots, index, onChange }: LightboxProps) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (index === null) dialog.current?.close();
    else if (!dialog.current?.open) dialog.current?.showModal();
  }, [index]);

  const step = (delta: number) =>
    index !== null && onChange((index + delta + shots.length) % shots.length);
  const shot = index === null ? undefined : shots[index];

  return (
    <dialog
      ref={dialog}
      className="lightbox"
      onClose={() => onChange(null)}
      onClick={(event) => event.target === event.currentTarget && dialog.current?.close()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "ArrowLeft") step(-1);
        else if (event.key === "ArrowRight") step(1);
      }}
    >
      {index !== null && (
        <>
          <img src={screenshotUrl(sessionId, index)} alt={shot?.caption || `Screenshot ${index + 1}`} />
          <div className="lightbox-bar">
            {shots.length > 1 && (
              <button type="button" className="button small" onClick={() => step(-1)} title="Previous (←)">
                ←
              </button>
            )}
            <span className="lightbox-caption">
              {shot?.caption}
              {shots.length > 1 && (
                <span className="muted">
                  {" "}
                  {index + 1} / {shots.length}
                </span>
              )}
            </span>
            {shots.length > 1 && (
              <button type="button" className="button small" onClick={() => step(1)} title="Next (→)">
                →
              </button>
            )}
            <button type="button" className="button small" onClick={() => dialog.current?.close()} title="Close (Esc)">
              Close
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}

interface AgentAttachmentsProps {
  session: SessionInfo;
  description: ReturnType<typeof useDraftDescription>;
}

/** The draft PR description and screenshots the agent attached to its review session. */
export function AgentAttachments({ session, description }: AgentAttachmentsProps) {
  const [editing, setEditing] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  const shots = session.screenshots ?? [];
  const open = session.status === "open";

  return (
    <>
      {session.description && (
        <section className="agent-description">
          <div className="section-head">
            <h2 className="section-title">
              Draft PR description{description.edited !== undefined && " · edited"}
            </h2>
            {open && (
              <span className="section-actions">
                {description.edited !== undefined && (
                  <button type="button" className="button ghost small" onClick={description.reset}>
                    Reset
                  </button>
                )}
                <button type="button" className="button small" onClick={() => setEditing(!editing)}>
                  {editing ? "Preview" : "Edit"}
                </button>
              </span>
            )}
          </div>
          {editing && open ? (
            <textarea
              className="description-editor"
              rows={Math.min(30, Math.max(8, description.text.split("\n").length + 1))}
              value={description.text}
              onChange={(event) => description.setText(event.target.value)}
            />
          ) : (
            <div
              className="markdown description-card"
              dangerouslySetInnerHTML={{ __html: markdown.parse(description.text) as string }}
            />
          )}
          {open && (
            <p className="muted small">
              {description.edited !== undefined
                ? "Your edited version goes back to the agent with the review."
                : "Edit it here and the agent gets your version with the review."}
            </p>
          )}
        </section>
      )}

      {shots.length > 0 && (
        <section className="agent-screenshots">
          <h2 className="section-title">Screenshots ({shots.length})</h2>
          <div className="screenshot-grid">
            {shots.map((shot, index) => (
              <figure key={index} className="screenshot">
                <button type="button" onClick={() => setViewing(index)} title="View full size">
                  <img
                    src={screenshotUrl(session.id, index)}
                    alt={shot.caption || `Screenshot ${index + 1}`}
                    loading="lazy"
                  />
                </button>
                {shot.caption && <figcaption>{shot.caption}</figcaption>}
              </figure>
            ))}
          </div>
          <Lightbox sessionId={session.id} shots={shots} index={viewing} onChange={setViewing} />
        </section>
      )}
    </>
  );
}
