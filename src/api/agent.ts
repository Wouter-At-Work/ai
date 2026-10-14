import { parsePatchFiles } from "@pierre/diffs";
import { queryOptions } from "@tanstack/react-query";
import type { SessionInfo, Submission } from "../../shared/agent-review";

const BASE = "/__visual-review/sessions";

async function request(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(`${BASE}/${path}`, init);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `${response.status} ${response.statusText}`);
  }
  return response;
}

export const sessionQuery = (id: string) =>
  queryOptions({
    queryKey: ["session", id],
    queryFn: async () => (await request(id)).json() as Promise<SessionInfo>,
    staleTime: 5_000,
  });

export const localDiffQuery = (id: string) =>
  queryOptions({
    queryKey: ["localDiff", id],
    queryFn: async () => {
      const patch = await (await request(`${id}/diff`)).text();
      return parsePatchFiles(patch, `local-${id}-${Date.now()}`).flatMap((parsed) => parsed.files);
    },
    staleTime: Infinity,
  });

export async function localFile(id: string, side: "old" | "new", path: string) {
  const query = new URLSearchParams({ side, path });
  return (await request(`${id}/file?${query}`)).text();
}

export async function submitSession(id: string, submission: Submission) {
  await request(`${id}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(submission),
  });
}
