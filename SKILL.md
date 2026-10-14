---
name: visual-review
description: Open a Bitbucket Cloud pull request in a local visual code-review UI in the browser (split/unified diffs, inline comments, draft reviews, approve). Use when the user says "/visual-review", "visual review", "review this PR in the browser", "open the PR for review", or wants a nicer review than Bitbucket's own page. Picks the PR for the current branch by default, or takes a PR number or URL.
---

# visual-review

Opens the PR in the user's browser through a local review app (this folder),
starting its server in the background when needed.

## Run it

From the user's project directory (the git checkout of the repo under review):

```bash
bun <skill-dir>/scripts/visual-review.ts [PR number | PR URL | --list | --stop]
```

- No argument: the open PR whose source branch is the current branch.
- A number: that PR in the current repo. A full `bitbucket.org/.../pull-requests/N` URL works from anywhere.
- `--list`: the pull-request list. `--stop`: stop the background server
  (needed after changing credentials or pulling a new version of this app).

Pass through whatever the user named (`/visual-review 412`, a pasted URL). Then
tell the user in one line which PR opened, using the script's output. If it
reports no open PR for the branch, say so; the list page is open instead.

## Credentials

The script reads `~/.config/visual-review/.env`. On first run it writes a
template there and stops with a message. Relay that message and ask the user
to fill in `BITBUCKET_EMAIL` and `BITBUCKET_API_TOKEN` themselves, using the
token instructions in `README.md` next to this file. Never ask for the token in
chat, never read or print the file's values, and never write a token into it.

## Requirements

`bun` on the PATH and `git`. The first run installs the app's dependencies in
this folder. The server listens on `127.0.0.1:5390` (`PORT` in the env file);
its log is `~/.cache/visual-review/server.log`.
