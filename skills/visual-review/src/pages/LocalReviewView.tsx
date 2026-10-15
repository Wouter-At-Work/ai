import type { FileDiffMetadata } from "@pierre/diffs/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { AgentVerdict } from "../../shared/agent-review";
import { localDiffQuery, localFile, sessionQuery, submitSession } from "../api/agent";
import type { Account } from "../api/types";
import { DraftCard } from "../components/CommentThread";
import { Composer } from "../components/Composer";
import { useReview } from "../components/ReviewContext";
import { ReviewWorkspace } from "../components/ReviewWorkspace";
import { ErrorBox } from "../components/Status";
import { SubmitReview } from "../components/SubmitReview";
import { buildAgentReview } from "../lib/agent";
import { AGENT_VERDICTS } from "../lib/agent-verdicts";
import { useDrafts } from "../lib/drafts";

function LocalOverview({ fileCount }: { fileCount: number }) {
  const review = useReview();
  const notes = review.drafts.filter((draft) => !draft.anchor && !draft.parentId);
  return (
    <section className="overview">
      <p className="description">
        {fileCount} changed file{fileCount === 1 ? "" : "s"}, including uncommitted and untracked work.
        Nothing here is on Bitbucket yet: your review goes straight back to the agent that is waiting on
        it.
      </p>
      {notes.length > 0 && <h2 className="section-title">General comments</h2>}
      {notes.map((draft) => (
        <DraftCard key={draft.id} draft={draft} />
      ))}
      <Composer
        autoFocus={false}
        placeholder="A general comment for the agent…"
        onDraft={(body) => review.saveDraft({ body })}
      />
    </section>
  );
}

export function LocalReviewView({ sessionId, me }: { sessionId: string; me: Account }) {
  const queryClient = useQueryClient();
  const session = useQuery(sessionQuery(sessionId));
  const diff = useQuery(localDiffQuery(sessionId));
  const [notice, setNotice] = useState<string | null>(null);

  const storageKey = `local:${session.data?.repoName}:${session.data?.branch}`;
  const { drafts, clearDrafts } = useDrafts(storageKey);
  const files = diff.data ?? [];
  const open = session.data?.status === "open";

  async function send({ verdict, summary }: { verdict: AgentVerdict; summary: string }) {
    const review = buildAgentReview(files, drafts, verdict, summary);
    await submitSession(sessionId, { destination: "agent", review });
    await queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
    if (verdict !== "dismissed") clearDrafts();
    setNotice(
      verdict === "dismissed"
        ? "Review dismissed. The agent was told to make no changes."
        : "Review sent to the agent. You can close this tab.",
    );
  }

  async function loadDiffFiles(file: FileDiffMetadata) {
    const oldPath = file.prevName ?? file.name;
    const [oldContents, newContents] = await Promise.all([
      file.type === "rename-pure" ? null : localFile(sessionId, "old", oldPath),
      localFile(sessionId, "new", file.name),
    ]);
    const newFile = { name: file.name, contents: newContents };
    return oldContents === null
      ? { oldFile: null, newFile }
      : { oldFile: { name: oldPath, contents: oldContents }, newFile };
  }

  if (session.isError) {
    return (
      <main className="page">
        <ErrorBox
          title="This review session is gone"
          error={session.error}
          hint="Run /visual-review again from Claude Code to start a new one."
        />
      </main>
    );
  }
  if (!session.data) return <main className="page muted">Loading review…</main>;

  return (
    <ReviewWorkspace
      key={storageKey}
      storageKey={storageKey}
      me={me}
      backHref="#/"
      title={
        <>
          <h1>
            {session.data.branch} <span className="muted">local</span>
          </h1>
          <span className="label">
            {session.data.repoName} · {session.data.base} → {session.data.branch} · working tree
          </span>
        </>
      }
      actions={
        <>
          <button
            type="button"
            className="button"
            disabled={diff.isFetching}
            onClick={() => diff.refetch()}
            title="Re-read the working tree"
          >
            {diff.isFetching ? "Reloading…" : "Reload"}
          </button>
          <SubmitReview
            drafts={drafts}
            verdicts={AGENT_VERDICTS}
            title="Send your review to the agent"
            buttonLabel={open ? "Send to agent" : "Sent"}
            submitLabel="Send to agent"
            disabled={!open}
            allowEmpty={(verdict) => verdict === "approve"}
            onSubmit={send}
            onDismiss={() => send({ verdict: "dismissed", summary: "" })}
          />
        </>
      }
      banner={
        (notice || !open) && (
          <p className="notice">{notice ?? "This review was already sent to the agent."}</p>
        )
      }
      overview={<LocalOverview fileCount={files.length} />}
      files={files}
      diffPending={diff.isPending}
      diffError={diff.error}
      emptyText="No changes against the base branch yet."
      threads={[]}
      loadDiffFiles={loadDiffFiles}
    />
  );
}
