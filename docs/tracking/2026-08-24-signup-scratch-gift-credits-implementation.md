---
agent-notes: { ctx: "implementation tracking for 10 free credits signup scratch gift bugfix and trigger enhancement", deps: ["src/app/api/user/claim-signup-gift/route.ts", "src/components/ScratchCardGiftModal.tsx", "tests/signup-gift.test.ts"], state: active, last: "sato@2026-08-24" }
---

# Implementation: First-Time Signup Scratch Gift (10 Free Credits) - Fix & Enhancement

**Date:** 2026-08-24
**Lead:** sato
**Status:** Complete
**Prior Phase:** Initial Signup Scratch Card Implementation

## Root Cause & Fix
- **Root Cause**: Database check constraint `user_subscriptions_autopay_status_check` requires `autopay_status` to be in `['active', 'cancelled_by_user', 'cancelled_by_bank']`. The claim route attempted to insert `autopay_status: "inactive"`, which threw a PostgreSQL 500 error `23514`.
- **Fix**: Updated [`src/app/api/user/claim-signup-gift/route.ts`](file:///d:/celite-main/celitepro/src/app/api/user/claim-signup-gift/route.ts) to insert `autopay_status: "active"`.
- **Trigger Enhancement**: Added `supabase.auth.onAuthStateChange` and `usePathname` hooks to [`src/components/ScratchCardGiftModal.tsx`](file:///d:/celite-main/celitepro/src/components/ScratchCardGiftModal.tsx) so the scratch card presents immediately upon signup/login without requiring manual browser reload.

## Artifacts Produced
- `tests/signup-gift.test.ts` — Unit test verifying database subscription payload satisfies autopay check constraint
- `src/app/api/user/claim-signup-gift/route.ts` — Fixed `autopay_status` in Postgres insert
- `src/components/ScratchCardGiftModal.tsx` — Real-time auth state listener for immediate presentation

## Test Results
- 11 unit tests passing across all suites
- `tsc --noEmit` exited cleanly with code 0

## Open Questions
- None
