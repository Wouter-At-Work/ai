import { useSyncExternalStore } from "react";

export type Route = { page: "list" } | { page: "pr"; repo: string; id: number };

function parse(hash: string): Route {
  const match = /^#\/(?:([^/]+)\/)?([^/]+)\/(\d+)/.exec(hash);
  if (match?.[2] && match[3]) {
    const name = decodeURIComponent(match[2]);
    const repo = match[1] ? `${decodeURIComponent(match[1])}/${name}` : name;
    return { page: "pr", repo, id: Number(match[3]) };
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
