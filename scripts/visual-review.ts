#!/usr/bin/env bun
/**
 * Opens a review in the browser and, by default, waits for it: the finished review is printed
 * to stdout as Markdown for the agent that ran this, and the script exits.
 *
 *   visual-review.ts                PR for the current branch, or a local review of the branch
 *                                   (working tree against the base) when it has no PR yet
 *   visual-review.ts 412            PR #412 of the repo in cwd
 *   visual-review.ts <PR url>       any Bitbucket PR
 *   visual-review.ts --local        a local review even when the branch has a PR
 *   visual-review.ts --base <ref>   the base for a local review (default: origin's default branch)
 *   visual-review.ts --no-wait      open the review without waiting for it
 *   visual-review.ts --list         the pull request list
 *   visual-review.ts --stop         stop the background server
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

const secretFile = join(stateDir, "secret");

function parseArgs(argv: string[]) {
  const flags = { local: false, wait: true, list: false, stop: false, base: "", target: "" };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? "";
    if (arg === "--local") flags.local = true;
    else if (arg === "--no-wait") flags.wait = false;
    else if (arg === "--list") flags.list = true;
    else if (arg === "--stop") flags.stop = true;
    else if (arg === "--base") flags.base = argv[++i] ?? "";
    else if (arg.startsWith("--")) fail(`unknown option ${arg}`);
    else flags.target = arg;
  }
  return flags;
}

function requireCredentials() {
  if (env.BITBUCKET_EMAIL && env.BITBUCKET_API_TOKEN) return;
  mkdirSync(configDir, { recursive: true });
  if (!existsSync(envFile)) {
    writeFileSync(envFile, readFileSync(join(appDir, ".env.example"), "utf8"), { mode: 0o600 });
  }
  fail(
    `no Bitbucket credentials yet. Fill in BITBUCKET_EMAIL and BITBUCKET_API_TOKEN in ${envFile} (template written), then run again. Local reviews (--local) work without them.`,
  );
}

async function createSession(input: Record<string, unknown>) {
  const response = await fetch(`${base}/__visual-review/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Visual-Review-Secret": readFileSync(secretFile, "utf8").trim(),
    },
    body: JSON.stringify(input),
  });
  const body = (await response.json()) as { id?: string; error?: string };
  if (!response.ok || !body.id) fail(body.error ?? `could not start a review session (${response.status})`);
  return body.id;
}

async function waitForResult(id: string): Promise<string> {
  for (;;) {
    try {
      const response = await fetch(`${base}/__visual-review/sessions/${id}/result`, {
        headers: { "X-Visual-Review-Secret": readFileSync(secretFile, "utf8").trim() },
      });
      if (response.status === 200) return ((await response.json()) as { markdown: string }).markdown;
      if (response.status === 404) fail("the review session disappeared");
    } catch {
      await ensureServer();
    }
    await Bun.sleep(1500);
  }
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.stop) return stopServer();

  let session: Record<string, unknown> | null = null;
  let path = "#/";
  let summary = "the pull request list";

  const url = /bitbucket\.org\/([^/]+)\/([^/]+)\/pull-requests\/(\d+)/.exec(flags.target);
  const remote = repoFromRemote();

  if (flags.list) {
    requireCredentials();
  } else if (url?.[1] && url[2] && url[3]) {
    requireCredentials();
    session = { kind: "pr", repo: `${url[1]}/${url[2]}`, prId: Number(url[3]) };
    summary = `${url[1]}/${url[2]} #${url[3]}`;
  } else if (/^\d+$/.test(flags.target)) {
    if (!remote) fail("not inside a Bitbucket git repository; pass a full PR URL instead");
    requireCredentials();
    session = { kind: "pr", repo: `${remote.workspace}/${remote.repo}`, prId: Number(flags.target) };
    summary = `${remote.workspace}/${remote.repo} #${flags.target}`;
  } else if (flags.target) {
    fail(`unrecognised argument "${flags.target}"`);
  } else {
    if (!git("rev-parse", "--show-toplevel")) fail("not inside a git repository");
    const branch = git("rev-parse", "--abbrev-ref", "HEAD");
    const pr =
      !flags.local && remote && branch && env.BITBUCKET_EMAIL && env.BITBUCKET_API_TOKEN
        ? await findPrForBranch(remote.workspace, remote.repo, branch)
        : null;
    if (pr && remote) {
      session = { kind: "pr", repo: `${remote.workspace}/${remote.repo}`, prId: pr.id, title: pr.title };
      summary = `${remote.workspace}/${remote.repo} #${pr.id} "${pr.title}" (branch ${branch})`;
    } else {
      session = { kind: "local", cwd: process.cwd(), base: flags.base };
      summary = `a local review of ${branch}${flags.local ? "" : " (no open PR for this branch)"}`;
    }
  }

  await ensureServer();

  let id: string | null = null;
  if (session && (flags.wait || session.kind === "local")) {
    id = await createSession(session);
    path =
      session.kind === "local"
        ? `#/local/${id}`
        : `#/${String(session.repo)}/${String(session.prId)}${flags.wait ? `?agent=${id}` : ""}`;
  } else if (session) {
    path = `#/${String(session.repo)}/${String(session.prId)}`;
  }

  const target = `${base}/${path}`;
  openBrowser(target);
  console.log(`visual-review: opened ${summary}\n${target}`);

  if (!id || !flags.wait) return;
  console.log("visual-review: waiting for the review in the browser…\n");
  console.log(await waitForResult(id));
}

await main();
