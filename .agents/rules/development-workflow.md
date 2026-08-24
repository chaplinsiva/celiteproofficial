---
trigger: model_decision
description: Use this rule when you are starting a new task, writing code, executing TDD, making commits, or preparing a pull request.
---

## Development Workflow

### Per Work Item
1. **Start** — Move issue to **"In Progress"** on the board. Create a new worktree for the issue (`git worktree add -b feature/issue-N .worktrees/feature-issue-N`). Do this BEFORE writing any code.
2. **TDD** — Red → Green → Refactor. M+ items: Tara writes failing tests first as standalone agent.
3. **Commit** — One commit per issue, conventional message, `Closes #N`. Push the worktree's branch to origin.
4. **PR & Review** — Create a Pull Request (`gh pr create`). Move issue to **"In Review"** on the board. Then invoke code-reviewer (Vik + Tara + Pierrot). Fix Critical/Important findings on the branch.
5. **Done Gate** — Full checklist at `docs/process/done-gate.md`.
6. **Close** — Merge the PR (`gh pr merge`). Move issue to **"Done"** on the board. Remove the worktree (`git worktree remove .worktrees/feature-issue-N`) and pull updates in main (`git pull`).

**Status transitions are mandatory and ordered.** In Progress → In Review → Done. Skipping "In Review" is a process violation.

**STOP**: Do not start the next item until step 6 is complete.

### Commit Discipline
Commit and push after every reasonable chunk of work to your branch. One commit per issue. Conventional commits format. Never push directly to main.
