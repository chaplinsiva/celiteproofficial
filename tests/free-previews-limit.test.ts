// agent-notes: { ctx: "Unit tests for free preview limit of 10 for free users", deps: ["src/lib/free-previews.ts"], state: active, last: "tara@2026-08-24" }
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_FREE_PREVIEWS_LIMIT, calculateFreePreviewsStatus } from "../src/lib/free-previews";

describe("Free Previews Limit (10 Free Previews for Free Users)", () => {
    it("should define the default free preview limit as 10", () => {
        assert.equal(DEFAULT_FREE_PREVIEWS_LIMIT, 10);
    });

    it("should calculate correct usage when a user has all 10 previews remaining", () => {
        const status = calculateFreePreviewsStatus(10);
        assert.equal(status.previewLimit, 10);
        assert.equal(status.remainingPreviews, 10);
        assert.equal(status.previewsUsed, 0);
        assert.equal(status.previewPercent, "0.0");
        assert.equal(status.previewsNearLimit, false);
        assert.equal(status.previewsExhausted, false);
    });

    it("should calculate correct usage when a user has used 4 previews (6 remaining)", () => {
        const status = calculateFreePreviewsStatus(6);
        assert.equal(status.previewLimit, 10);
        assert.equal(status.remainingPreviews, 6);
        assert.equal(status.previewsUsed, 4);
        assert.equal(status.previewPercent, "40.0");
        assert.equal(status.previewsNearLimit, false);
        assert.equal(status.previewsExhausted, false);
    });

    it("should mark previews near limit when 8 or more previews are used (80%+)", () => {
        const status = calculateFreePreviewsStatus(2);
        assert.equal(status.previewLimit, 10);
        assert.equal(status.remainingPreviews, 2);
        assert.equal(status.previewsUsed, 8);
        assert.equal(status.previewPercent, "80.0");
        assert.equal(status.previewsNearLimit, true);
        assert.equal(status.previewsExhausted, false);
    });

    it("should mark previews exhausted when 0 previews remain", () => {
        const status = calculateFreePreviewsStatus(0);
        assert.equal(status.previewLimit, 10);
        assert.equal(status.remainingPreviews, 0);
        assert.equal(status.previewsUsed, 10);
        assert.equal(status.previewPercent, "100.0");
        assert.equal(status.previewsNearLimit, true);
        assert.equal(status.previewsExhausted, true);
    });

    it("should handle null or undefined gracefully with 10 default remaining", () => {
        const status = calculateFreePreviewsStatus(null);
        assert.equal(status.previewLimit, 10);
        assert.equal(status.remainingPreviews, 10);
        assert.equal(status.previewsUsed, 0);
    });
});
