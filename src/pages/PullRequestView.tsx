import {
  useStableCallback,
  type FileDiffMetadata,
  type FileDiffOptions,
  type SelectedLineRange,
} from "@pierre/diffs/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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
import { FileList } from "../components/FileList";
import { FilePanel } from "../components/FilePanel";
import { Overview } from "../components/Overview";
import { ReviewContext, type ReviewActions } from "../components/ReviewContext";
import { ReviewerStack } from "../components/Reviewers";
import { ErrorBox } from "../components/Status";
import { SubmitReview, type Verdict } from "../components/SubmitReview";
import {
  buildThreads,
  fileAnnotations,
  fileMatches,
  fileVersion,
  toInline,
  type Anchor,
  type Draft,
  type LineNotes,
} from "../lib/review";
import { ICONS } from "../lib/dot-icons";
import { useStoredState } from "../lib/storage";

interface Props {
  repo: string;
  id: number;
  me: Account;
}

export function PullRequestView({ repo, id, me }: Props) {
  const queryClient = useQueryClient();
  const pr = useQuery(pullRequestQuery(repo, id));
  const comments = useQuery(commentsQuery(repo, id));
  const sourceHash = pr.data?.source.commit?.hash;
  const diff = useQuery(diffQuery(repo, id, sourceHash));

  const [diffStyle, setDiffStyle] = useStoredState<"split" | "unified">("diffStyle", "split");
  const [viewed, setViewed] = useStoredState<string[]>(`viewed:${repo}:${id}`, []);
  const [drafts, setDrafts] = useStoredState<Draft[]>(`drafts:${repo}:${id}`, []);
  const [composer, setComposer] = useState<Anchor | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const addComment = useAddComment(repo, id);
  const resolveComment = useResolveComment(repo, id);
  const setReview = useSetReview(repo, id);

  const files = diff.data ?? [];
  const threads = buildThreads(comments.data ?? []);
  const isViewed = (file: FileDiffMetadata) => viewed.includes(fileVersion(file));
  const myState =
    pr.data?.participants.find((participant) => participant.user.uuid === me.uuid)?.state ?? null;

  const toggleViewed = (file: FileDiffMetadata) => {
    const version = fileVersion(file);
    setViewed((current) =>
      current.includes(version) ? current.filter((v) => v !== version) : [...current, version],
    );
  };

  const goTo = (index: number) => {
    const clamped = Math.max(0, Math.min(files.length - 1, index));
    setActiveIndex(clamped);
    document.getElementById(`file-${clamped}`)?.scrollIntoView({ block: "start" });
  };

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, dialog")) {
        return;
      }
      const file = files[activeIndex];
      if (event.key === "j") goTo(activeIndex + 1);
      else if (event.key === "k") goTo(activeIndex - 1);
      else if (event.key === "s") setDiffStyle((style) => (style === "split" ? "unified" : "split"));
      else if (event.key === "v" && file) {
        toggleViewed(file);
        if (!isViewed(file)) goTo(activeIndex + 1);
      } else return;
      event.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const postNow: ReviewActions["postNow"] = ({ body, anchor, parentId }) =>
    addComment.mutateAsync({ body, parentId, inline: anchor ? toInline(anchor) : undefined });

  const review: ReviewActions = {
    me,
    drafts,
    saveDraft: (draft) =>
      setDrafts((current) => {
        const withId = { ...draft, id: draft.id ?? crypto.randomUUID() };
        return current.some((d) => d.id === withId.id)
          ? current.map((d) => (d.id === withId.id ? withId : d))
          : [...current, withId];
      }),
    discardDraft: (draftId) => setDrafts((current) => current.filter((d) => d.id !== draftId)),
    postNow,
    resolve: (commentId, resolved) => resolveComment.mutate({ commentId, resolved }),
    closeComposer: () => setComposer(null),
    isPosting: addComment.isPending,
  };

  async function submitReview({ verdict, summary }: { verdict: Verdict; summary: string }) {
    for (const draft of drafts) {
      await bitbucket.addComment(repo, id, {
        body: draft.body,
        parentId: draft.parentId,
        inline: draft.anchor ? toInline(draft.anchor) : undefined,
      });
      review.discardDraft(draft.id);
    }
    if (summary.trim()) await bitbucket.addComment(repo, id, { body: summary });
    await queryClient.invalidateQueries({ queryKey: ["comments", repo, id] });
    if (verdict !== "comment") await setReview.mutateAsync(verdict);
  }

  const loadDiffFiles = useStableCallback(async (file: FileDiffMetadata) => {
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
  });

  const options: FileDiffOptions<LineNotes, undefined> = {
    diffStyle,
    themeType: "system",
    theme: { dark: "pierre-dark", light: "pierre-light" },
    lineDiffType: "word",
    overflow: "scroll",
    loadDiffFiles,
  };

  const openComposer = (file: FileDiffMetadata, range: SelectedLineRange) => {
    const side = range.endSide ?? range.side ?? "additions";
    const start = Math.min(range.start, range.end);
    const end = Math.max(range.start, range.end);
    setComposer({ path: file.name, side, line: end, startLine: start === end ? undefined : start });
  };

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

  return (
    <ReviewContext value={review}>
      <div className="review-layout">
        <header className="review-header">
          <a className="button icon" href="#/" title="All pull requests">
            <DotIcon icon={ICONS.arrowLeft} label="All pull requests" />
          </a>
          <div className="review-title">
            <h1>
              {pr.data.title} <span className="muted">#{pr.data.id}</span>
            </h1>
            <span className="label">
              {repo} · {pr.data.source.branch.name} → {pr.data.destination.branch.name} ·{" "}
              {pr.data.author.display_name}
              {pr.data.state !== "OPEN" && <span className="tag">{pr.data.state.toLowerCase()}</span>}
            </span>
          </div>
          <ReviewerStack pr={pr.data} />
          <div className="segmented" role="group" aria-label="Diff layout">
            {(["split", "unified"] as const).map((style) => (
              <button
                key={style}
                type="button"
                aria-pressed={diffStyle === style}
                onClick={() => setDiffStyle(() => style)}
              >
                <DotIcon icon={style === "split" ? ICONS.split : ICONS.unified} />
                {style === "split" ? "Split" : "Unified"}
              </button>
            ))}
          </div>
          {myState && (
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
          <SubmitReview drafts={drafts} myState={myState} onSubmit={submitReview} />
        </header>

        <FileList
          files={files}
          activeIndex={activeIndex}
          isViewed={isViewed}
          commentCount={(file) =>
            threads.filter((t) => t.root.inline && fileMatches(file, t.root.inline.path)).length
          }
          onSelect={goTo}
        />

        <main className="review-main">
          <Overview
            pr={pr.data}
            threads={threads.filter((thread) => !thread.root.inline)}
            orphanThreads={orphanThreads}
            commentsError={comments.error}
          />
          {diff.isPending && <p className="muted">Loading diff…</p>}
          {diff.isError && <ErrorBox title="Could not load the diff" error={diff.error} />}
          {diff.isSuccess && files.length === 0 && <p className="muted">This pull request has no changes.</p>}
          {files.map((file, index) => (
            <FilePanel
              key={file.name}
              file={file}
              index={index}
              active={index === activeIndex}
              viewed={isViewed(file)}
              options={options}
              annotations={fileAnnotations(file, threads, drafts, composer)}
              onToggleViewed={() => toggleViewed(file)}
              onComment={(range) => {
                setActiveIndex(index);
                openComposer(file, range);
              }}
            />
          ))}
        </main>
      </div>
    </ReviewContext>
  );
}
