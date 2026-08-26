---
agent-notes: { ctx: "implementation tracking for restricting free preview strictly to paid subscribers while preserving welcome credits for HD render", deps: ["src/lib/free-previews.ts", "tests/preview-entitlements.test.ts"], state: active, last: "sato@2026-08-26" }
---

# Implementation: Restrict Previews to Paid Subscribers & Preserve HD Welcome Credits

**Date:** 2026-08-26
**Lead:** sato
**Status:** Complete
**Prior Phase:** Free Preview 10 Limit & Welcome Gift Implementation

## Summary of Changes
- **Preview Restriction to Paid Subscribers:**
  - `src/app/api/render/sample/route.ts`: Enforces strict subscription verification (`price_monthly > 0` and plan name !== `"Welcome Gift"`). Non-paid users attempting to render sample previews receive HTTP 403 Forbidden.
- **Subscription Status Contract:**
  - `src/app/api/subscription/status/route.ts`: Free users and welcome gift users receive `hasUnlimitedPreviews: false`, `hasPaidSubscription: false`, `previewLimit: 0`, and `previewsExhausted: true`.
  - `src/lib/free-previews.ts`: Sets `DEFAULT_FREE_PREVIEWS_LIMIT = 0` for non-paid users.
- **HD Render Entitlements for Free Users:**
  - Free users and Welcome Gift users retain full permission to spend their Welcome Gift credits on full HD renders (`/api/render`).
- **Editor UI & UX:**
  - `src/app/templates/[slug]/editor/[editorId]/page.tsx`:
    - **Locked Preview Button:** Styled with amber/indigo gradient, Lock icon, and `PRO` badge for non-paid users.
    - **Preview Locked Modal (`showPreviewLockedModal`):** Aesthetic modal explaining unlimited draft previews is a Pro feature, with quick-action buttons to "Unlock Unlimited Previews" (linking to `/pricing`) and "Render in Full HD with Credits".
    - **Render Confirmation Modal:** Tailored CTA ("Upgrade for Previews" with Lock icon for free users; "Preview" for paid subscribers).
  - `src/app/pricing/page.tsx`:
    - Updated copy to clarify that unlimited instant previews are included with paid subscriptions.

## Test Results
- **Strict TDD:**
  - `tests/preview-entitlements.test.ts`: Verifies free users are denied previews, welcome users can render HD but not preview, and paid subscribers get unlimited previews.
  - `tests/free-previews-limit.test.ts`: Verifies zero preview limit for free users.
- **Pass Count:** 36/36 passing across 11 test suites.
