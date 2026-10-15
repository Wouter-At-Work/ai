import type {
  FileDiffMetadata,
  FileDiffOptions,
  FileDiffLoadedFiles,
  SelectedLineRange,
} from "@pierre/diffs/react";
import { useStableCallback } from "@pierre/diffs/react";
import { useEffect, useState, type ReactNode } from "react";
import type { Account } from "../api/types";
import { ICONS } from "../lib/dot-icons";
import { useDrafts } from "../lib/drafts";
import {
  fileAnnotations,
  fileMatches,
  fileVersion,
  type Anchor,
  type LineNotes,
  type Thread,
} from "../lib/review";
import { useStoredState } from "../lib/storage";
import { DotIcon } from "./DotIcon";
import { FileList } from "./FileList";
import { FilePanel } from "./FilePanel";
import { ReviewContext, type ReviewActions } from "./ReviewContext";
import { ErrorBox } from "./Status";

interface ReviewWorkspaceProps {
  storageKey: string;
  me: Account;
  backHref: string;
  title: ReactNode;
  actions: ReactNode;
  banner?: ReactNode;
  overview: ReactNode;
  files: FileDiffMetadata[];
  diffPending: boolean;
  diffError: Error | null;
  emptyText: string;
  threads: Thread[];
  postNow?: ReviewActions["postNow"];
  resolve?: ReviewActions["resolve"];
  loadDiffFiles(file: FileDiffMetadata): Promise<FileDiffLoadedFiles>;
}

export function ReviewWorkspace(props: ReviewWorkspaceProps) {
  const { storageKey, files, threads } = props;
  const [diffStyle, setDiffStyle] = useStoredState<"split" | "unified">("diffStyle", "split");
  const [viewed, setViewed] = useStoredState<string[]>(`viewed:${storageKey}`, []);
  const { drafts, saveDraft, discardDraft } = useDrafts(storageKey);
  const [composer, setComposer] = useState<Anchor | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const loadDiffFiles = useStableCallback(props.loadDiffFiles);

  const isViewed = (file: FileDiffMetadata) => viewed.includes(fileVersion(file));
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

  const review: ReviewActions = {
    me: props.me,
    drafts,
    saveDraft,
    discardDraft,
    postNow: props.postNow,
    resolve: props.resolve,
    closeComposer: () => setComposer(null),
  };

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

  return (
    <ReviewContext value={review}>
      <div className="review-layout">
        <header className="review-header">
          <a className="button icon" href={props.backHref} title="Back">
            <DotIcon icon={ICONS.arrowLeft} label="Back" />
          </a>
          <div className="review-title">{props.title}</div>
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
          {props.actions}
        </header>

        <FileList
          files={files}
          activeIndex={activeIndex}
          isViewed={isViewed}
          commentCount={(file) =>
            threads.filter((t) => t.root.inline && fileMatches(file, t.root.inline.path)).length +
            drafts.filter((d) => d.anchor && fileMatches(file, d.anchor.path)).length
          }
          onSelect={goTo}
        />

        <main className="review-main">
          {props.banner}
          {props.overview}
          {props.diffPending && <p className="muted">Loading diff…</p>}
          {props.diffError && <ErrorBox title="Could not load the diff" error={props.diffError} />}
          {!props.diffPending && !props.diffError && files.length === 0 && (
            <p className="muted">{props.emptyText}</p>
          )}
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
              onCommentFile={() => {
                setActiveIndex(index);
                setComposer({ path: file.name, side: "additions", line: 0 });
              }}
            />
          ))}
        </main>
      </div>
    </ReviewContext>
  );
}
