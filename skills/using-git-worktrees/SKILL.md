---
name: using-git-worktrees
description: Use when starting implementation work that should be isolated from the main checkout, when other agents may work in the same repository, and when landing finished work. Sets up a worktree, hands it off, lands with squash, rebase or a PR, and cleans up.
---

# Using git worktrees

## Set up

1. Check for an existing worktree for this work: `git worktree list`.
2. Pick a directory the project already uses for worktrees (look for `.worktrees/` or
   `worktrees/`, and confirm it is ignored by git); else use `../<repo>-worktrees/<branch>`.
3. Create it from an up-to-date base:

   ```sh
   git fetch origin
   git worktree add -b <branch> <dir> origin/<default-branch>
   ```

4. Install dependencies and run the test suite there before changing anything, so you know
   the baseline is green. A red baseline is reported, not ignored.

Other agents may be working in other worktrees: never touch a worktree or branch you did not
create, and never run commands that rewrite shared refs.

## Hand off

When pausing, record in the ledger (see **executing-specs**) the worktree path, the branch, and
the next step, so the next session resumes there.

## Land

Ask the person which way, defaulting to squash:

- **squash** - one commit on the default branch with a message describing the feature.
- **rebase** - keep the individual commits, replayed on the current default branch.
- **PR** - push the branch and open a pull request.
- **keep** - leave the branch as it is for later.

Never create a merge commit. Before landing, rebase on the latest default branch and run the
full test suite again; land only on green.

## Clean up

After the work landed (or the person chose to drop it), remove temporary worktrees and branches
you created: `git worktree remove <dir>` and `git branch -d <branch>`. Leave anything you did
not create.
