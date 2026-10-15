import { Marked } from "marked";
import { useState } from "react";
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

interface AgentAttachmentsProps {
  session: SessionInfo;
  description: ReturnType<typeof useDraftDescription>;
}

/** The draft PR description and screenshots the agent attached to its review session. */
export function AgentAttachments({ session, description }: AgentAttachmentsProps) {
  const [editing, setEditing] = useState(false);
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
            {shots.map((shot, index) => {
              const src = `/__visual-review/sessions/${session.id}/screenshots/${index}`;
              return (
                <figure key={src} className="screenshot">
                  <a href={src} target="_blank" rel="noreferrer" title="Open full size">
                    <img src={src} alt={shot.caption || `Screenshot ${index + 1}`} loading="lazy" />
                  </a>
                  {shot.caption && <figcaption>{shot.caption}</figcaption>}
                </figure>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
