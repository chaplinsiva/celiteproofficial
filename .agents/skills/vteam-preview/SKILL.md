---
name: vteam-preview
description: Run an orchestrated multi-agent session to preview a feature.
---

<!-- agent-notes: { ctx: "multi-agent feature preview orchestration", deps: [docs/methodology/personas.md, AGENTS.md], state: active, last: "grace@2026-08-01" } -->
Run a multi-agent orchestrated preview session for an MVP feature.

When this skill is invoked, act as the **Orchestrator Agent**. Your job is to invoke multiple specialist agents (personas) to evaluate the feature together and synthesize their feedback.

## 1. Persona Invocation

As the orchestrator, you must simulate the invocation of the following agents sequentially:

- **Dani (Design/UX/A11y):** Review the UI/UX. Is the interface intuitive? Are there accessibility issues? Does it look polished?
- **Vik (Code Quality):** Review the architecture and code structure. Are there performance bottlenecks or overly complex abstractions?
- **Pierrot (Security):** Review the security posture. Are there exposed secrets, XSS vectors, or auth issues?

*(See `docs/methodology/personas.md` for full persona definitions).*

## 2. Execution

Review the current state of the MVP or the specific feature requested: `$ARGUMENTS`.
If no feature is specified, review the current working directory's overall state.

- Analyze the frontend code (if applicable) for Dani's review.
- Analyze the backend and core logic for Vik and Pierrot's reviews.

## 3. Review Artifact Generation

Synthesize the feedback from all three invoked personas into a single, cohesive Antigravity UI Artifact.

Use the `write_to_file` tool to create `teamwork_preview.md` in the `<appDataDir>/brain/<conversation-id>/` directory with `ArtifactMetadata` (`UserFacing: true`).

Use Antigravity's rich UI components:
- Use **Carousels** to present each persona's specific findings sequentially.
- Use **GitHub Alerts** (`> [!WARNING]`, `> [!IMPORTANT]`) to highlight Critical findings from Pierrot (security) or Vik (performance).
- Create a concluding **Action Items** section summarizing what needs to be fixed.

## Tracking Artifact (task.md)

After the review is complete, update the `task.md` artifact (if one exists in the `<appDataDir>/brain/<conversation-id>/` directory) to mark the preview step as completed (`[x]`), or add any critical action items to the task list.
