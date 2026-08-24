import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FUNNY_CHECKOUT_VIBES, PROCESSING_VIBE } from "../src/components/CheckoutFunnyVibes";

describe("Checkout Page Funny/Happy Meme & GIF Engine", () => {
    it("should have a curated list of at least 30 funny, happy, checkout-relevant vibes", () => {
        assert.ok(FUNNY_CHECKOUT_VIBES.length >= 30, `Expected at least 30 funny checkout vibes, received ${FUNNY_CHECKOUT_VIBES.length}`);
        
        for (const vibe of FUNNY_CHECKOUT_VIBES) {
            assert.ok(vibe.id, "Vibe must have an id");
            assert.ok(vibe.title, "Vibe must have a title");
            assert.ok(vibe.caption, "Vibe must have a punchline/caption");
            assert.ok(vibe.gifUrl.startsWith("http"), "Vibe gifUrl must be a valid URL");
            assert.ok(vibe.emoji, "Vibe must have an emoji");
            assert.ok(vibe.badge, "Vibe must have a badge");
        }
    });

    it("should provide distinct celebratory vibes like DiCaprio cheers, shut up and take money, and happy dances", () => {
        const ids = FUNNY_CHECKOUT_VIBES.map(v => v.id);
        assert.ok(ids.includes("shut-up-money"));
        assert.ok(ids.includes("dicaprio-cheers"));
        assert.ok(ids.includes("happy-cat"));
        assert.ok(ids.includes("carlton-dance"));
    });

    it("should have a dedicated hype processing vibe for payment loading state", () => {
        assert.ok(PROCESSING_VIBE.id === "processing-hype");
        assert.ok(PROCESSING_VIBE.gifUrl.startsWith("http"));
        assert.ok(PROCESSING_VIBE.title.length > 0);
    });
});
