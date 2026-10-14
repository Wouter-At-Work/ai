import { config } from "../config";
import type { Account, Comment, Commit, InlinePosition, Paginated, PullRequest } from "./types";

const API = "/api/bb/2.0";

export class BitbucketError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  const url = path.startsWith("/api/bb") ? path : `${API}${path}`;
  const response = await fetch(url, {
    ...init,
    headers: { Accept: "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const text = await response.text();
    let message = text || response.statusText;
    try {
      const body: unknown = JSON.parse(text);
      if (
        typeof body === "object" &&
        body !== null &&
        "error" in body &&
        typeof body.error === "object" &&
        body.error !== null &&
        "message" in body.error &&
        typeof body.error.message === "string"
      ) {
        message = body.error.message;
      }
    } catch {}
    throw new BitbucketError(response.status, message);
  }
  return response;
}

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await request(path, init);
  return response.json() as Promise<T>;
}

function toProxied(next: string): string {
  return next.replace(/^https?:\/\/[^/]+/, "/api/bb");
}

async function all<T>(path: string): Promise<T[]> {
  const values: T[] = [];
  let next: string | undefined = path;
  while (next) {
    const page: Paginated<T> = await json<Paginated<T>>(next);
    values.push(...page.values);
    next = page.next ? toProxied(page.next) : undefined;
  }
  return values;
}

const repoPath = (repo: string) => {
  const [workspace, name] = repo.includes("/") ? repo.split("/") : [config.workspace, repo];
  return `/repositories/${encodeURIComponent(workspace ?? "")}/${encodeURIComponent(name ?? "")}`;
};

const prPath = (repo: string, id: number) => `${repoPath(repo)}/pullrequests/${id}`;

const post = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const bitbucket = {
  me: () => json<Account>("/user"),

  recentRepos: async () => {
    const page = await json<Paginated<{ name: string; slug: string }>>(
      `/repositories/${encodeURIComponent(config.workspace)}?sort=-updated_on&pagelen=15&fields=values.slug,values.name`,
    );
    return page.values.map((repo) => repo.slug);
  },

  openPullRequests: (repo: string) =>
    all<PullRequest>(
      `${repoPath(repo)}/pullrequests?state=OPEN&pagelen=50&fields=%2Bvalues.participants,%2Bvalues.reviewers`,
    ),

  pullRequest: (repo: string, id: number) => json<PullRequest>(prPath(repo, id)),

  diff: async (repo: string, id: number) => {
    const response = await request(prPath(repo, id) + "/diff", {
      headers: { Accept: "text/plain" },
    });
    return response.text();
  },

  mergeBase: (repo: string, a: string, b: string) =>
    json<Commit>(`${repoPath(repo)}/merge-base/${a}...${b}`),

  fileAt: async (repo: string, commit: string, path: string) => {
    const encoded = path.split("/").map(encodeURIComponent).join("/");
    const response = await request(`${repoPath(repo)}/src/${commit}/${encoded}`, {
      headers: { Accept: "text/plain" },
    });
    return response.text();
  },

  comments: (repo: string, id: number) =>
    all<Comment>(`${prPath(repo, id)}/comments?pagelen=100`),

  addComment: (
    repo: string,
    id: number,
    input: { body: string; inline?: InlinePosition; parentId?: number },
  ) =>
    json<Comment>(
      `${prPath(repo, id)}/comments`,
      post({
        content: { raw: input.body },
        ...(input.inline ? { inline: input.inline } : {}),
        ...(input.parentId ? { parent: { id: input.parentId } } : {}),
      }),
    ),

  resolveComment: (repo: string, id: number, commentId: number, resolved: boolean) =>
    request(`${prPath(repo, id)}/comments/${commentId}/resolve`, {
      method: resolved ? "POST" : "DELETE",
    }),

  setReview: async (
    repo: string,
    id: number,
    state: "approve" | "request-changes" | "none",
  ) => {
    const clear = (verdict: "approve" | "request-changes") =>
      request(`${prPath(repo, id)}/${verdict}`, { method: "DELETE" }).catch(() => undefined);
    if (state === "none") {
      await Promise.all([clear("approve"), clear("request-changes")]);
      return;
    }
    await clear(state === "approve" ? "request-changes" : "approve");
    await request(`${prPath(repo, id)}/${state}`, { method: "POST" });
  },
};
