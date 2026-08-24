---
trigger: model_decision
description: Use this rule when managing conversation context, organizing sprints, planning waves, or handing off to a new session.
---

## Session Management

**Context is finite.** To avoid mid-sprint context exhaustion:

1. **Plan waves before executing.** Break issues into waves by size/dependency. Document in `docs/sprints/sprint-N-plan.md`.
2. **One wave per session.** Execute a wave, commit, then run `/handoff`. Start the next wave fresh.
3. **Background agents write to files.** Use `run_in_background: true`. Read summaries, not full output.
4. **Read `docs/code-map.md` first.** Orient from the map, not from scratch.
5. **Commit frequently.** Uncommitted work is the most expensive thing to reconstruct.
6. **Tracking artifacts carry phase context.** See `docs/process/tracking-protocol.md`.
