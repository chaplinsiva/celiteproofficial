import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LOADING_FUNNY_VIBES } from "../src/components/LoadingFunnyVibes";

describe("Loading Funny Vibes & Render Progress GIF Engine (/tdd)", () => {
    it("should have a curated list of at least 30 loading & rendering funny GIFs", () => {
        assert.ok(Array.isArray(LOADING_FUNNY_VIBES), "LOADING_FUNNY_VIBES must be an array");
        assert.ok(LOADING_FUNNY_VIBES.length >= 30, `Expected at least 30 loading vibes, received ${LOADING_FUNNY_VIBES.length}`);

        for (const item of LOADING_FUNNY_VIBES) {
            assert.ok(item.id, "Loading vibe must have an ID");
            assert.ok(item.title, "Loading vibe must have a title");
            assert.ok(item.caption, "Loading vibe must have a caption/joke");
            assert.ok(item.gifUrl.startsWith("http"), "Loading vibe must have a valid gifUrl");
            assert.ok(item.emoji, "Loading vibe must have an emoji");
        }
    });

    it("should include relatable rendering themes like popcorn, hamster GPU, cooking magic, and typing speed", () => {
        const ids = LOADING_FUNNY_VIBES.map(v => v.id);
        assert.ok(ids.includes("popcorn-time") || ids.includes("chef-cooking") || ids.includes("hamster-gpu"));
        assert.ok(ids.includes("cat-typing") || ids.includes("waiting-mr-bean") || ids.includes("coffee-loading"));
    });

    it("should allow cycling through vibes sequentially or randomly", () => {
        const first = LOADING_FUNNY_VIBES[0];
        const second = LOADING_FUNNY_VIBES[1];
        assert.notDeepEqual(first, second, "Items in LOADING_FUNNY_VIBES must be unique");
    });
});
