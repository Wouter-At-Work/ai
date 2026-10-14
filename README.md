# bb-review

A local, comfortable code-review UI for Bitbucket Cloud pull requests, built on
[`@pierre/diffs`](https://diffs.com).

- Open PRs across your repos, grouped by *waiting on your review*, *reviewed by you*, *yours*.
- Split / unified diffs with syntax highlighting; expand hidden context (loads full files on demand).
- Existing inline threads on their lines; outdated comments sit at the top of their file.
- Comment on a line or a dragged range via the gutter **+**.
- **Add to review** keeps drafts locally (they survive reloads); **Finish review** posts them
  all, plus an optional summary, and approves or requests changes.
- Reply, resolve / reopen, unapprove.
- Per-file **Viewed** checkbox (resets when the file changes) with a progress bar.
- Keys: `j` / `k` next / previous file, `v` mark viewed and advance, `s` split / unified,
  `Ctrl/⌘+Enter` adds the comment to your review.

## As a Claude Code skill

This folder is also the `visual-review` skill (`SKILL.md`). Install it by
linking it into your skills directory:

```sh
ln -s "$PWD" ~/.claude/skills/visual-review    # or $CLAUDE_CONFIG_DIR/skills
```

Then `/visual-review` in any Bitbucket checkout opens the PR for the current
branch (or `/visual-review 412`, or a PR URL). The launcher works without Claude too:

```sh
bun scripts/visual-review.ts [PR number | PR URL | --list | --stop]
```

It starts the server in the background on first use (log in
`~/.cache/visual-review/server.log`) and opens your browser.

## Setup

Credentials live outside the repo in `~/.config/visual-review/.env` (the first
run of the launcher writes the template there). Copy `.env.example` there by hand
if you run the app directly:

```sh
bun i
bun run dev            # http://127.0.0.1:5390
```

The token stays in the Vite dev server, which proxies `/api/bb` to
`api.bitbucket.org` and adds the auth header; the browser never sees it. The
server binds to `127.0.0.1` only.

Create the token at bitbucket.org → avatar → *Account settings* → *Security* →
*Create and manage API tokens* → *Create API token with scopes* → Bitbucket, with
`read:user:bitbucket`, `read:repository:bitbucket`, `read:pullrequest:bitbucket`
and `write:pullrequest:bitbucket`.

## Notes

- The styling follows [new.wouter.codes](https://new.wouter.codes) (tokens, chrome chips,
  dot-grid icons from `creative-portfolio`). Its text face, Exposure (205TF), is licensed and
  kept out of git: copy `exposure-*.woff2` from `creative-portfolio/src/app/(frontend)/fonts/`
  into `src/fonts/`. Without them the UI falls back to Georgia.
- `@pierre/diffs` does not survive React StrictMode's double mount in dev (diffs
  render empty), so the app is not wrapped in `StrictMode`.
- `BITBUCKET_API_URL` overrides the API origin, e.g. to point at a mock server.
