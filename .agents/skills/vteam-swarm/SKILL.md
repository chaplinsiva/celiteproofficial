---
name: vteam-swarm
description: Break down a task and execute it in parallel using worktrees
---

<!-- agent-notes: { ctx: "Parallel task execution workflow", deps: [.agents/agents/orchestrator/agent.md], state: active, last: "system@2026-08-05" } -->
Break down and execute in parallel: $ARGUMENTS

## Step 1: Trigger the Orchestrator
Spawn the `orchestrator` agent as a subagent using the `invoke_subagent` tool, passing it the task `$ARGUMENTS`. 

## Step 2: The Orchestrator's Job
The Orchestrator will:
1. Break the task into independent features or components.
2. Spawn multiple subagents (like Sato, Tara, Dani) concurrently.
3. Set `Workspace: "share"` for all subagents to isolate them in parallel Git worktrees (per the new workflow rules).
4. Coordinate their work as they each push their branches and create PRs.

## Step 3: Monitor and Merge
Wait for the Orchestrator to report back that all parallel PRs have been created and reviewed. You can then review the PRs with the user and execute the merges.
