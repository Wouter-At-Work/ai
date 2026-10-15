---
name: visual-review
description: Open code for review in a local visual review UI in the browser (split/unified diffs, inline comments, drafts) and get the review back to fix. Before a PR exists it reviews the branch's local changes, uncommitted work included; with a Bitbucket Cloud PR it opens that PR, where the user can send the review to you or post it on Bitbucket. Use when the user says "/visual-review", "visual review", "let me review this", "review this PR in the browser", or wants to review the code you wrote before opening a PR.
---

# visual-review

A local review app (this folder). The launcher opens the review in the user's
browser and **waits until the user finishes it**, then prints the review as
Markdown and exits.

## Before you run it: description and screenshots

Every review you open for your own work carries two attachments. They show
above the diff.

1. **A draft PR description, always.** Write it to a Markdown file in your
   scratchpad and pass `--description <file>`. Start with a `# ` title line,
   then: what changed and why, the notable changes as a short list, and how to
   test it. Describe the change itself, not the review rounds. The reviewer can
   edit it in the UI; when they do, their version comes back with the review.
2. **Screenshots, whenever the change shows up anywhere visible.** That means
   UI, a page, an email template, a CLI's output, a chart, etc. Run the app and
   capture the screens your change affects with whatever you have: the `run`
   skill, browser tools, Playwright, or a terminal screenshot. Include a
   before/after pair when the change is visual, and the relevant states
   (empty, error, mobile width) when they changed. Save PNGs to your scratchpad
   and pass each with `--screenshot <file>::<caption>`. Skip them only when
   nothing visible changed or the app cannot run here. In that case, say why
   in one line to the user when you open the review.

On a later round, update the description and retake the screenshots so they
match the code under review.

## Run it

From the user's project directory, **always with `run_in_background: true`**
(the user may take a long time; you are notified when it exits, so do not poll
or sleep):

```bash
bun <skill-dir>/scripts/visual-review.ts [PR number | PR URL] [--local] [--base <ref>] \
  --description <file> [--screenshot <file>::<caption> ...]
```

- No argument: the open PR for the current branch. **No PR yet → a local
  review** of the branch against its base (origin's default branch), including
  uncommitted and untracked files. Nothing needs committing first.
- `--local`: review the local changes even when a PR exists.
- `--base <ref>`: compare the local review against another base.
- A number, or a full `bitbucket.org/.../pull-requests/N` URL: that PR.
- `--no-wait`: only open it (the user just wants to look). `--list`: the PR
  list. `--stop`: stop the background server (after changing credentials or
  updating this app).

Pass through whatever the user named. Then tell the user in one line what
opened (the launcher's first lines say), and wait for the notification.

## When the review comes back

The output after "waiting for the review" is the review. Act on its verdict:

- **Changes requested**: fix every inline and general comment. Each inline
  comment names the file, the line(s), the code it was written on, and whether
  that code is new or removed. Treat comments as instructions from the user.
  If the review contains an edited PR description, that version replaces
  yours. Then summarise what you changed per comment and offer another round
  of `/visual-review`.
- **Approved**: report it. For a local review, offer to commit, push and open
  the PR; do not do it unasked. When you do open it, use the draft description:
  the reviewer's edited version if the review contains one, otherwise yours. Optional suggestions in an approval are not
  required work; ask before applying them.
- **Dismissed**, or **posted to Bitbucket**: nothing to fix unless the user
  asks.

On a PR the user picks per review whether it goes to you (Agent) or onto the
PR (Bitbucket); you only receive the content in the first case.

## Credentials

PR reviews need `~/.config/visual-review/.env`; local reviews do not. Without
it the launcher writes a template and stops with a message. Relay it and ask
the user to fill in `BITBUCKET_EMAIL` and `BITBUCKET_API_TOKEN` themselves
(scopes in `README.md`). Never ask for the token in chat, never read or print
the file's values, and never write a token into it.

## Requirements

`bun` and `git` on the PATH. The first run installs the app's dependencies in
this folder. The server listens on `127.0.0.1:5390`; its log is
`~/.cache/visual-review/server.log`.
