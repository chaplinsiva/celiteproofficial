// agent-notes: { ctx: "Free preview calculations - free previews disabled for non-paid users", deps: [], state: active, last: "sato@2026-08-26" }

export const DEFAULT_FREE_PREVIEWS_LIMIT = 0;

export interface FreePreviewsStatus {
    previewLimit: number;
    remainingPreviews: number;
    previewsUsed: number;
    previewPercent: string;
    previewsNearLimit: boolean;
    previewsExhausted: boolean;
}

/**
 * Calculates the preview usage status for a user (free previews disabled for free tier).
 */
export function calculateFreePreviewsStatus(
    freePreviewsRemaining: number | null | undefined,
    limit: number = DEFAULT_FREE_PREVIEWS_LIMIT
): FreePreviewsStatus {
    if (limit <= 0) {
        return {
            previewLimit: 0,
            remainingPreviews: 0,
            previewsUsed: 0,
            previewPercent: "0.0",
            previewsNearLimit: false,
            previewsExhausted: true
        };
    }

    const remaining = freePreviewsRemaining === null || freePreviewsRemaining === undefined
        ? limit
        : Math.max(0, freePreviewsRemaining);

    const previewsUsed = Math.max(0, limit - remaining);
    const percentNum = limit > 0 ? (previewsUsed / limit) * 100 : 0;
    const previewPercent = percentNum.toFixed(1);

    return {
        previewLimit: limit,
        remainingPreviews: remaining,
        previewsUsed,
        previewPercent,
        previewsNearLimit: percentNum >= 80,
        previewsExhausted: remaining <= 0 || previewsUsed >= limit
    };
}
