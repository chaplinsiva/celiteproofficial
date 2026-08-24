// agent-notes: { ctx: "Unit tests for admin upload path generation", deps: ["src/lib/admin-upload.ts"], state: active, last: "tara@2026-08-24" }
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getAdminUploadPath } from "@/lib/admin-upload";

describe("getAdminUploadPath", () => {
    it("should generate timestamped path for thumbnail uploads to prevent cache stale issue", () => {
        const timestamp = 1740000000000;
        const path = getAdminUploadPath("wedding-template", "thumbnail", "photo.png", timestamp);
        assert.equal(path, "templates/wedding-template/thumbnail_1740000000000.png");
    });

    it("should generate timestamped path for preview uploads", () => {
        const timestamp = 1740000000000;
        const path = getAdminUploadPath("wedding-template", "preview", "video.mp4", timestamp);
        assert.equal(path, "templates/wedding-template/preview_1740000000000.mp4");
    });

    it("should generate timestamped path for source zip uploads", () => {
        const timestamp = 1740000000000;
        const path = getAdminUploadPath("wedding-template", "source", "source.zip", timestamp);
        assert.equal(path, "templates/wedding-template/source_1740000000000.zip");
    });

    it("should generate timestamped path for reference images", () => {
        const timestamp = 1740000000000;
        const path = getAdminUploadPath("wedding-template", "reference_img1", "bride.jpg", timestamp);
        assert.equal(path, "templates/wedding-template/references/img1_1740000000000.jpg");
    });

    it("should generate different paths when updating a thumbnail at different times", () => {
        const path1 = getAdminUploadPath("wedding-template", "thumbnail", "initial.jpg", 1000);
        const path2 = getAdminUploadPath("wedding-template", "thumbnail", "replacement.jpg", 2000);
        assert.notEqual(path1, path2);
        assert.equal(path1, "templates/wedding-template/thumbnail_1000.jpg");
        assert.equal(path2, "templates/wedding-template/thumbnail_2000.jpg");
    });
});
