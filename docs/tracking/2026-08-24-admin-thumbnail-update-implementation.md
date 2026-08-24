---
agent-notes: { ctx: "implementation tracking for admin thumbnail update fix", deps: ["src/lib/admin-upload.ts", "src/app/api/admin/upload/route.ts", "tests/admin-upload.test.ts"], state: active, last: "sato@2026-08-24" }
---

# Implementation: Admin Thumbnail Update Cache Stale Fix

**Date:** 2026-08-24
**Lead:** sato
**Status:** Complete
**Prior Phase:** None

## Key Decisions
- Chose timestamped filenames (`thumbnail_${timestamp}.${ext}`) over static names (`thumbnail.${ext}`) because Cloudflare CDN and browser caches retain same-URL static image assets indefinitely, causing updated thumbnails not to replace.
- Chose centralizing path logic in `src/lib/admin-upload.ts` over inline route code to allow rigorous unit testing and consistent asset paths.

## Artifacts Produced
- `src/lib/admin-upload.ts` — Path generation helper with cache-busting timestamping
- `tests/admin-upload.test.ts` — 5 unit tests for timestamped path generation
- `src/app/api/admin/upload/route.ts` — Updated to use timestamped paths for presigned upload URLs
- `src/app/admin/templates/[id]/edit/page.tsx` — Updated with toast feedback and clean redirect to `/admin/templates`
- `src/app/admin/templates/new/page.tsx` — Updated with toast feedback and clean redirect to `/admin/templates`

## Test Results
- 5 passing tests, 0 failures (`tests/admin-upload.test.ts`)
- TypeScript compiler (`tsc --noEmit`) clean exit code 0

## Open Questions
- None

## Next Phase
- Complete
