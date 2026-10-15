import { parsePatchFiles } from "@pierre/diffs";
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { config } from "../config";
import { bitbucket } from "./bitbucket";
import type { InlinePosition } from "./types";

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: bitbucket.me,
  staleTime: Infinity,
});

export const reposQuery = queryOptions({
  queryKey: ["repos"],
  queryFn: () => (config.repos.length ? config.repos : bitbucket.recentRepos()),
  staleTime: Infinity,
});

export const pullRequestsQuery = (repo: string) =>
  queryOptions({
    queryKey: ["pullRequests", repo],
    queryFn: () => bitbucket.openPullRequests(repo),
  });

export const pullRequestQuery = (repo: string, id: number) =>
  queryOptions({
    queryKey: ["pullRequest", repo, id],
    queryFn: () => bitbucket.pullRequest(repo, id),
  });

export const diffQuery = (repo: string, id: number, sourceHash: string | undefined) =>
  queryOptions({
    queryKey: ["diff", repo, id, sourceHash],
    queryFn: async () => {
      const patch = await bitbucket.diff(repo, id);
      return parsePatchFiles(patch, `${repo}-${id}-${sourceHash}`).flatMap(
        (parsed) => parsed.files,
      );
    },
    staleTime: Infinity,
    enabled: sourceHash !== undefined,
  });

export const mergeBaseQuery = (repo: string, source: string, destination: string) =>
  queryOptions({
    queryKey: ["mergeBase", repo, source, destination],
    queryFn: async () => (await bitbucket.mergeBase(repo, source, destination)).hash,
    staleTime: Infinity,
  });

export const commentsQuery = (repo: string, id: number) =>
  queryOptions({
    queryKey: ["comments", repo, id],
    queryFn: () => bitbucket.comments(repo, id),
  });

export function useAddComment(repo: string, id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { body: string; inline?: InlinePosition; parentId?: number }) =>
      bitbucket.addComment(repo, id, input),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["comments", repo, id] }),
  });
}

export function useResolveComment(repo: string, id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { commentId: number; resolved: boolean }) =>
      bitbucket.resolveComment(repo, id, input.commentId, input.resolved),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["comments", repo, id] }),
  });
}

export function useSetReview(repo: string, id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (state: "approve" | "request-changes" | "none") =>
      bitbucket.setReview(repo, id, state),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["pullRequest", repo, id] });
      queryClient.invalidateQueries({ queryKey: ["pullRequests", repo] });
    },
  });
}
