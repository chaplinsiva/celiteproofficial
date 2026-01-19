# CelitePro | Technical Documentation

This document provides a deep dive into the architecture, core mechanisms, and security model of the CelitePro Video Editor tool.

---

## 🏗 Core Architecture

### 1. Dynamic Video Rendering Pipeline
CelitePro does not use static templates. Instead, it creates projects on-the-fly to ensure every render is clean and isolated.
- **Project Creation**: For every render request, a temporary project is created in Plainly using the template ZIP from Cloudflare R2.
- **Parametrization**: Compositions and layers are identified programmatically during the initial analysis phase.
- **Logo Scaling**: Implements a dedicated scaling script to ensure logos (MEDIA) fit perfectly within their designated layers without distortion.
- **Cleanup**: Temporary projects and assets are purged post-completion to maintain infrastructure hygiene.

### 2. Project Persistence & State Management
The system supports full project lifecycle management:
- **Project Structure**: A project consists of a `template_id` and a `configuration` (JSONB) containing all user-edited images (R2 URLs) and text layers.
- **Auto-Save Mechanism**: To ensure data integrity, the editor triggers a silent save to the database before initiating the payment/render flow.
- **Dashboard Synchronization**: The dashboard fetches both active `projects` and past `render_jobs` in parallel, providing a unified view of user activity.

---

## 🔐 Security & Data Model (Supabase)

### 1. Row Level Security (RLS)
Security is enforced at the database level using PostgreSQL RLS policies:
- **Projects**: `(user_id = auth.uid())` ensures users only see and edit their own creative work.
- **Admins**: A restricted `admins` table controls access to the administrative dashboard.
- **Render Jobs**: Tied strictly to the authenticated user's ID.

### 2. Tables & Triggers
- **`projects`**: Central storage for user edits and template references.
- **`render_jobs`**: Logs the status (`pending`, `processing`, `completed`, `failed`) and output URLs.
- **`profiles`**: Automatically populated via a database trigger whenever a new user signs up.
- **`updated_at` Trigger**: Standard trigger applied across all tables for accurate timestamp tracking.

---

## 🔗 Integration Points

### Storage (Cloudflare R2)
- **Base URL**: Managed via `NEXT_PUBLIC_S3_URL` and `PUBLIC_URL_S3` to avoid hardcoding.
- **Bucket Layout**:
    - `/logos/`: Branding and UI assets.
    - `/templates/`: After Effects project ZIPs.
    - `/renders/`: Final output MP4 files.

### Payments (Razorpay)
- **Flow**: Order Creation (Server) -> Payment Modal (Client) -> Webhook Confirmation (Server) -> Render Trigger.

### Video Engine (Plainly)
- **API**: Communicates over REST for project creation, template analysis, and render job status tracking.

---

## 📂 Key Implementation Files

- `src/app/api/render/route.ts`: The main orchestration engine for the render flow.
- `src/app/api/projects/route.ts`: CRUD operations for project saving.
- `src/app/templates/[slug]/page.tsx`: Server Component for dynamic SEO/Sharing metadata.
- `src/components/Header.tsx`: Context-aware navigation with branding integration.

---

*Last Updated: January 19, 2026*
