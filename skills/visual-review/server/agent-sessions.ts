import { execFile } from "node:child_process";
import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { readFile, realpath, stat } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { homedir } from "node:os";
import { basename, isAbsolute, join, normalize, sep } from "node:path";
import type { Plugin } from "vite";
import {
  formatAgentReview,
  formatBitbucketOutcome,
  type SessionInfo,
  type SessionResult,
  type Submission,
} from "../shared/agent-review";

interface StoredScreenshot {
  caption: string;
  file: string;
  type: string;
}

interface StoredSession extends Omit<SessionInfo, "screenshots"> {
  repoRoot?: string;
  result?: SessionResult;
  screenshots?: StoredScreenshot[];
}

const stateDir = join(homedir(), ".cache", "visual-review");
const sessionDir = join(stateDir, "sessions");
const secretFile = join(stateDir, "secret");
const screenshotDir = join(stateDir, "screenshots");
const MAX_UNTRACKED = 300;
const MAX_UNTRACKED_BYTES = 1_000_000;
const MAX_SCREENSHOTS = 20;
const IMAGE_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

function secret(): string {
  mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  if (!existsSync(secretFile)) {
    writeFileSync(secretFile, randomBytes(32).toString("hex"), { mode: 0o600 });
  }
  return readFileSync(secretFile, "utf8").trim();
}

function git(cwd: string, args: string[], okCodes = [0]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      args,
      { cwd, maxBuffer: 256 * 1024 * 1024, encoding: "utf8" },
      (error, stdout, stderr) => {
        const code = error && typeof error.code === "number" ? error.code : error ? -1 : 0;
        if (okCodes.includes(code)) resolve(stdout);
        else reject(new Error(stderr.trim() || `git ${args[0]} failed`));
      },
    );
  });
}

const DIFF_FLAGS = ["--no-color", "--no-ext-diff", "--src-prefix=a/", "--dst-prefix=b/"];

async function defaultBase(repoRoot: string): Promise<string> {
  const head = await git(repoRoot, ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"], [0, 1]);
  if (head.trim()) return head.trim();
  for (const candidate of ["origin/main", "origin/master", "main", "master"]) {
    const found = await git(repoRoot, ["rev-parse", "--verify", "--quiet", candidate], [0, 1]);
    if (found.trim()) return candidate;
  }
  throw new Error("Could not find a base branch; pass --base <ref>");
}

async function mergeBase(session: StoredSession): Promise<string> {
  if (!session.repoRoot || !session.base) throw new Error("Not a local session");
  return (await git(session.repoRoot, ["merge-base", "HEAD", session.base])).trim();
}

async function localDiff(session: StoredSession): Promise<{ patch: string; base: string }> {
  const repoRoot = session.repoRoot ?? "";
  const base = await mergeBase(session);
  const tracked = await git(repoRoot, ["-c", "core.quotepath=off", "diff", ...DIFF_FLAGS, "--find-renames", base]);
  const untracked = (await git(repoRoot, ["ls-files", "--others", "--exclude-standard", "-z"]))
    .split("\0")
    .filter(Boolean)
    .slice(0, MAX_UNTRACKED);
  const added: string[] = [];
  for (const path of untracked) {
    const info = await stat(join(repoRoot, path)).catch(() => null);
    if (!info?.isFile() || info.size > MAX_UNTRACKED_BYTES) continue;
    added.push(await git(repoRoot, ["diff", ...DIFF_FLAGS, "--no-index", "--", "/dev/null", path], [0, 1]));
  }
  const patch = [tracked, ...added]
    .filter(Boolean)
    .map((part) => (part.endsWith("\n") ? part : `${part}\n`))
    .join("");
  return { patch, base };
}

function safeRelative(path: string): string {
  const clean = normalize(path);
  if (!path || isAbsolute(path) || clean.startsWith("..") || clean.split(sep).includes("..") || clean.startsWith("-")) {
    throw new Error("Invalid path");
  }
  return clean;
}

async function localFile(session: StoredSession, side: string, path: string): Promise<string> {
  const repoRoot = session.repoRoot ?? "";
  const relative = safeRelative(path);
  if (side === "old") return git(repoRoot, ["show", `${await mergeBase(session)}:${relative}`]);
  const root = await realpath(repoRoot);
  const full = await realpath(join(root, relative));
  if (!full.startsWith(root + sep)) throw new Error("Invalid path");
  return readFile(full, "utf8");
}

function publicInfo({ repoRoot: _root, result: _result, screenshots, ...info }: StoredSession): SessionInfo {
  return screenshots?.length
    ? { ...info, screenshots: screenshots.map(({ caption }) => ({ caption })) }
    : info;
}

/** Writes the screenshots the launcher sent (base64) next to the sessions, so the JSON stays small. */
function saveScreenshots(id: string, input: unknown): StoredScreenshot[] | undefined {
  if (!Array.isArray(input) || input.length === 0) return undefined;
  if (input.length > MAX_SCREENSHOTS) throw new Error(`At most ${MAX_SCREENSHOTS} screenshots per review`);
  const dir = join(screenshotDir, id);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  return input.map((shot: { name?: unknown; caption?: unknown; data?: unknown }, index) => {
    const ext = /\.([a-z]+)$/i.exec(String(shot.name ?? ""))?.[1]?.toLowerCase() ?? "";
    const type = IMAGE_TYPES[ext];
    if (!type || typeof shot.data !== "string") throw new Error(`Screenshot ${shot.name} is not a png, jpg, webp or gif`);
    const file = join(dir, `${index}.${ext}`);
    writeFileSync(file, Buffer.from(shot.data, "base64"), { mode: 0o600 });
    return { caption: typeof shot.caption === "string" ? shot.caption : "", file, type };
  });
}

/** Review sessions an agent opens and waits on, plus the local git diffs they review. */
export function agentSessions(port: number, extras: Record<string, unknown> = {}): Plugin {
  const sessions = new Map<string, StoredSession>();
  const key = secret();
  const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);

  mkdirSync(sessionDir, { recursive: true, mode: 0o700 });
  for (const file of readdirSync(sessionDir)) {
    try {
      const session = JSON.parse(readFileSync(join(sessionDir, file), "utf8")) as StoredSession;
      sessions.set(session.id, session);
    } catch {}
  }
  const save = (session: StoredSession) => {
    sessions.set(session.id, session);
    writeFileSync(join(sessionDir, `${session.id}.json`), JSON.stringify(session), { mode: 0o600 });
  };

  const hasSecret = (req: IncomingMessage) => {
    const given = Buffer.from(String(req.headers["x-visual-review-secret"] ?? ""));
    const expected = Buffer.from(key);
    return given.length === expected.length && timingSafeEqual(given, expected);
  };

  const body = async (req: IncomingMessage): Promise<unknown> => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  };

  const send = (res: ServerResponse, status: number, payload: unknown, type = "application/json") => {
    res.statusCode = status;
    res.setHeader("Content-Type", type);
    res.setHeader("Cache-Control", "no-store");
    res.end(type === "application/json" ? JSON.stringify(payload) : String(payload));
  };

  async function createSession(input: Record<string, unknown>): Promise<StoredSession> {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const description =
      typeof input.description === "string" && input.description.trim() ? input.description : undefined;
    const attachments = { description, screenshots: saveScreenshots(id, input.screenshots) };
    if (input.kind === "pr" && typeof input.repo === "string" && typeof input.prId === "number") {
      return {
        id,
        kind: "pr",
        createdAt,
        status: "open",
        ...attachments,
        repo: input.repo,
        prId: input.prId,
        title: typeof input.title === "string" ? input.title : `${input.repo} #${input.prId}`,
      };
    }
    if (input.kind !== "local" || typeof input.cwd !== "string") throw new Error("Unknown session kind");
    const repoRoot = (await git(input.cwd, ["rev-parse", "--show-toplevel"])).trim();
    const branch = (await git(repoRoot, ["rev-parse", "--abbrev-ref", "HEAD"])).trim();
    const base = typeof input.base === "string" && input.base ? input.base : await defaultBase(repoRoot);
    await git(repoRoot, ["rev-parse", "--verify", base]);
    return {
      id,
      kind: "local",
      createdAt,
      status: "open",
      ...attachments,
      repoRoot,
      repoName: basename(repoRoot),
      branch,
      base,
      title: branch,
    };
  }

  return {
    name: "visual-review-sessions",
    configureServer(server) {
      server.middlewares.use("/__visual-review", async (req, res) => {
        try {
          const origin = req.headers.origin;
          if (!allowedHosts.has(String(req.headers.host)) || (origin && !allowedHosts.has(origin.replace(/^https?:\/\//, "")))) {
            return send(res, 403, { error: "Forbidden" });
          }
          const url = new URL(req.url ?? "/", "http://local");
          const parts = url.pathname.split("/").filter(Boolean);

          if (parts.length === 0) return send(res, 200, { app: "visual-review", ...extras });

          if (parts[0] !== "sessions") return send(res, 404, { error: "Not found" });

          if (parts.length === 1 && req.method === "POST") {
            if (!hasSecret(req)) return send(res, 403, { error: "Forbidden" });
            const session = await createSession((await body(req)) as Record<string, unknown>);
            save(session);
            return send(res, 201, publicInfo(session));
          }

          const session = parts[1] ? sessions.get(parts[1]) : undefined;
          if (!session) return send(res, 404, { error: "No such review session" });
          const action = parts[2];

          if (!action && req.method === "GET") return send(res, 200, publicInfo(session));

          if (action === "diff" && session.kind === "local") {
            const { patch, base } = await localDiff(session);
            res.setHeader("X-Merge-Base", base);
            return send(res, 200, patch, "text/plain; charset=utf-8");
          }

          if (action === "file" && session.kind === "local") {
            const contents = await localFile(
              session,
              url.searchParams.get("side") ?? "new",
              url.searchParams.get("path") ?? "",
            );
            return send(res, 200, contents, "text/plain; charset=utf-8");
          }

          if (action === "screenshots" && req.method === "GET") {
            const shot = session.screenshots?.[Number(parts[3])];
            if (!shot) return send(res, 404, { error: "No such screenshot" });
            res.statusCode = 200;
            res.setHeader("Content-Type", shot.type);
            res.setHeader("Cache-Control", "private, max-age=86400");
            return res.end(await readFile(shot.file));
          }

          if (action === "submit" && req.method === "POST") {
            if (session.status === "submitted") return send(res, 409, { error: "This review was already sent" });
            const submission = (await body(req)) as Submission;
            const markdown =
              submission.destination === "agent"
                ? formatAgentReview(session, submission.review)
                : formatBitbucketOutcome(session, submission.posted, submission.verdict);
            save({
              ...session,
              status: "submitted",
              result: { destination: submission.destination, markdown, submittedAt: new Date().toISOString() },
            });
            return send(res, 200, { ok: true });
          }

          if (action === "result" && req.method === "GET") {
            if (!hasSecret(req)) return send(res, 403, { error: "Forbidden" });
            return session.result ? send(res, 200, session.result) : send(res, 204, "", "text/plain");
          }

          return send(res, 404, { error: "Not found" });
        } catch (error) {
          send(res, 500, { error: error instanceof Error ? error.message : String(error) });
        }
      });
    },
  };
}
