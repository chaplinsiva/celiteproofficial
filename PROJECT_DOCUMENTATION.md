# CelitePro — Technical Documentation

> **Last Updated:** July 1, 2026  
> **Domain:** [celitepro.com](https://celitepro.com) / [celitepro.in](https://celitepro.in)  
> **Product:** Wedding Invitation Video Maker — SaaS Platform

---

## 1. Project Overview

CelitePro is a SaaS platform that allows users to create professional wedding invitation videos. Users pick a template, upload their photos, customize text, and the platform renders a studio-quality video using the **Plainly Videos** engine. The platform supports both **subscription-based** and **one-time purchase** monetization via **Razorpay**.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | **Next.js 16.1.3** (App Router) |
| Language | **TypeScript** |
| UI | **React 19**, **Tailwind CSS v4**, **Framer Motion** |
| Database / Auth | **Supabase** (PostgreSQL + Auth + RLS) |
| Object Storage | **Cloudflare R2** (S3-compatible) |
| Video Rendering | **Plainly Videos API** |
| Payments | **Razorpay** (Orders, Webhooks, Subscriptions) |
| Email | **Nodemailer** (Hostinger SMTP) |
| Icons | **Lucide React** |
| Notifications | **Sonner** (Toast) |
| Image Editing | **Cropperjs / React-Cropper** |
| Analytics | **Google Analytics** (G-F1MF9WDF1N) |

---

## 2. Directory Structure

```
celiteproofficial-main/
├── migrations/                    # SQL migration files
│   ├── 001_subscription_plans.sql
│   └── 002_one_time_render.sql
├── public/                        # Static assets (favicon, logo, SVGs)
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── layout.tsx             # Root layout (fonts, SEO, analytics, Razorpay script)
│   │   ├── page.tsx               # Home page (Hero, HowItWorks, Templates, FAQ)
│   │   ├── globals.css            # Tailwind import + custom animations
│   │   ├── robots.ts              # Dynamic robots.txt
│   │   ├── sitemap.ts             # Dynamic sitemap (static + template pages)
│   │   ├── about/                 # About page
│   │   ├── admin/                 # Admin dashboard & sub-pages
│   │   │   ├── page.tsx           # Main admin dashboard (renders, subscriptions, sales)
│   │   │   ├── seo/               # SEO management page
│   │   │   └── templates/         # Template CRUD (list, new, edit)
│   │   ├── api/                   # API Routes (see Section 5)
│   │   │   ├── admin/             # Admin APIs (dashboard, cron, SEO, templates, upload)
│   │   │   ├── health/            # Health check endpoint
│   │   │   ├── notifications/     # User notification APIs
│   │   │   ├── payment/           # Payment flow (create-order, verify, webhook, config)
│   │   │   ├── projects/          # Project CRUD
│   │   │   ├── render/            # Render orchestration (start, status, sample, retry, download)
│   │   │   ├── subscription/      # Subscription management (plans, create, verify, cancel, cleanup)
│   │   │   ├── templates/         # Public template data API
│   │   │   └── user/              # User utilities (upload, remove-bg, proxy-image)
│   │   ├── checkout/              # Checkout flow page
│   │   ├── dashboard/             # User dashboard
│   │   ├── login/                 # Login page
│   │   ├── payment/               # Payment pages
│   │   ├── pricing/               # Pricing page
│   │   ├── privacy/               # Privacy policy
│   │   ├── render/                # Render status/download page
│   │   ├── signup/                # Signup page
│   │   ├── templates/             # Template listing & detail ([slug])
│   │   └── terms/                 # Terms of service
│   ├── components/                # Reusable UI components
│   │   ├── Footer.tsx
│   │   ├── Header.tsx             # Context-aware navigation
│   │   ├── Hero.tsx               # Landing page hero section
│   │   ├── HowItWorks.tsx         # Steps/tutorial section
│   │   ├── Notifications.tsx      # In-app notification system
│   │   ├── TemplateListing.tsx    # Template grid/browser
│   │   ├── VideoShowcase.tsx      # Video demo section
│   │   └── layout/
│   │       └── LayoutClient.tsx   # Client-side layout wrapper
│   ├── lib/                       # Server-side utilities & integrations
│   │   ├── json-ld.ts             # Organization schema structured data
│   │   ├── mailer.ts              # Email service (render complete, welcome, retention)
│   │   ├── plainly.ts             # Plainly Videos API client (project/template/render CRUD)
│   │   ├── r2.ts                  # Cloudflare R2 storage client (upload, download, presign, delete)
│   │   ├── razorpay.ts            # Razorpay utilities (instance, verify, config from DB)
│   │   ├── render-processor.ts    # Core render orchestration engine (14-step pipeline)
│   │   ├── seo.ts                 # SEO data fetchers (page & template)
│   │   ├── supabase-admin.ts      # Admin Supabase client + auth helpers + free limits
│   │   └── supabase.ts            # Browser Supabase client (anon key)
│   └── middleware.ts              # Edge middleware (pass-through, client-side auth)
├── .env                           # Environment variables
├── next.config.ts                 # Security headers (HSTS, CSP, X-Frame-Options, etc.)
├── package.json
└── tsconfig.json
```

---

## 3. Core Architecture

### 3.1 Video Rendering Pipeline

The rendering pipeline is the heart of the platform. It is orchestrated by `render-processor.ts` and follows a **14-step process**:

```
User Request → Auth Check → Credit Validation → Create Render Job (DB)
    → Create Plainly Project (from template ZIP) → Wait for Analysis
    → Create Dynamic Template (layer bindings) → Sign Asset URLs
    → Start Render → Wait for Completion → Transfer Video to R2 CDN
    → Transfer Thumbnails → Mark Completed → Deduct Credits
    → Send Email Notification → Cleanup Plainly Resources
```

**Key integrity guarantees:**
- Credits are **only deducted after** confirmed successful render + CDN upload
- Failed renders **never** consume credits
- Videos are **always** stored on Cloudflare R2 — Plainly URLs are never exposed
- Idempotency guard prevents duplicate renders on page refresh

### 3.2 Authentication Model

- **Client-side auth** using `@supabase/supabase-js` with **localStorage** token storage
- Edge Middleware is **pass-through** — cannot access localStorage
- API routes extract Bearer tokens from `Authorization` header
- Admin verification via `admins` table lookup after user auth
- Protected routes: `/dashboard`, `/admin`, `/render`, `/checkout`

### 3.3 Payment System

Two monetization models:

| Model | Flow |
|-------|------|
| **Subscription** | Plans page → Razorpay order → Payment modal → Webhook verify → Activate subscription |
| **One-Time Purchase** | Template page → Create order → Pay → Verify → Issue template entitlement credits |

- Razorpay credentials stored in `razorpay_config` DB table (not env vars)
- Payment signature verification uses `crypto.timingSafeEqual` (timing-attack safe)
- Webhook endpoint for async payment confirmation

### 3.4 Storage Architecture (Cloudflare R2)

| Bucket Path | Content |
|-------------|---------|
| `/logos/` | Brand assets, UI images |
| `/templates/` | After Effects project ZIP files |
| `/renders/` | Final output MP4 files |
| `/thumbnails/` | Render thumbnail JPGs |
| `/user-uploads/` | User-uploaded media |

- **Bucket:** `celitepro`
- **Public CDN:** `https://files.celitepro.in`
- Private assets use **presigned URLs** (1-hour expiry)

---

## 4. Database Schema

### 4.1 Core Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles (auto-created via trigger on signup) |
| `admins` | Admin access control |
| `templates` | Video template catalog (slug, source_url, placeholders, pricing) |
| `projects` | User's saved editor configurations (template_id + JSONB config) |
| `render_jobs` | Render job tracking (status, parameters, output URLs, credits) |
| `subscription_plans` | Available subscription tiers (Basic/Business/Enterprise × Monthly/Yearly) |
| `user_subscriptions` | Active user subscriptions (plan, credits used, valid dates) |
| `user_template_entitlements` | One-time purchase credits per template |
| `razorpay_config` | Payment gateway credentials (key, secret, webhook secret, single-pay amount) |
| `site_seo` | Per-page SEO metadata (title, description, keywords, og_image) |
| `site_settings` | Global site configuration |
| `user_logs` | Activity logging (free_preview, etc.) |
| `file_assets` | File tracking for retention policy |

### 4.2 Subscription Plans

| Plan | Billing | Price/mo | Render Limit | Storage |
|------|---------|----------|-------------|---------|
| Basic | Monthly | ₹899 | 10 | 10 GB |
| Business | Monthly | ₹1,499 | 20 | 50 GB |
| Enterprise | Monthly | ₹5,499 | Unlimited | 100 GB |
| Basic | Yearly | ₹699/mo | 120/yr | 10 GB |
| Business | Yearly | ₹1,199/mo | 240/yr | 50 GB |
| Enterprise | Yearly | ₹4,499/mo | Unlimited | 100 GB |

### 4.3 Row Level Security (RLS)

- **profiles:** Users see only their own profile
- **projects:** `user_id = auth.uid()`
- **render_jobs:** Tied to authenticated user
- **subscription_plans:** Public read for active plans
- **user_subscriptions:** Users see own; service role manages all
- **user_template_entitlements:** Users see own; service role manages all
- **site_settings:** RLS enabled

### 4.4 Database Functions (RPCs)

| Function | Purpose |
|----------|---------|
| `decrement_free_previews(p_user_id)` | Atomically decrement free preview count |
| `increment_renders_used(p_subscription_id, p_cost)` | Atomically increment subscription render usage |
| `decrement_entitlement_credits(p_entitlement_id, p_cost)` | Atomically deduct one-time purchase credits |

---

## 5. API Route Reference

### Render APIs
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/render` | Start a full HD render job |
| POST | `/api/render/sample` | Start a free preview/sample render |
| GET | `/api/render/status` | Poll render job status |
| POST | `/api/render/retry` | Retry a failed render |
| GET | `/api/render/download` | Get download URL for completed render |

### Payment APIs
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/payment/create-order` | Create Razorpay order (one-time) |
| POST | `/api/payment/verify-payment` | Verify payment signature |
| POST | `/api/payment/webhook` | Razorpay webhook handler |
| GET | `/api/payment/config` | Get Razorpay key ID for frontend |

### Subscription APIs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/subscription/plans` | List available plans |
| POST | `/api/subscription/create-order` | Create subscription order |
| POST | `/api/subscription/verify-payment` | Verify subscription payment |
| GET | `/api/subscription/status` | Get user's subscription status |
| POST | `/api/subscription/cancel` | Cancel subscription |
| POST | `/api/subscription/cleanup` | Cleanup expired subscriptions |
| POST | `/api/subscription/recover-payment` | Recover failed payments |

### Project APIs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/projects` | List or save user projects |
| GET/PUT/DELETE | `/api/projects/[id]` | Get, update, or delete a project |

### Admin APIs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/dashboard` | Admin dashboard statistics |
| GET/POST | `/api/admin/templates` | Template CRUD |
| GET/POST | `/api/admin/seo` | SEO metadata management |
| POST | `/api/admin/upload` | Upload files to R2 |
| POST | `/api/admin/cron` | Scheduled tasks |

### User Utility APIs
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/user/upload` | Upload user media to R2 |
| POST | `/api/user/remove-bg` | AI background removal |
| GET | `/api/user/proxy-image` | Proxy external images |

### Other APIs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/notifications` | Fetch user notifications |
| POST | `/api/notifications/mark-viewed` | Mark notifications as read |

---

## 6. Frontend Pages

| Route | Type | Description |
|-------|------|-------------|
| `/` | SSR | Landing page (Hero, HowItWorks, Templates, VideoShowcase, FAQ) |
| `/templates` | Client | Template browsing/filtering page |
| `/templates/[slug]` | SSR | Template detail + editor page (dynamic SEO) |
| `/login` | Client | Supabase auth login |
| `/signup` | Client | Supabase auth signup |
| `/dashboard` | Client | User dashboard (projects + render history) |
| `/checkout` | Client | Payment checkout flow |
| `/render/[id]` | Client | Render status viewer + download |
| `/pricing` | Client | Subscription plans page |
| `/admin` | Client | Admin dashboard (stats, renders, subscriptions, purchases) |
| `/admin/templates` | Client | Template management (list, create, edit) |
| `/admin/seo` | Client | Site-wide SEO management |
| `/about` | Static | About page |
| `/privacy` | Static | Privacy policy |
| `/terms` | Static | Terms of service |
| `/payment` | Client | Payment processing pages |

---

## 7. Third-Party Integrations

### 7.1 Plainly Videos
- **Purpose:** Server-side After Effects video rendering
- **Auth:** Basic Auth (API key as username, empty password)
- **Base URL:** `https://api.plainlyvideos.com/api/v2`
- **Flow:** Create project from ZIP → Wait for analysis → Create template with layer bindings → Start render → Poll status → Download output
- **Cleanup:** Projects and renders are deleted after completion to avoid orphan accumulation
- **Layer convention:** `render` comp → `img1` comp → `img1` layer (images); `text1` directly in render comp (text)

### 7.2 Razorpay
- **Credentials:** Stored in `razorpay_config` Supabase table
- **Signature verification:** HMAC-SHA256 with `timingSafeEqual`
- **Default single-pay amount:** ₹699 (69900 paise)
- **Frontend SDK:** Loaded via `<script>` in root layout

### 7.3 Cloudflare R2
- **SDK:** `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`
- **Operations:** Upload, download (presigned), delete, public URL generation
- **Bucket:** `celitepro`

### 7.4 Email (Nodemailer)
- **SMTP:** Hostinger (`smtp.hostinger.com:587`)
- **Templates:** Render completion, subscription welcome, file retention warning
- **Concurrency guard:** `email_sent` flag prevents duplicate emails
- **Design:** Dark-themed HTML emails with CelitePro branding

---

## 8. Security Configuration

### Next.js Security Headers (`next.config.ts`)
- **HSTS:** 2-year max-age with preload
- **X-Frame-Options:** DENY
- **X-Content-Type-Options:** nosniff
- **Referrer-Policy:** strict-origin-when-cross-origin
- **CSP:** Restrictive policy allowing Razorpay, Supabase, Google Fonts, R2

### Auth Security
- Bearer token validation on all authenticated API routes
- Admin verification via `admins` table (not role-based)
- Presigned URLs for private asset access (1-hour expiry)

---

## 9. Environment Variables Reference

| Variable | Scope | Purpose |
|----------|-------|---------|
| `PLAINLY_API_KEY` | Server | Plainly Videos API authentication |
| `SUPABASE_ANON_KEY` | Server | Supabase anonymous key (server-side) |
| `SUPABASE_SERVICE_SECRET` | Server | Supabase service role key (admin) |
| `SUPABASE_PROJECT_ID` | Server | Supabase project identifier |
| `S3_ENDPOINT` | Server | Cloudflare R2 S3-compatible endpoint |
| `S3_ACCESS_KEY_ID` | Server | R2 access key |
| `S3_SECRET_ACCESS_KEY` | Server | R2 secret key |
| `NEXT_PUBLIC_SUPABASE_URL` | Client | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client | Supabase anon key for browser |
| `NEXT_PUBLIC_S3_URL` | Client | Public CDN URL for R2 assets |
| `PUBLIC_URL_S3` | Server | R2 public URL (server-side alias) |
| `BG_REMOVER_API` | Server | Background removal API key |
| `BG_REMOVER_URL` | Server | Background removal API endpoint |
| `SMTP_HOST` | Server | Email SMTP host |
| `SMTP_PORT` | Server | Email SMTP port |
| `SMTP_USER` | Server | SMTP username |
| `SMTP_PASSWORD` | Server | SMTP password |
| `EMAIL_FROM` | Server | Sender email address |
| `EMAIL_FROM_NAME` | Server | Sender display name |
| `NEXT_PUBLIC_SITE_URL` | Client | Public site URL |

---

## 10. SEO Implementation

- **Dynamic metadata:** Per-page SEO from `site_seo` table via `getPageSEO()`
- **Template SEO:** `meta_title`, `meta_description`, `keywords` from `templates` table
- **JSON-LD:** Organization schema in root layout
- **Sitemap:** Dynamic (`/sitemap.xml`) — static pages + all active templates
- **Robots.txt:** Allow all, disallow `/admin/`
- **Open Graph & Twitter Cards:** Configured in root layout metadata
- **Google Analytics:** Tag `G-F1MF9WDF1N`

---

## 11. Free Tier Limits

| Feature | Free Limit | Reset Period |
|---------|-----------|-------------|
| Preview renders | 10 | 30 days |
| Background removals | 3 | 24 hours |
| File retention | 7 days | N/A (auto-deleted) |

---

*This document is auto-maintained. See `CHANGELOG.md` for a record of all modifications.*
