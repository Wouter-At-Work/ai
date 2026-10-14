import type { FileDiffMetadata } from "@pierre/diffs/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { formatAgentReview, type AgentVerdict } from "../../shared/agent-review";
import { sessionQuery, submitSession } from "../api/agent";
import { bitbucket } from "../api/bitbucket";
import {
  commentsQuery,
  diffQuery,
  mergeBaseQuery,
  pullRequestQuery,
  useAddComment,
  useResolveComment,
  useSetReview,
} from "../api/queries";
import type { Account } from "../api/types";
import { DotIcon } from "../components/DotIcon";
import { ModeToggle, type ReviewMode } from "../components/ModeToggle";
import { Overview } from "../components/Overview";
import { ReviewerStack } from "../components/Reviewers";
import { ReviewWorkspace } from "../components/ReviewWorkspace";
import { ErrorBox } from "../components/Status";
import { SubmitReview } from "../components/SubmitReview";
import { AGENT_VERDICTS } from "../lib/agent-verdicts";
import { buildAgentReview } from "../lib/agent";
import { ICONS } from "../lib/dot-icons";
import { useDrafts } from "../lib/drafts";
import { buildThreads, fileMatches, toInline } from "../lib/review";

type BitbucketVerdict = "comment" | "approve" | "request-changes";

const BITBUCKET_VERDICTS = [
  { value: "comment" as const, label: "Comment", hint: "Post your comments without a verdict." },
  { value: "approve" as const, label: "Approve", hint: "Approve the pull request." },
  { value: "request-changes" as const, label: "Request changes", hint: "Block merging until addressed." },
];

interface Props {
  repo: string;
  id: number;
  me: Account;
  agentSession?: string;
}

export function PullRequestView({ repo, id, me, agentSession }: Props) {
  const queryClient = useQueryClient();
  const pr = useQuery(pullRequestQuery(repo, id));
  const comments = useQuery(commentsQuery(repo, id));
  const diff = useQuery(diffQuery(repo, id, pr.data?.source.commit?.hash));
  const session = useQuery({ ...sessionQuery(agentSession ?? ""), enabled: Boolean(agentSession) });
  const [mode, setMode] = useState<ReviewMode>(agentSession ? "agent" : "bitbucket");
  const [notice, setNotice] = useState<string | null>(null);

  const storageKey = `${repo}:${id}`;
  const { drafts, discardDraft, clearDrafts } = useDrafts(storageKey);
  const addComment = useAddComment(repo, id);
  const resolveComment = useResolveComment(repo, id);
  const setReview = useSetReview(repo, id);

  const files = diff.data ?? [];
  const threads = buildThreads(comments.data ?? []);
  const myState =
    pr.data?.participants.find((participant) => participant.user.uuid === me.uuid)?.state ?? null;
  const sessionOpen = session.data?.status === "open";

  async function releaseSession(submission: Parameters<typeof submitSession>[1]) {
    if (!agentSession || !sessionOpen) return;
    await submitSession(agentSession, submission);
    await queryClient.invalidateQueries({ queryKey: ["session", agentSession] });
  }

  async function submitToBitbucket({ verdict, summary }: { verdict: BitbucketVerdict; summary: string }) {
    let posted = 0;
    for (const draft of drafts) {
      await bitbucket.addComment(repo, id, {
        body: draft.body,
        parentId: draft.parentId,
        inline: draft.anchor ? toInline(draft.anchor) : undefined,
      });
      discardDraft(draft.id);
      posted++;
    }
    if (summary.trim()) {
      await bitbucket.addComment(repo, id, { body: summary });
      posted++;
    }
    await queryClient.invalidateQueries({ queryKey: ["comments", repo, id] });
    if (verdict !== "comment") await setReview.mutateAsync(verdict);
    await releaseSession({ destination: "bitbucket", posted, verdict });
    setNotice(`Posted ${posted} comment${posted === 1 ? "" : "s"} to Bitbucket.`);
  }

  async function submitToAgent({ verdict, summary }: { verdict: AgentVerdict; summary: string }) {
    const review = buildAgentReview(files, drafts, verdict, summary);
    if (agentSession && sessionOpen) {
      await submitSession(agentSession, { destination: "agent", review });
      await queryClient.invalidateQueries({ queryKey: ["session", agentSession] });
      setNotice("Review sent to the agent. You can close this tab.");
    } else {
      const markdown = formatAgentReview(
        {
          id: "",
          kind: "pr",
          title: pr.data?.title ?? `${repo} #${id}`,
          createdAt: new Date().toISOString(),
          status: "submitted",
          repo,
          prId: id,
        },
        review,
      );
      await navigator.clipboard.writeText(markdown);
      setNotice("No agent is waiting on this review, so it was copied as Markdown. Paste it to your agent.");
    }
    clearDrafts();
  }

  async function loadDiffFiles(file: FileDiffMetadata) {
    if (!pr.data?.source.commit || !pr.data.destination.commit) {
      throw new Error("Pull request commits are unknown");
    }
    const source = pr.data.source.commit.hash;
    const base = await queryClient.fetchQuery(
      mergeBaseQuery(repo, source, pr.data.destination.commit.hash),
    );
    const oldPath = file.prevName ?? file.name;
    const [oldContents, newContents] = await Promise.all([
      file.type === "rename-pure" ? null : bitbucket.fileAt(repo, base, oldPath),
      bitbucket.fileAt(repo, source, file.name),
    ]);
    const newFile = { name: file.name, contents: newContents };
    return oldContents === null
      ? { oldFile: null, newFile }
      : { oldFile: { name: oldPath, contents: oldContents }, newFile };
  }

  if (pr.isError) {
    return (
      <main className="page">
        <a href="#/">← All pull requests</a>
        <ErrorBox title={`Could not load ${repo} #${id}`} error={pr.error} />
      </main>
    );
  }
  if (!pr.data) return <main className="page muted">Loading pull request…</main>;

  const orphanThreads = threads.filter(
    (thread) =>
      thread.root.inline &&
      diff.isSuccess &&
      !files.some((file) => thread.root.inline && fileMatches(file, thread.root.inline.path)),
  );

  const toAgent = mode === "agent";

  return (
    <ReviewWorkspace
      storageKey={storageKey}
      me={me}
      backHref="#/"
      title={
        <>
          <h1>
            {pr.data.title} <span className="muted">#{pr.data.id}</span>
          </h1>
          <span className="label">
            {repo} · {pr.data.source.branch.name} → {pr.data.destination.branch.name} ·{" "}
            {pr.data.author.display_name}
            {pr.data.state !== "OPEN" && <span className="tag">{pr.data.state.toLowerCase()}</span>}
          </span>
        </>
      }
      actions={
        <>
          <ReviewerStack pr={pr.data} />
          <ModeToggle mode={mode} onChange={setMode} agentWaiting={sessionOpen} />
          {!toAgent && myState && (
            <button
              type="button"
              className="button ghost"
              disabled={setReview.isPending}
              onClick={() => setReview.mutate("none")}
            >
              {myState === "approved" ? "Unapprove" : "Withdraw request"}
            </button>
          )}
          <a className="button" href={pr.data.links.html.href} target="_blank" rel="noreferrer">
            Bitbucket
            <DotIcon icon={ICONS.arrowUpRight} />
          </a>
          {toAgent ? (
            <SubmitReview
              key="agent"
              drafts={drafts}
              verdicts={AGENT_VERDICTS}
              title="Send your review to the agent"
              buttonLabel={sessionOpen ? "Send to agent" : "Copy review"}
              submitLabel={sessionOpen ? "Send to agent" : "Copy as Markdown"}
              note={sessionOpen ? "Nothing is posted to Bitbucket." : "No agent is waiting; the review is copied as Markdown."}
              allowEmpty={(verdict) => verdict === "approve"}
              onSubmit={submitToAgent}
              onDismiss={
                sessionOpen ? () => submitToAgent({ verdict: "dismissed", summary: "" }) : undefined
              }
            />
          ) : (
            <SubmitReview
              key="bitbucket"
              drafts={drafts}
              verdicts={BITBUCKET_VERDICTS}
              title="Post your review to Bitbucket"
              buttonLabel="Finish review"
              submitLabel="Post review"
              note={
                myState === "approved"
                  ? "You currently approve this pull request."
                  : myState === "changes_requested"
                    ? "You currently request changes."
                    : undefined
              }
              allowEmpty={(verdict) => verdict !== "comment"}
              onSubmit={submitToBitbucket}
            />
          )}
        </>
      }
      banner={notice && <p className="notice">{notice}</p>}
      overview={
        <Overview
          pr={pr.data}
          threads={threads.filter((thread) => !thread.root.inline)}
          orphanThreads={orphanThreads}
          commentsError={comments.error}
        />
      }
      files={files}
      diffPending={diff.isPending}
      diffError={diff.error}
      emptyText="This pull request has no changes."
      threads={threads}
      postNow={
        toAgent
          ? undefined
          : ({ body, anchor, parentId }) =>
              addComment.mutateAsync({ body, parentId, inline: anchor ? toInline(anchor) : undefined })
      }
      resolve={toAgent ? undefined : (commentId, resolved) => resolveComment.mutate({ commentId, resolved })}
      loadDiffFiles={loadDiffFiles}
    />
  );
}
