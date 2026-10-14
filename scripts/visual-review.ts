#!/usr/bin/env bun
/**
 * Opens the visual review UI on the right Bitbucket pull request.
 *
 *   bun scripts/visual-review.ts              PR for the current branch of the git repo in cwd
 *   bun scripts/visual-review.ts 412          PR #412 of the repo in cwd
 *   bun scripts/visual-review.ts <PR url>     any Bitbucket PR
 *   bun scripts/visual-review.ts --list       the pull request list
 *   bun scripts/visual-review.ts --stop       stop the background server
 *
 * Starts the review server in the background when it is not running yet.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, join } from "node:path";

const appDir = join(dirname(import.meta.path), "..");
const configDir = process.env.VISUAL_REVIEW_CONFIG ?? join(homedir(), ".config", "visual-review");
const envFile = join(configDir, ".env");
const stateDir = join(homedir(), ".cache", "visual-review");
const pidFile = join(stateDir, "server.pid");
const logFile = join(stateDir, "server.log");

function fail(message: string): never {
  console.error(`visual-review: ${message}`);
  process.exit(1);
}

function readEnv(): Record<string, string> {
  if (!existsSync(envFile)) return {};
  const env: Record<string, string> = {};
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match?.[1] && match[2] !== undefined) env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = { ...readEnv(), ...process.env };
const port = Number(env.PORT || 5390);
const base = `http://127.0.0.1:${port}`;

function git(...args: string[]): string | null {
  const result = spawnSync("git", args, { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : null;
}

function repoFromRemote(): { workspace: string; repo: string } | null {
  const remote = git("remote", "get-url", "origin");
  const match = remote && /bitbucket\.org[:/]([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(remote);
  return match?.[1] && match[2] ? { workspace: match[1], repo: match[2] } : null;
}

async function findPrForBranch(workspace: string, repo: string, branch: string) {
  if (!env.BITBUCKET_EMAIL || !env.BITBUCKET_API_TOKEN) return null;
  const query = encodeURIComponent(`source.branch.name="${branch}" AND state="OPEN"`);
  const response = await fetch(
    `${env.BITBUCKET_API_URL || "https://api.bitbucket.org"}/2.0/repositories/${workspace}/${repo}/pullrequests?q=${query}&fields=values.id,values.title`,
    {
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${btoa(`${env.BITBUCKET_EMAIL}:${env.BITBUCKET_API_TOKEN}`)}`,
      },
    },
  );
  if (!response.ok) fail(`Bitbucket answered ${response.status} looking up the PR for ${branch}`);
  const body = (await response.json()) as { values: { id: number; title: string }[] };
  return body.values[0] ?? null;
}

async function isRunning(): Promise<boolean> {
  try {
    const response = await fetch(`${base}/__visual-review`, { signal: AbortSignal.timeout(800) });
    const body = (await response.json()) as { app?: string };
    return body.app === "visual-review";
  } catch {
    return false;
  }
}

async function ensureServer() {
  if (await isRunning()) return;
  mkdirSync(stateDir, { recursive: true });
  if (!existsSync(join(appDir, "node_modules"))) {
    console.log("visual-review: installing dependencies (first run)…");
    const install = spawnSync("bun", ["install"], { cwd: appDir, stdio: "inherit" });
    if (install.status !== 0) fail("bun install failed");
  }
  const log = openSync(logFile, "a");
  const child = spawn("bun", ["run", "dev"], {
    cwd: appDir,
    detached: true,
    stdio: ["ignore", log, log],
    env: { ...process.env, PORT: String(port) },
  });
  child.unref();
  if (child.pid) writeFileSync(pidFile, String(child.pid));
  for (let attempt = 0; attempt < 60; attempt++) {
    await Bun.sleep(250);
    if (await isRunning()) return;
  }
  fail(`the server did not start on port ${port}; see ${logFile}`);
}

function stopServer() {
  if (!existsSync(pidFile)) return console.log("visual-review: no server started by this script");
  const pid = Number(readFileSync(pidFile, "utf8"));
  try {
    process.kill(-pid);
  } catch {
    try {
      process.kill(pid);
    } catch {}
  }
  rmSync(pidFile, { force: true });
  console.log(`visual-review: stopped server (pid ${pid})`);
}

function openBrowser(url: string) {
  const [command, ...args] =
    platform() === "darwin"
      ? ["open", url]
      : platform() === "win32"
        ? ["cmd", "/c", "start", "", url]
        : ["xdg-open", url];
  const child = spawn(command ?? "xdg-open", args, { detached: true, stdio: "ignore" });
  child.on("error", () => console.log(`visual-review: open ${url} in your browser`));
  child.unref();
}

async function main() {
  const arg = process.argv[2];
  if (arg === "--stop") return stopServer();

  if (!env.BITBUCKET_EMAIL || !env.BITBUCKET_API_TOKEN) {
    mkdirSync(configDir, { recursive: true });
    if (!existsSync(envFile)) {
      writeFileSync(envFile, readFileSync(join(appDir, ".env.example"), "utf8"), { mode: 0o600 });
    }
    fail(
      `no Bitbucket credentials yet. Fill in BITBUCKET_EMAIL and BITBUCKET_API_TOKEN in ${envFile} (template written), then run again.`,
    );
  }

  let path = "#/";
  let summary = "pull request list";

  const url = arg && /bitbucket\.org\/([^/]+)\/([^/]+)\/pull-requests\/(\d+)/.exec(arg);
  if (url?.[1] && url[2] && url[3]) {
    path = `#/${url[1]}/${url[2]}/${url[3]}`;
    summary = `${url[1]}/${url[2]} #${url[3]}`;
  } else if (arg !== "--list") {
    const remote = repoFromRemote();
    if (!remote) {
      if (arg) fail("not inside a Bitbucket git repository; pass a full PR URL instead");
    } else if (arg && /^\d+$/.test(arg)) {
      path = `#/${remote.workspace}/${remote.repo}/${arg}`;
      summary = `${remote.workspace}/${remote.repo} #${arg}`;
    } else if (arg) {
      fail(`unrecognised argument "${arg}"`);
    } else {
      const branch = git("rev-parse", "--abbrev-ref", "HEAD");
      const pr = branch ? await findPrForBranch(remote.workspace, remote.repo, branch) : null;
      if (pr) {
        path = `#/${remote.workspace}/${remote.repo}/${pr.id}`;
        summary = `${remote.workspace}/${remote.repo} #${pr.id} "${pr.title}" (branch ${branch})`;
      } else {
        summary = `pull request list — no open PR found for branch ${branch}`;
      }
    }
  }

  await ensureServer();
  const target = `${base}/${path}`;
  openBrowser(target);
  console.log(`visual-review: opened ${summary}\n${target}`);
}

await main();
