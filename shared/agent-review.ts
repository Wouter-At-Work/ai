export type ReviewSide = "additions" | "deletions";
export type AgentVerdict = "changes" | "approve" | "dismissed";

export interface SessionInfo {
  id: string;
  kind: "local" | "pr";
  title: string;
  createdAt: string;
  status: "open" | "submitted";
  repoName?: string;
  branch?: string;
  base?: string;
  repo?: string;
  prId?: number;
}

export interface AgentComment {
  path: string;
  side: ReviewSide;
  line: number;
  startLine?: number;
  body: string;
  code?: string[];
}

export interface AgentReview {
  verdict: AgentVerdict;
  summary: string;
  notes: string[];
  comments: AgentComment[];
}

export type Submission =
  | { destination: "agent"; review: AgentReview }
  | { destination: "bitbucket"; posted: number; verdict: string };

export interface SessionResult {
  destination: "agent" | "bitbucket";
  markdown: string;
  submittedAt: string;
}

const VERDICT_LINE: Record<AgentVerdict, string> = {
  changes:
    "**Changes requested.** Address every comment below, then run /visual-review again for another round.",
  approve: "**Approved.** No changes requested; any comments below are optional suggestions.",
  dismissed: "**Dismissed.** The reviewer closed the review without feedback. Make no changes.",
};

function scope(session: SessionInfo) {
  if (session.kind === "pr") return `Pull request ${session.repo} #${session.prId} (${session.title}).`;
  return `Local changes on \`${session.branch}\` against \`${session.base}\` in ${session.repoName}, including uncommitted and untracked files.`;
}

function lineLabel(comment: AgentComment) {
  const range =
    comment.startLine !== undefined && comment.startLine !== comment.line
      ? `lines ${comment.startLine}–${comment.line}`
      : `line ${comment.line}`;
  return comment.side === "additions"
    ? `${range} (new code)`
    : `${range} of the old version (removed code)`;
}

function fence(lines: string[], path: string, firstLine: number) {
  const ext = /\.([a-z0-9]+)$/i.exec(path)?.[1] ?? "";
  const width = String(firstLine + lines.length - 1).length;
  const body = lines.map((text, i) => `${String(firstLine + i).padStart(width)}  ${text}`).join("\n");
  const ticks = body.includes("```") ? "````" : "```";
  return `${ticks}${ext}\n${body}\n${ticks}`;
}

/**
 * Renders a finished review as the Markdown the agent receives.
 * @example formatAgentReview(session, { verdict: "changes", summary: "", notes: [], comments }) // → "# Visual review: …"
 */
export function formatAgentReview(session: SessionInfo, review: AgentReview): string {
  const out = [`# Visual review: ${session.title}`, "", VERDICT_LINE[review.verdict], "", scope(session)];
  if (review.summary.trim()) out.push("", "## Overall", "", review.summary.trim());
  if (review.notes.length) {
    out.push("", "## General comments", "");
    for (const note of review.notes) out.push(`- ${note.trim().replace(/\n/g, "\n  ")}`);
  }
  if (review.comments.length) {
    out.push("", `## Inline comments (${review.comments.length})`);
    review.comments.forEach((comment, index) => {
      out.push("", `### ${index + 1}. \`${comment.path}\` ${lineLabel(comment)}`, "");
      if (comment.code?.length) {
        out.push(fence(comment.code, comment.path, comment.startLine ?? comment.line), "");
      }
      out.push(comment.body.trim());
    });
  }
  return out.join("\n") + "\n";
}

/**
 * Renders the note the agent receives when the review went to Bitbucket instead.
 * @example formatBitbucketOutcome(session, 3, "approve") // → "# Visual review: … posted to Bitbucket …"
 */
export function formatBitbucketOutcome(session: SessionInfo, posted: number, verdict: string): string {
  const what = verdict === "comment" ? "without a verdict" : `with verdict "${verdict}"`;
  return `# Visual review: ${session.title}\n\nThe reviewer posted ${posted} comment${posted === 1 ? "" : "s"} to the pull request on Bitbucket ${what}, instead of sending them to you. ${scope(session)} Nothing to fix unless the user asks.\n`;
}
