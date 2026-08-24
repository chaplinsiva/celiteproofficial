---
name: dev-server
description: Spin up a local development environment.
---

<!-- agent-notes: { ctx: "background dev server runner", deps: [AGENTS.md], state: active, last: "sato@2026-08-01" } -->
Spin up a local development environment.

This skill detects the project type and launches the appropriate development server in the background, allowing the user to preview the app without blocking the terminal.

## Steps

1. **Detect the Run Command**: Analyze the workspace to figure out how to start the app:
   - Next.js/Vite/Node: `npm run dev` or `npm start`
   - Python/FastAPI: `uvicorn main:app --reload`
   - Python/Flask: `flask run`
   - Rust: `cargo run`
   - Static HTML: `python3 -m http.server`

2. **Launch as Background Task**: 
   - Use the Antigravity `run_command` tool.
   - Set `WaitMsBeforeAsync` to a small value (e.g., 2000ms) so the task is sent to the background after starting up.
   - Do NOT run a command that blocks forever synchronously.

3. **Notify the User**:
   - Tell the user the server is running.
   - Provide the typical `http://localhost:<port>` URL based on the framework detected.
   - Remind the user they can use the `manage_task` tool (or you can do it for them) if they need to check the server logs or kill the task later.
