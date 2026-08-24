// agent-notes: { ctx: "Free preview calculations and limit configuration for free and welcome gift users", deps: [], state: active, last: "sato@2026-08-24" }

export const DEFAULT_FREE_PREVIEWS_LIMIT = 10;

export interface FreePreviewsStatus {
    previewLimit: number;
    remainingPreviews: number;
    previewsUsed: number;
    previewPercent: string;
    previewsNearLimit: boolean;
    previewsExhausted: boolean;
}

/**
 * Calculates the preview usage status for a user based on the 10 free previews limit.
 */
export function calculateFreePreviewsStatus(
    freePreviewsRemaining: number | null | undefined,
    limit: number = DEFAULT_FREE_PREVIEWS_LIMIT
): FreePreviewsStatus {
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
