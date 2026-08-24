---
agent-notes:
  ctx: "codebase structural overview for CelitePro"
  deps: []
  state: complete
  last: "coordinator@2026-08-24"
  key: ["UPDATE when adding packages, modules, or changing public APIs"]
---
# Code Map — CelitePro

Structural overview of the CelitePro codebase. Use this to orient yourself before diving into code.

---

## Architecture at a Glance

```
Client (Next.js 16 App Router / React 19)
  │
  ├─── Auth / Data ───► Supabase (PostgreSQL + RLS + Auth)
  │
  ├─── Storage ────────► Cloudflare R2 (S3 API: /renders, /thumbnails, /templates)
  │
  ├─── Payments ───────► Razorpay (Subscriptions & One-Time Entitlements)
  │
  └─── Rendering ──────► Plainly Videos Engine (AE Project Zip -> Render -> R2 Transfer)
```

---

## Directory Structure & Modules

| Module / Directory | Purpose | Key Files & Responsibilities |
|---|---|---|
| `src/app/` | Next.js App Router | Pages: `/`, `/templates`, `/dashboard`, `/admin`, `/checkout`, `/render`, `/pricing`, `/login`, `/signup` |
| `src/app/api/` | Backend REST API routes | `/api/render/*`, `/api/payment/*`, `/api/subscription/*`, `/api/admin/*`, `/api/projects/*` |
| `src/lib/render-processor.ts` | Video Render Engine | 14-step orchestration with Plainly API and R2 upload |
| `src/lib/r2.ts` | Object Storage | Cloudflare R2 client (presign, upload, delete, transfer) |
| `src/lib/razorpay.ts` | Payment Integration | Razorpay order creation, config loader, webhook validation |
| `src/lib/supabase.ts` | Client-side DB Client | Browser Supabase client (anon key) |
| `src/lib/supabase-admin.ts` | Server-side DB Client | Service role Supabase client for auth & admin operations |
| `src/lib/mailer.ts` | Email Delivery | Nodemailer SMTP client for notifications & delivery |
| `src/components/` | UI Components | Header, Footer, Hero, HowItWorks, TemplateListing, VideoShowcase |
| `migrations/` | Database Migrations | SQL schema migrations |

---

## Key Data Flow

```
1. Template Selection & Customization
   User selects template -> Configures text & media -> Saved to `projects` table

2. Order & Payment Flow
   User triggers purchase -> Razorpay Order created -> Payment modal -> Verification -> Entitlement credit issued

3. Rendering Pipeline
   Render requested -> Credit verified -> Render job queued -> Plainly renders -> Transferred to Cloudflare R2 -> Credits deducted -> Mailer notifies user
```
