export type Currency = 'INR' | 'USD';

export const USD_EXCHANGE_RATE = 86; // 1 USD ≈ 86 INR

/**
 * Converts INR in paise to USD rounded off to the nearest whole dollar.
 */
export function convertPaiseToUSD(paise: number): number {
    const inrRupees = paise / 100;
    const usd = Math.round(inrRupees / USD_EXCHANGE_RATE);
    return Math.max(1, usd);
}

/**
 * Formats INR paise to a readable string (e.g. 89900 -> "899").
 */
export function formatINR(paise: number): string {
    return new Intl.NumberFormat("en-IN").format(paise / 100);
}

/**
 * Formats INR paise into rounded USD string (e.g. 89900 -> "10").
 */
export function formatUSD(paise: number): string {
    return new Intl.NumberFormat("en-US").format(convertPaiseToUSD(paise));
}

/**
 * Formats price according to the selected currency.
 */
export function formatPriceByCurrency(paise: number, currency: Currency): string {
    if (currency === 'USD') {
        return `$${formatUSD(paise)}`;
    }
    return `₹${formatINR(paise)}`;
}

/**
 * Helper to get or set currency preference in localStorage
 */
export function getSavedCurrency(): Currency {
    if (typeof window === "undefined") return "INR";
    const saved = localStorage.getItem("celite_currency");
    return saved === "USD" ? "USD" : "INR";
}

export function saveCurrency(currency: Currency): void {
    if (typeof window === "undefined") return;
    localStorage.setItem("celite_currency", currency);
}
