import type { FileDiffMetadata } from "@pierre/diffs";
import { lineStats } from "../lib/review";
import { ChangeIcon, CommentCount } from "./Status";

interface FileListProps {
  files: FileDiffMetadata[];
  activeIndex: number;
  isViewed(file: FileDiffMetadata): boolean;
  commentCount(file: FileDiffMetadata): number;
  onSelect(index: number): void;
}

export function FileList({ files, activeIndex, isViewed, commentCount, onSelect }: FileListProps) {
  const viewedCount = files.filter(isViewed).length;
  return (
    <nav className="file-list" aria-label="Changed files">
      <div className="file-list-header">
        <span>
          Files <span className="count">{files.length}</span>
        </span>
        <span className="muted small">
          {viewedCount}/{files.length} viewed
        </span>
      </div>
      <progress max={files.length || 1} value={viewedCount} />
      <ul>
        {files.map((file, index) => {
          const stats = lineStats(file);
          const slash = file.name.lastIndexOf("/");
          const comments = commentCount(file);
          return (
            <li key={file.name}>
              <button
                type="button"
                className={`file-list-item${index === activeIndex ? " active" : ""}${isViewed(file) ? " viewed" : ""}`}
                onClick={() => onSelect(index)}
                title={file.name}
              >
                <ChangeIcon type={file.type} />
                <span className="file-list-name">
                  <span className="file-list-base">{file.name.slice(slash + 1)}</span>
                  {slash > 0 && <span className="file-list-dir">{file.name.slice(0, slash)}</span>}
                </span>
                {comments > 0 && <CommentCount count={comments} />}
                <span className="stat-add small">+{stats.added}</span>
                <span className="stat-del small">−{stats.removed}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="shortcuts muted small">
        <kbd>j</kbd> <kbd>k</kbd> files · <kbd>v</kbd> viewed · <kbd>s</kbd> layout
      </p>
    </nav>
  );
}
