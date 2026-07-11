---
name: ship
description: Ship the current changes end-to-end for ActiveCAMT — branch off main, commit, push, open a PR, merge it into main, delete the branch (local + remote), tag the merge with a semver version + description, cut a GitHub release, and record the day's entry in updates/ via the updates-changelog agent. Use when the user says "ship this", "commit + PR + merge", "open a PR and merge", or otherwise wants the full feature-branch → PR → merge → tag → release → cleanup flow in one go. For deploys that touch the DB schema or read a new column, run /safe-deploy first.
---

# Ship (ActiveCAMT)

Takes working-tree changes from "done on `main`'s worktree" to "merged into `main`,
tagged, and released" without ever pushing to `main` directly. The merge happens
through a PR — that is the only sanctioned path to `main` (see CLAUDE.md: **never
push to `main`**). Every ship ends with a new `vX.Y.Z` tag and a matching GitHub
release — this is not optional, it's the last two steps of the flow, same as the
changelog entry.

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

7. **Tag the release (always).** This repo tags every ship with an annotated
   semver tag and a matching GitHub release — check `git tag -l | sort -V | tail`
   and `gh release list --limit 5` for the current pattern before assuming. The
   tag points at the merge commit already sitting on `main`; nothing here pushes
   new code to `main`. (If you also want `package.json`'s `"version"` field to
   match the tag, bump it inside the feature branch back in step 2 so it rides
   through the normal PR — never as a separate direct commit to `main`.)

   - **Pick the version.** Bump from the latest tag (`git describe --tags
     --abbrev=0`), following semver: patch (`x.y.Z`) for fixes/small UX changes,
     minor (`x.Y.0`) for new features/modules, major (`X.0.0`) only if the user
     says so or it's a breaking change. When unsure, default to a patch/minor
     bump matching the size of what just shipped — don't ask unless it's
     genuinely ambiguous.
   - **Write the tag message.** Follow the existing style: `Release vX.Y.Z:
     <short description>` (or `Release vX.Y.Z — <description>` for a date-range
     cycle), then a blank line and a few bullet highlights pulled from the PR(s)
     since the last tag (`git log <last-tag>..HEAD --oneline`). Look at recent
     tags (`git tag -l -n99 <tag>`) to match tone.
   - **Create an annotated tag and push it** (tags are refs, not branch commits
     — pushing a tag does not touch `main`):
     ```bash
     git tag -a vX.Y.Z -m "Release vX.Y.Z: <description>

     - <highlight 1>
     - <highlight 2>"
     git push origin vX.Y.Z
     ```
   - **Cut the GitHub release** from that tag, reusing the tag message as the
     release body:
     ```bash
     gh release create vX.Y.Z --title "vX.Y.Z — <short description>" \
       --notes "<highlights, same content as the tag message>"
     ```
   - Skip this step only if the user explicitly says not to tag/release this
     ship (e.g. a hotfix bundled into the next release) — otherwise it's
     mandatory, same as the changelog entry below.

8. **Record the changelog (always — last step).** After the merge lands, launch the
   **`updates-changelog`** subagent to write/extend the day's entry in `updates/` for
   what was just shipped (Thai house style: ฝั่งนักศึกษา + ฝั่งทีม). Pass it the merge
   commit / PR number and a short summary of the change so it can derive details from
   the diff. This is not optional and not automatic anywhere else — shipping without a
   changelog entry is incomplete. (It creates a per-day `updates/YYYY-MM-DD.md`, or
   extends the current period file.) The agent only writes Markdown under `updates/`,
   so this never touches code or `main` history.

## Notes
- If branch protection blocks `gh pr merge` (required reviews/checks), stop and tell
  the user — do not try to bypass it or push to `main`.
- If the merge is not a fast-forward and conflicts arise, stop and surface the
  conflict rather than force-anything.
- This skill is git mechanics only. It does **not** deploy or migrate — Vercel
  deploys on merge to `main`, so make sure prod is already migrated (via
  /safe-deploy) for any schema-dependent change *before* you run step 5 (the merge).
- Tagging (step 7) always happens after the merge (step 5) lands, never before —
  the tag must point at a commit that's actually on `main`.
