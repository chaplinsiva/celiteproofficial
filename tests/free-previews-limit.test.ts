// agent-notes: { ctx: "Unit tests for free preview limit (0 free previews for non-paid users)", deps: ["src/lib/free-previews.ts"], state: active, last: "tara@2026-08-26" }
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_FREE_PREVIEWS_LIMIT, calculateFreePreviewsStatus } from "../src/lib/free-previews";

describe("Free Previews Limit (No Free Previews for Free Users)", () => {
    it("should define the default free preview limit as 0", () => {
        assert.equal(DEFAULT_FREE_PREVIEWS_LIMIT, 0);
    });

    it("should return exhausted and 0 limit by default for free users", () => {
        const status = calculateFreePreviewsStatus(0);
        assert.equal(status.previewLimit, 0);
        assert.equal(status.remainingPreviews, 0);
        assert.equal(status.previewsUsed, 0);
        assert.equal(status.previewPercent, "0.0");
        assert.equal(status.previewsNearLimit, false);
        assert.equal(status.previewsExhausted, true);
    });

    it("should handle null or undefined gracefully with 0 default remaining", () => {
        const status = calculateFreePreviewsStatus(null);
        assert.equal(status.previewLimit, 0);
        assert.equal(status.remainingPreviews, 0);
        assert.equal(status.previewsUsed, 0);
        assert.equal(status.previewsExhausted, true);
    });
});
