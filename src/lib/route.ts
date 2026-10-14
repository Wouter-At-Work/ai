import { useSyncExternalStore } from "react";

export type Route =
  | { page: "list" }
  | { page: "local"; session: string }
  | { page: "pr"; repo: string; id: number; agentSession?: string };

function parse(hash: string): Route {
  const [path = "", query = ""] = hash.replace(/^#/, "").split("?");
  const local = /^\/local\/([0-9a-f-]{36})$/.exec(path);
  if (local?.[1]) return { page: "local", session: local[1] };

  const match = /^\/(?:([^/]+)\/)?([^/]+)\/(\d+)$/.exec(path);
  if (match?.[2] && match[3]) {
    const name = decodeURIComponent(match[2]);
    const repo = match[1] ? `${decodeURIComponent(match[1])}/${name}` : name;
    const agentSession = new URLSearchParams(query).get("agent") ?? undefined;
    return { page: "pr", repo, id: Number(match[3]), agentSession };
  }
  return { page: "list" };
}

function subscribe(listener: () => void) {
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  return parse(hash);
}

export const prHref = (repo: string, id: number) =>
  `#/${repo.split("/").map(encodeURIComponent).join("/")}/${id}`;
