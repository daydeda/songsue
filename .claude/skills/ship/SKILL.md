---
name: ship
description: Ship the current changes end-to-end for ActiveCAMT — branch off main, commit, push, open a PR, merge it into main, and delete the branch (local + remote). Use when the user says "ship this", "commit + PR + merge", "open a PR and merge", or otherwise wants the full feature-branch → PR → merge → cleanup flow in one go. For deploys that touch the DB schema or read a new column, run /safe-deploy first.
---

# Ship (ActiveCAMT)

Takes working-tree changes from "done on `main`'s worktree" to "merged into `main`,
branch gone" without ever pushing to `main` directly. The merge happens through a
PR — that is the only sanctioned path to `main` (see CLAUDE.md: **never push to
`main`**).

## When to use
- The user asks to "ship", "commit and open a PR and merge", or lists the full
  branch → PR → merge → delete-branch sequence.
- The change is already implemented and reviewed enough to land.

## When NOT to use (or do something first)
- **Schema / new-column changes:** run **/safe-deploy** first — prod must be
  migrated before code that reads a new column merges. This skill does not migrate.
- **Unreviewed or risky diffs:** run **/recheck** first.
- The user only wants a commit, or only a PR (no merge) — just do that step.

## Preconditions (verify before branching)
1. **Build + lint pass.** Run `npm run build` and `npm run lint`. Pre-existing
   warnings/errors in files you didn't touch are fine; do not let *new* ones land.
2. Know what's staged. `git status --short` — commit only the intended files.

## Steps

1. **Branch off main.** Pick a descriptive name: `feat/...`, `fix/...`, `chore/...`.
   ```bash
   git checkout -b feat/<short-description>
   ```

2. **Stage + commit.** Quote any path containing `[` `]` — this repo has routes like
   `src/app/api/events/[id]/register/route.ts`, and **zsh glob-expands the brackets**
   (`no matches found`) unless the path is single-quoted.
   ```bash
   git add 'src/app/api/events/[id]/.../route.ts' 'src/app/...'
   ```
   Commit with a clear subject + body, ending with the trailer:
   ```
   Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
   ```

3. **Push** and set upstream:
   ```bash
   git push -u origin feat/<short-description>
   ```

4. **Open the PR** against `main` with `gh`. End the body with:
   ```
   🤖 Generated with [Claude Code](https://claude.com/claude-code)
   ```
   ```bash
   gh pr create --base main --head feat/<short-description> \
     --title "<conventional commit title>" --body "<summary>"
   ```

5. **Merge + delete the branch** (deletes both remote and local, returns you to
   `main`):
   ```bash
   gh pr merge <PR#> --merge --delete-branch
   ```
   Use `--merge` (a real merge commit, matching this repo's history) unless the user
   asks for `--squash` or `--rebase`.

6. **Confirm clean state:**
   ```bash
   git branch --show-current   # -> main
   git branch                  # the feature branch is gone
   git log --oneline -1        # -> the merge commit
   ```

## Notes
- If branch protection blocks `gh pr merge` (required reviews/checks), stop and tell
  the user — do not try to bypass it or push to `main`.
- If the merge is not a fast-forward and conflicts arise, stop and surface the
  conflict rather than force-anything.
- This skill is git mechanics only. It does **not** deploy or migrate — Vercel
  deploys on merge to `main`, so make sure prod is already migrated (via
  /safe-deploy) for any schema-dependent change *before* you run step 5.
