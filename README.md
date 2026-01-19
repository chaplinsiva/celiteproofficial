# CelitePro | Video Editor Tool

CelitePro is a premium, cloud-based Video Editor tool designed for creators and brands. It enables professional-quality video generation by allowing users to customize After Effects templates directly in the browser through an intuitive, aesthetic interface.

![CelitePro Banner](https://pub-7badf4bfca46446ea06033d70f1216c4.r2.dev/logos/02.png)

## 🚀 Key Features

### 🎬 Professional Video Editing
- **Dynamic Customization**: Replace images and edit texts in curated After Effects templates.
- **Instant Preview**: High-quality thumbnails and video previews for all templates.
- **Image Cropper**: Integrated precision cropping (1:1, 16:9, etc.) for logo replacements.

### 💾 Project Persistence
- **Save Progress**: Persistence for every project, allowing users to return and edit later.
- **Auto-save**: Seamless background saving before every render initiated.
- **Project Dashboard**: A centralized hub to manage saved projects and review render history.

### ⚡ Power Features
- **Cloud Rendering**: Highly scalable video rendering powered by the Plainly API.
- **Dynamic Metadata**: Automatic Open Graph and Twitter card generation for sharing template links.
- **Admin Panel**: Dedicated administrative interface for usage monitoring and system oversight.
- **Secure Payments**: Integrated Razorpay for seamless, secure credit-based rendering.

## 🛠 Tech Stack

### Frontend
- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **Styling**: Vanilla CSS (Premium Aesthetics) + Framer Motion (Animations).
- **Icons**: Lucide React.
- **Toasts**: Sonner.

### Backend & Infrastructure
- **Database**: [Supabase](https://supabase.com/) (PostgreSQL + RLS Security).
- **Authentication**: Supabase Auth.
- **Video Engine**: [Plainly Videos API](https://plainlyvideos.com/).
- **Storage**: [Cloudflare R2](https://www.cloudflare.com/learning/cloud/what-is-cloud-storage/) (S3-compatible).
- **Payments**: Razorpay.

## 🏗 Directory Structure

- `src/app/`: Next.js App Router (Pages & API Routes).
- `src/components/`: Reusable UI components (Header, Hero, Cropper).
- `src/lib/`: Core library integrations (Supabase, Plainly, S3).
- `src/app/dashboard/`: User-specific project and render management.
- `src/app/admin/`: Platform administrative metrics.
- `src/app/api/render/`: The core video rendering orchestration logic.

## 🔐 Environment Variables

Reference `.env.example` for required variables:
- `PLAINLY_API_KEY`: Video engine access.
- `NEXT_PUBLIC_S3_URL` / `PUBLIC_URL_S3`: Storage base URLs.
- `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_SECRET`: Database access.
- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`: Payment processing.

---

*Rebranded and updated on January 19, 2026.*
