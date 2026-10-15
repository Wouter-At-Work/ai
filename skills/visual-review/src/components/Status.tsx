import type { Account } from "../api/types";
import { CHANGE_PIECE, ICONS } from "../lib/dot-icons";
import { DotIcon } from "./DotIcon";

export function ErrorBox({ title, error, hint }: { title: string; error: unknown; hint?: string }) {
  return (
    <div className="error-box" role="alert">
      <strong>{title}</strong>
      <p>{error instanceof Error ? error.message : String(error)}</p>
      {hint && <p className="muted">{hint}</p>}
    </div>
  );
}

export function Avatar({ account, size = 20 }: { account: Account; size?: number }) {
  if (!account.links.avatar.href) {
    return (
      <span className="avatar avatar-initial" style={{ width: size, height: size, fontSize: size * 0.5 }}>
        {account.display_name.slice(0, 1)}
      </span>
    );
  }
  return (
    <img
      className="avatar"
      src={account.links.avatar.href}
      alt=""
      title={account.display_name}
      width={size}
      height={size}
    />
  );
}

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

/** Formats an ISO timestamp relative to now. @example timeAgo(iso) // → "3 hours ago" */
export function timeAgo(iso: string) {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return relative.format(Math.round(seconds), "second");
}

export function CommentCount({ count }: { count: number }) {
  return (
    <span className="comment-count" title={`${count} comment${count === 1 ? "" : "s"}`}>
      <DotIcon icon={ICONS.comment} />
      {count}
    </span>
  );
}

export function ChangeIcon({ type }: { type: string }) {
  const piece = CHANGE_PIECE[type.startsWith("rename") ? "rename" : type] ?? CHANGE_PIECE.change;
  return piece ? <DotIcon icon={piece.test} color={piece.color} label={type.replace("-", " ")} /> : null;
}
