<!-- For a human-readable overview, see README.md and docs/template-guide.md -->
# AGENTS.md — Project Instructions for Antigravity

## Project Overview

**Project Name:** CelitePro  
**Domain:** [celitepro.com](https://celitepro.com) / [celitepro.in](https://celitepro.in)  
**Description:** Wedding Invitation Video Maker SaaS Platform — automated personalized video rendering, template customization, authentication, and payments.  
**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Framer Motion, Supabase (PostgreSQL, Auth, RLS), Cloudflare R2 (S3 API), Plainly Videos API, Razorpay.

**Codebase map:** `docs/code-map.md` — read this first to understand the package structure, public APIs, and data flow.  
**Detailed Technical Documentation:** `PROJECT_DOCUMENTATION.md` — full system architecture, database schema, and operational runbooks.

---

## Core Architectural Reference

### 1. Video Rendering Pipeline (`src/lib/render-processor.ts`)
- 14-step orchestration: User Request -> Auth Check -> Credit Validation -> Plainly Project Creation -> Layer Bindings -> Video Render -> Cloudflare R2 Upload -> Credit Deduction -> Email Notification.
- **Integrity Guarantee:** Credits are **only** deducted after verified render + R2 CDN transfer. Failed renders never deduct credits.

### 2. Authentication & Security
- Client-side auth with `@supabase/supabase-js` (stored in `localStorage`).
- Server API routes validate Bearer token in `Authorization` header via `src/lib/supabase-admin.ts`.
- Admin routes verified via `admins` table lookup.

### 3. Payment Processing (`src/lib/razorpay.ts`)
- Dual model: Subscriptions (`user_subscriptions`) + One-time template purchase (`user_template_entitlements`).
- Razorpay credentials and pricing settings loaded from the `razorpay_config` database table.
- Signatures verified with `crypto.timingSafeEqual`.

### 4. Storage (Cloudflare R2 via `src/lib/r2.ts`)
- Bucket: `celitepro`, Public CDN: `https://files.celitepro.in`
- Storage paths: `/logos/`, `/templates/`, `/renders/`, `/thumbnails/`, `/user-uploads/`.

---

## Agent-Notes Protocol (MANDATORY)

Every non-excluded file must have agent-notes metadata. See `docs/methodology/agent-notes.md` for spec.

1. Every new file gets agent-notes (excluded: pure JSON, lock files, binaries).
2. Every edit updates `last` to `<agent>@<date>`.
3. `ctx` under 10 words, `deps` = direct deps only, `state` must be accurate.

---

## Rules & Team Process

Detailed rules for team methodology, critical agent workflows, and the documentation index are located in:
- `.agents/rules/development-workflow.md` — TDD, commits, branching, PRs.
- `.agents/rules/session-management.md` — Context management and session boundaries.
- `.agents/rules/team-process.md` — Agent roles, board tracking, and architecture decisions.
