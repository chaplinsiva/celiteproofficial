# CelitePro MVC Project Documentation (MVP)

CelitePro is a premium cloud-based video generation platform that allows users to create professional-quality videos by customizing After Effects templates directly in the browser. 

---

## 🛠 Tech Stack

### Frontend
- **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
- **Language**: TypeScript
- **Styling**: Vanilla CSS with custom design system tokens.
- **Image Processing**: [Cropperjs](https://github.com/fengyuanchen/cropperjs) for precise logo positioning.

### Backend & Infrastructure
- **API Runtime**: Next.js Edge & Node.js Runtimes.
- **Database**: [Supabase](https://supabase.com/) (PostgreSQL + Real-time).
- **Video Engine**: [Plainly Videos API](https://plainlyvideos.com/) for cloud After Effects rendering.
- **Storage**: [Cloudflare R2](https://www.cloudflare.com/learning/cloud/what-is-cloud-storage/) (S3-compatible) for hosting templates and output renders.

---

## 🏗 Core Mechanisms

### 1. Video Rendering Pipeline (The "Dynamic Render Flow")
Unlike static template systems, CelitePro creates projects on-the-fly to ensure maximum flexibility.
- **Dynamic Project Creation**: For every render request, the system creates a temporary project in Plainly using a ZIP file hosted on Cloudflare R2.
- **Manual Parametrization**: The system automatically identifies After Effects compositions and layers (e.g., `img1` in `render` comp) and parametrizes them programmatically.
- **Logo Scaling Logic**: 
    - **Mode**: "Fit with fixed aspect ratio".
    - **Implementation**: Uses `mediaAutoScale` script with `forceFill: false` and `fixedRatio: true` to ensure logos are never cropped or distorted.
- **Cleanup**: After the render is complete and the file is safely stored in R2, the temporary project is deleted from Plainly to keep the account clean.

### 2. Storage Strategy (Cloudflare R2)
- **Templates**: After Effects `.zip` files are stored in the `templates/` directory.
- **Public Access**: R2 buckets are configured with public access (via custom domains) to allow Plainly's render nodes to download assets.
- **Persistence**: Rendered videos are moved from Plainly's temporary storage to R2 for long-term user access.

### 3. Database Schema (Supabase)
- **Templates Table**: Stores metadata about After Effects projects (slugs, descriptions, placeholder definitions).
- **Render Jobs Table**: Tracks the status of every rendering request (`pending`, `processing`, `completed`, `failed`).

### 4. Image Cropping Mechanism
- **Workflow**: User uploads logo -> Cropperjs UI opens -> User adjusts clip -> System converts to Base64 -> System uploads to R2 -> System sends R2 URL to Plainly.
- **Aspect Ratio**: The editor dynamically detects if the template requires a 1:1, 16:9, or custom aspect ratio and locks the cropper accordingly.

---

## 🔗 Key API Endpoints

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/render` | `POST` | Core orchestration: Project creation -> Template setup -> Rendering -> R2 Upload -> Cleanup. |
| `/api/setup-template` | `POST` | One-time setup for permanent templates (used during development). |
| `/api/upload-logo` | `POST` | Processes and uploads user-cropped logos to Cloudflare R2. |
| `/api/list-compositions` | `GET` | Debug tool to inspect After Effects project structures after Plainly analysis. |

---

## 📂 Project Structure (Key Files)

- `src/lib/plainly.ts`: The "brain" of the integration. Contains all logic for talking to the Plainly API and managing manual templates.
- `src/lib/cloudflare-r2.ts`: Handles file uploads and public URL generation for S3-compatible storage.
- `src/app/api/render/route.ts`: Orchestrates the 7-step render-and-cleanup flow.
- `src/components/LogoReveal.tsx`: The premium UI for the Quick Logo Reveal feature.
- `src/components/ImageCropper.tsx`: Wrapper for Cropperjs to handle browser-side image processing.

---

## 🔐 Environment Variables

Required variables to make the MVP function:
- `PLAINLY_API_KEY`: For video rendering.
- `S3_ENDPOINT`: Cloudflare R2 S3 API URL.
- `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`: Storage credentials.
- `PUBLIC_URL_S3`: The public base URL for accessing R2 files.
- `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_SECRET`: Database connection.

---

*Last Updated: January 18, 2026*
