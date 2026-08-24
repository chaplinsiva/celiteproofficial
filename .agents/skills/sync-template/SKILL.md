---
name: sync-template
description: Reapply vteam-hybrid template evolutions to this repo.
---

<!-- agent-notes: { ctx: "reapply vteam-hybrid template evolutions to in-flight repo", deps: [AGENTS.md], state: active, last: "grace@2026-02-15" } -->
Reapply vteam-hybrid template evolutions to this repo.

**Template source:** `$ARGUMENTS`

If no path is provided, ask the user: "Where is your vteam-hybrid template repo? (e.g., `/home/user/dev/vteam-hybrid` or a GitHub URL)"

This skill syncs template improvements (agent definitions, commands, doc templates, AGENTS.md sections) from the vteam-hybrid template into an in-flight project. It is designed to be **non-destructive** — it will not overwrite project-specific content.

---

## What gets synced (safe to overwrite)

These files are template-standard and don't contain project-specific content:

### 1. Agent definitions
Copy all `.agents/agents/*.md` from the template to this repo, and remove any template agents that were removed or renamed in the framework:
```bash
cp <template>/.agents/agents/*.md .agents/agents/
```
Then, compare the `.agents/agents/` directories. If there are agents in this repo that do not exist in the template, determine if they are custom project-specific agents or deprecated template agents. Delete the deprecated template agents to keep the repo clean. When in doubt, ask the user before deleting.

These define agent personas, responsibilities, and tooling. They don't contain project-specific state.

### 2. Skill definitions
Copy all `.agents/skills/*` from the template to this repo, and remove any template skills that were removed or renamed in the framework:
```bash
cp -r <template>/.agents/skills/* .agents/skills/
```
Then, compare the `.agents/skills/` directories. If there are skills in this repo that do not exist in the template, determine if they are custom project-specific skills or deprecated template skills. Delete the deprecated template skills to keep the repo clean. When in doubt, ask the user before deleting.

**Exception:** If this repo has project-specific skill modifications (e.g., a customized `tdd.md` with project-specific test patterns), note them to the user before overwriting. Check `git diff` after copy to verify.

### 3. Doc templates (new files only)
Create any doc directories and template files that don't exist yet. **Do not overwrite existing docs** — they may contain project data.

Check for and create if missing:
- `docs/scaffolds/threat-model.md` → `docs/security/threat-model.md` (copy from template, mkdir -p)
- `docs/scaffolds/performance-budget.md` → `docs/performance-budget.md` (copy from template)
- `docs/scaffolds/test-strategy.md` → `docs/test-strategy.md` (copy from template)
- `docs/scaffolds/tech-debt.md` → `docs/tech-debt.md` (copy from template)
- `docs/scaffolds/config-manifest.md` → `docs/config-manifest.md` (copy from template)
- `docs/scaffolds/runbook-template.md` → `docs/runbooks/template.md` (copy from template, mkdir -p)
- `docs/scaffolds/sbom.md` → `docs/sbom/sbom.md` (copy from template, mkdir -p)
- `docs/scaffolds/dependency-decisions.md` → `docs/sbom/dependency-decisions.md` (copy from template, mkdir -p)
- `CHANGELOG.md` (copy from template)

For each: `mkdir -p <dir>` then copy only if the file doesn't already exist.

---

## What needs manual merging (AGENTS.md)

AGENTS.md contains both template sections and project-specific content. It cannot be blindly overwritten. Instead, diff and merge:

1. **Read the template's AGENTS.md** and this repo's AGENTS.md.
2. **Identify new sections** in the template that don't exist here. Add them.
3. **Identify updated sections** in the template. For each:
   - If the section here is unmodified from the original template → replace with the new version.
   - If the section here has project-specific modifications → merge carefully, preserving project content.
4. **Sections that are always project-specific** (never overwrite):
   - Project Overview
   - GitHub Project Board Integration (board URL, project number)
   - Known Patterns and Gotchas
   - Any project-specific Critical Rules (e.g., "Don't Skip the Done Gate")
   - During Development (Per Work Item) workflow customizations
5. **Sections that are always template-standard** (safe to replace):
   - Agent-Notes Protocol
   - Hybrid Team Methodology (phase table, capability roster)
   - Development Philosophy
   - Adversarial Debate Protocol
   - Agent Voice and Personality
   - Tiered Communication Protocol
   - Parallel Agent Teams
   - Conventions
6. **Sections that need careful merge** (template structure + project additions):
   - Critical Rules (template rules + project-specific rules)
   - Persona Triggers table
   - Done Gate checklist
   - Project Structure tree
   - Custom Skills table
   - Workflow sections

**Report to the user:** After merging, show a summary of what changed in AGENTS.md so they can verify.

---

## What is NOT synced (kickoff-only concerns)

These are only relevant at project creation and should be skipped:
- Kickoff Phase 1-2 changes (Cam elicitation, Dani sacrificial concepts) — already happened.
- Initial project board creation — board already exists.
- Initial sprint setup — sprints are already in flight.

---

## Post-sync checklist

After syncing:

1. **Verify agent files:** `ls .agents/agents/` — confirm all agents are present.
2. **Verify skill files:** `ls .agents/skills/` — confirm new skills (sprint-boundary, pin-versions, sync-template) are present.
3. **Verify doc templates:** Check that new directories exist under `docs/`.
4. **Review AGENTS.md diff:** `git diff AGENTS.md` — verify project-specific content was preserved.
5. **Commit:** `git add -A && git commit -m "chore: sync vteam-hybrid template evolutions"`
6. **Report:** Summarize what was added/updated to the user.
