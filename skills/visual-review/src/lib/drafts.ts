import { useEffect } from "react";
import type { SessionInfo } from "../../shared/agent-review";
import type { Draft } from "./review";
import { useStoredState } from "./storage";

/** Locally persisted review drafts for one review target, shared by every component using the key. */
export function useDrafts(storageKey: string) {
  const [drafts, setDrafts] = useStoredState<Draft[]>(`drafts:${storageKey}`, []);
  return {
    drafts,
    saveDraft: (draft: Omit<Draft, "id"> & { id?: string }) =>
      setDrafts((current) => {
        const withId = { ...draft, id: draft.id ?? crypto.randomUUID() };
        return current.some((d) => d.id === withId.id)
          ? current.map((d) => (d.id === withId.id ? withId : d))
          : [...current, withId];
      }),
    discardDraft: (id: string) => setDrafts((current) => current.filter((d) => d.id !== id)),
    clearDrafts: () => setDrafts(() => []),
  };
}

/**
 * Adds the comments the agent drafted for a session to the reviewer's drafts, once per session,
 * so a discarded one stays discarded after a reload.
 * @example useAgentDrafts(session.data, "local:app:main")
 */
export function useAgentDrafts(session: SessionInfo | undefined, storageKey: string) {
  const [seeded, setSeeded] = useStoredState<boolean>(`agentDrafts:${session?.id}`, false);
  const [, setDrafts] = useStoredState<Draft[]>(`drafts:${storageKey}`, []);
  const incoming = session?.status === "open" ? session.drafts : undefined;

  useEffect(() => {
    if (seeded || !session || !incoming?.length) return;
    setDrafts((current) => [
      ...current,
      ...incoming.map(({ body, path, side, line, startLine }) => ({
        id: crypto.randomUUID(),
        body,
        fromAgent: true,
        anchor: path ? { path, side: side ?? "additions", line: line ?? 0, startLine } : undefined,
      })),
    ]);
    setSeeded(() => true);
  }, [seeded, session?.id, incoming]);
}
