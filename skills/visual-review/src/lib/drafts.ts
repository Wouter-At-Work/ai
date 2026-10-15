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
