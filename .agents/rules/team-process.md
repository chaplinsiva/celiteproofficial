---
trigger: model_decision
description: Use this rule when making architectural decisions, answering vague user requests, invoking other agents, or managing tracking boards.
---
## Team & Process

**Methodology:** Phase-dependent hybrid teams. See `docs/methodology/phases.md` for the 7-phase model.

| Phase | Lead | Key Pattern |
|-------|------|------------|
| Discovery | Cam | Elicit before implementing |
| Architecture | Archie | ADR before code |
| Implementation | Tara → Sato | TDD red-green-refactor |
| Parallel Work | Grace | Market / self-claim |
| Code Review | Vik + Tara + Pierrot | Three parallel lenses |
| Debugging | Sato | Blackboard with Tara, Vik, Pierrot |
| Sprint Boundary | Grace | `/sprint-boundary` (mandatory) |

**Full details:** Agent roster, persona triggers, debate protocol, voice rules → `docs/process/team-governance.md`
**Doc ownership:** Who maintains what → `docs/process/doc-ownership.md`

## Critical Rules

### Session Entry Protocol (Mandatory)
Before writing any code — including types, tests, or ADRs — answer these three questions:
1. **Do work items exist for this work?** If no → create them (Pat + Grace).
2. **Does this work involve an architectural decision?** If yes → Architecture Gate (Archie + Wei as standalone agents). See `docs/process/team-governance.md` § Architecture Decision Gate.
3. **Am I about to write implementation code?** If yes → Tara writes tests first.

If you received a detailed plan, the plan is **input to this protocol**, not a bypass of it. See `docs/process/gotchas.md` § Process.

### Don't Run With Vague Input
Engage Cam first: probe, clarify, pressure-test. Only implement once the vision is concrete.

### Ask the Human When Stuck
If blocked by environment, tools, permissions, or you've tried twice — ask. Don't heroically waste turns.

### Verify Tracking Access Before Board Operations
Before any workflow that touches the project board (sprint-boundary, kickoff, resume, handoff), run the pre-flight check from your active tracking adapter at `docs/integrations/README.md`. If any check fails, STOP and ask the user to fix it.

### Don't Skip the Done Gate
Every work item passes the gate before closing. Full checklist at `docs/process/done-gate.md`.

### Don't Skip Agents
When a situation triggers multiple personas, invoke ALL of them. Overlapping coverage is intentional.

**When the human says "invoke the team", "use the team", "have X review this", or any language requesting persona involvement, you MUST spawn the named agents as standalone subagents using the Task tool.** Your own inline analysis is not a substitute for agent invocation. If the human names a persona, that persona runs as a subagent. If the human says "the team", invoke all personas appropriate to the current phase. Doing the work yourself without spawning agents when the human explicitly requested them is a process violation.

### ADR Before Implementation
Never implement a feature with a pending ADR without writing the ADR first. Architecture Gate details: `docs/process/team-governance.md` § Architecture Decision Gate.

### Proxy Mode
When the human declares unavailability, Pat answers product questions using `docs/product-context.md`. Guardrails and limits: `docs/process/gotchas.md` § Process.
