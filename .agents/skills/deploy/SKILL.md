---
name: deploy
description: Dynamically generate deployment infrastructure for the MVP.
---

<!-- agent-notes: { ctx: "dynamic MVP deployment config generator", deps: [AGENTS.md], state: active, last: "ines@2026-08-01" } -->
Dynamically generate deployment infrastructure when a project is MVP-ready.

This skill is owned by Ines (DevOps). When invoked, analyze the current project's tech stack and automatically generate the appropriate deployment configuration.

## Steps

1. **Analyze the Stack**: Look at the current repository to determine what is being built:
   - Is there a `package.json`? (Node.js/Next.js/React/Vite)
   - Is there a `pyproject.toml` or `requirements.txt`? (Python/FastAPI/Flask)
   - Is there a `Cargo.toml`? (Rust)
   - Is there a `Dockerfile` already?

2. **Generate MVP Infrastructure**: Based on the stack, generate ONE of the following (if not already present):
   - A standard `Dockerfile` appropriate for the language.
   - A `.github/workflows/deploy.yml` for basic CI/CD (e.g. testing and building).
   - If it's a static site or Next.js app, provide `vercel.json` or equivalent simple deployment config.

3. **Provide Instructions**: Write an Antigravity UI Artifact (`deployment_guide.md`) in the `<appDataDir>/brain/<conversation-id>/` directory summarizing what was generated and providing the user with exact commands to deploy their MVP (e.g., `docker build ...` or `vercel deploy`).

## Considerations

- Do not over-engineer. This is for an MVP. Focus on the simplest path to production (e.g., standard Dockerfile, basic GitHub Actions).
- If the user provides specific arguments (e.g., `/deploy to AWS`), invoke the `aws-review` skill or adapt the deployment generation for that specific cloud provider.
