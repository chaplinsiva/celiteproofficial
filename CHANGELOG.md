# CelitePro — Change Log

> All notable changes to this project will be documented in this file.  
> Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

_No pending changes._

---

## [2026-07-01] — Maintenance Mode & Admin Settings

### Added
- **Admin Settings page** at `/admin/settings` — accessible from the "Settings" card on the admin dashboard.
- **Maintenance Mode toggle** — when ON, all non-admin users are redirected to a "Under Maintenance" page. Admins can still access everything.
- **Custom maintenance message** — editable from the settings page, displayed on the maintenance screen.
- **Middleware enforcement** — checks `site_settings.maintenance_mode` on every request; admin users bypass via JWT verification against the `admins` table.
- **Fail-open design** — if the DB check fails, users are NOT blocked (safe default).

### Database Required
- Create table `site_settings` with columns: `id` (uuid, default), `maintenance_mode` (boolean, default false), `maintenance_message` (text), `created_at`, `updated_at`.

## [2026-07-01] — Template Visibility Toggle

### Added
- **Public/Private toggle** in the admin template edit page header. Click the green "Public" or red "Private" button to toggle visibility. Saved via the existing `is_active` column — private templates are hidden from all user-facing pages.

---

## [2026-07-01] — Render Pipeline Debug Logging (Added & Removed)

### Added then Removed
- Temporary `[RENDER-DEBUG]`, `[SAMPLE-RENDER-DEBUG]`, and `[PROCESSOR-DEBUG]` structured logging was added to trace the full render pipeline, then removed in the same session.

---

## [2026-07-01] — Project Documentation

### Added
- Created `PROJECT_DOCUMENTATION.md` — comprehensive technical documentation covering architecture, database schema, API routes, integrations, security, and environment variables.
- Created `CHANGELOG.md` — this file, to track all future project modifications.

---

## [2026-06-27] — One-Time Render Purchase System

### Added
- `migrations/002_one_time_render.sql` — new `user_template_entitlements` table for one-time purchase credits.
- `one_time_price` and `is_premium` columns added to `templates` table.
- `decrement_entitlement_credits` atomic RPC function.
- `entitlement_id` column on `render_jobs` to link jobs to one-time purchases.
- RLS policies for `user_template_entitlements`.

### Changed
- `/api/render/route.ts` — render authorization now supports both subscription-based and entitlement-based credit checks with automatic fallback.
- `render-processor.ts` — credit deduction path updated to support entitlement-based deduction alongside subscriptions.
- Admin dashboard updated with One-Time Purchases tab, purchase history table, and 30-day sales/revenue trend chart.

---

## [2026-06-24] — Row Level Security & Performance

### Changed
- Enabled RLS on `site_settings` table.
- Media library image zoom adjustments in `ProductForm.jsx`.

---

## [2026-06-22] — SEO & Structured Data Enhancements

### Added
- `hasMerchantReturnPolicy` and `shippingDetails` properties in product JSON-LD schema.
- `brand` and `gtin` fields for Google Merchant Center compliance.

---

## [2026-06-18] — SEO Infrastructure

### Added
- Dynamic `sitemap.ts` — generates sitemap with static pages and active template entries.
- Dynamic `robots.ts` — programmatic robots.txt (allow all, disallow `/admin/`).
- JSON-LD structured data (`json-ld.ts`) for Organization schema.
- Per-page SEO metadata system (`seo.ts` + `site_seo` table).
- Open Graph image support for product/template social sharing.

---

## Baseline — Initial Platform

### Core Features
- Next.js 16 App Router with TypeScript.
- Supabase Auth (email/password) with client-side token storage.
- Plainly Videos integration for After Effects video rendering.
- Cloudflare R2 storage (upload, download, presigned URLs, CDN delivery).
- Razorpay payments (subscriptions + one-time purchases).
- Nodemailer email notifications (render complete, subscription welcome, retention warning).
- Admin dashboard with render monitoring, subscription tracking, and revenue analytics.
- Template management system (CRUD, media uploads, placeholder configuration).
- User dashboard with project management and render history.
- Free tier with 10 monthly previews and 3 daily background removals.
- Security headers (HSTS, CSP, X-Frame-Options, etc.).
- Google Analytics integration.

---

_Last updated: July 1, 2026_
