import { createContext, use } from "react";
import type { Account } from "../api/types";
import type { Anchor, Draft } from "../lib/review";

export interface ReviewActions {
  me: Account;
  drafts: Draft[];
  saveDraft(draft: Omit<Draft, "id"> & { id?: string }): void;
  discardDraft(id: string): void;
  postNow(input: { body: string; anchor?: Anchor; parentId?: number }): Promise<unknown>;
  resolve(commentId: number, resolved: boolean): void;
  closeComposer(): void;
  isPosting: boolean;
}

export const ReviewContext = createContext<ReviewActions | null>(null);

export function useReview(): ReviewActions {
  const actions = use(ReviewContext);
  if (!actions) throw new Error("useReview outside ReviewContext");
  return actions;
}
