// ============================================================================
// TYPES
// ============================================================================

export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED' | 'JPY';

export interface CurrencySymbol {
    symbol: string;
    name: string;
    position: 'before' | 'after';
}

// ============================================================================
// CURRENCY SYMBOLS
// ============================================================================

export const CURRENCY_SYMBOLS: Record<CurrencyCode, CurrencySymbol> = {
    INR: { symbol: '₹', name: 'Indian Rupee', position: 'before' },
    USD: { symbol: '$', name: 'US Dollar', position: 'before' },
    EUR: { symbol: '€', name: 'Euro', position: 'before' },
    GBP: { symbol: '£', name: 'British Pound', position: 'before' },
    AED: { symbol: 'د.إ', name: 'UAE Dirham', position: 'before' },
    JPY: { symbol: '¥', name: 'Japanese Yen', position: 'before' },
};

// ============================================================================
// API BASE URL
// ============================================================================

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// ============================================================================
// EXCHANGE RATE FUNCTIONS
// ============================================================================

/**
 * Get exchange rate from one currency to another
 */
export async function getExchangeRate(
    fromCurrency: CurrencyCode,
    toCurrency: CurrencyCode
): Promise<number> {
    if (fromCurrency === toCurrency) return 1;

    try {
        const response = await fetch(
            `${API_BASE_URL}/api/currency/rate?from=${fromCurrency}&to=${toCurrency}`
        );

        if (!response.ok) {
            throw new Error('Failed to fetch exchange rate');
        }

        const data = await response.json();
        return data.rate;
    } catch (error) {
        console.error('Error fetching exchange rate:', error);
        throw new Error('Failed to fetch exchange rate');
    }
}

/**
 * Convert amount from one currency to another
 */
export async function convertCurrency(
    amount: number,
    fromCurrency: CurrencyCode,
    toCurrency: CurrencyCode
): Promise<number> {
    if (fromCurrency === toCurrency) return amount;

    try {
        const response = await fetch(`${API_BASE_URL}/api/currency/convert`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                amount,
                from: fromCurrency,
                to: toCurrency,
            }),
        });

        if (!response.ok) {
            throw new Error('Failed to convert currency');
        }

        const data = await response.json();
        return data.convertedAmount;
    } catch (error) {
        console.error('Error converting currency:', error);
        throw new Error('Failed to convert currency');
    }
}

/**
 * Format currency with proper symbol and decimal places
 */
export function formatCurrency(
    amount: number,
    currency: CurrencyCode,
    showSymbol: boolean = true
): string {
    const currencyInfo = CURRENCY_SYMBOLS[currency];
    const decimals = currency === 'JPY' ? 0 : 2;

    const formattedAmount = new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(amount);

    if (!showSymbol) return formattedAmount;

    return currencyInfo.position === 'before'
        ? `${currencyInfo.symbol}${formattedAmount}`
        : `${formattedAmount} ${currencyInfo.symbol}`;
}

/**
 * Format currency with conversion (async)
 */
export async function formatCurrencyWithConversion(
    amount: number,
    fromCurrency: CurrencyCode,
    toCurrency: CurrencyCode
): Promise<string> {
    const converted = await convertCurrency(amount, fromCurrency, toCurrency);
    return formatCurrency(converted, toCurrency);
}

/**
 * Get currency symbol for a currency code
 */
export function getCurrencySymbol(currency: CurrencyCode): string {
    return CURRENCY_SYMBOLS[currency]?.symbol || '';
}

/**
 * Format amount with currency symbol and code
 */
export function formatAmountWithCurrency(
    amount: number,
    currency: CurrencyCode,
    showCode: boolean = true
): string {
    const formatted = formatCurrency(amount, currency);
    return showCode ? `${formatted} ${currency}` : formatted;
}

/**
 * Format converted amount display (e.g., "₹5,000 (≈ $60 USD)")
 */
export function formatConvertedAmount(
    amount: number,
    fromCurrency: CurrencyCode,
    toCurrency: CurrencyCode,
    convertedAmount: number
): string {
    const original = formatAmountWithCurrency(amount, fromCurrency);
    const converted = formatAmountWithCurrency(convertedAmount, toCurrency);
    return `${original} (≈ ${converted})`;
}

/**
 * Fetch supported currencies from API
 */
export async function fetchSupportedCurrencies(): Promise<CurrencyCode[]> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/currency/supported`, {
            credentials: 'include',
        });

        if (!response.ok) {
            throw new Error('Failed to fetch supported currencies');
        }

        const data = await response.json();
        return data.success ? data.currencies : ['INR', 'USD', 'EUR', 'GBP', 'AED', 'JPY'];
    } catch (error) {
        console.error('Error fetching supported currencies:', error);
        // Return default currencies as fallback
        return ['INR', 'USD', 'EUR', 'GBP', 'AED', 'JPY'];
    }
}

// ============================================================================
// SYNCHRONOUS CURRENCY CONVERSION UTILITIES (for invoice calculations)
// These functions use provided exchange rates instead of fetching from API
// ============================================================================

/**
 * Convert amount from one currency to another using provided exchange rates
 * @param amount - Amount to convert
 * @param fromCurrency - Source currency code
 * @param toCurrency - Target currency code
 * @param exchangeRates - Map of exchange rates: { "USD": 91.5, "EUR": 98.2 } (rate FROM currency TO targetCurrency)
 * @returns Converted amount
 */
export function convertAmount(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    exchangeRates?: Record<string, number> | null
): number {
    if (!amount || amount === 0) return 0;
    
    // If same currency, no conversion needed
    if (fromCurrency === toCurrency) return amount;
    
    // If no exchange rates provided, cannot convert
    if (!exchangeRates || !exchangeRates[fromCurrency]) {
        console.error(`Missing exchange rate for ${fromCurrency} to ${toCurrency}`);
        return amount; // Return original amount as fallback
    }
    
    const rate = exchangeRates[fromCurrency];
    if (!rate || rate <= 0) {
        console.error(`Invalid exchange rate for ${fromCurrency}: ${rate}`);
        return amount;
    }
    
    // Convert: amount * rate (rate is FROM fromCurrency TO toCurrency)
    const converted = amount * rate;
    
    // Round to 4 decimals internally for precision, will be rounded to 2 for display
    return parseFloat(converted.toFixed(4));
}

/**
 * Format currency breakdown showing amounts in multiple currencies
 * @param amountsByCurrency - Map of amounts by currency: { "USD": 100, "INR": 5000 }
 * @param targetCurrency - Target currency to show total in
 * @param exchangeRates - Exchange rates map
 * @returns Formatted string breakdown
 */
export function formatCurrencyBreakdown(
    amountsByCurrency: Record<string, number>,
    targetCurrency: CurrencyCode,
    exchangeRates?: Record<string, number> | null
): string {
    const parts: string[] = [];
    let totalInTargetCurrency = 0;
    
    // Convert and format each currency
    Object.entries(amountsByCurrency).forEach(([currency, amount]) => {
        if (amount === 0) return;
        
        const formatted = formatAmountWithCurrency(amount, currency as CurrencyCode);
        parts.push(formatted);
        
        // Convert to target currency for total
        const converted = convertAmount(amount, currency, targetCurrency, exchangeRates);
        totalInTargetCurrency += converted;
    });
    
    // Add total in target currency
    if (parts.length > 1) {
        const totalFormatted = formatAmountWithCurrency(totalInTargetCurrency, targetCurrency);
        parts.push(`Total: ${totalFormatted}`);
    }
    
    return parts.join(' + ');
}

/**
 * Validate that all required exchange rates are provided
 * @param currencies - Array of currency codes that need conversion
 * @param exchangeRates - Map of provided exchange rates
 * @param targetCurrency - Target currency (all currencies must have rate TO this currency)
 * @returns Object with validation result and missing rates list
 */
export function validateExchangeRates(
    currencies: string[],
    exchangeRates: Record<string, number> | null | undefined,
    targetCurrency: string
): { isValid: boolean; missingRates: string[]; invalidRates: string[] } {
    const missingRates: string[] = [];
    const invalidRates: string[] = [];
    
    if (!exchangeRates) {
        // All currencies need rates (except target currency)
        currencies.forEach(currency => {
            if (currency !== targetCurrency) {
                missingRates.push(currency);
            }
        });
        return { isValid: false, missingRates, invalidRates };
    }
    
    currencies.forEach(currency => {
        if (currency === targetCurrency) {
            // Same currency, no rate needed
            return;
        }
        
        const rate = exchangeRates[currency];
        if (rate === undefined || rate === null) {
            missingRates.push(currency);
        } else if (rate <= 0 || rate > 10000) {
            // Validate rate is within reasonable range (0.01 to 10000)
            invalidRates.push(currency);
        }
    });
    
    return {
        isValid: missingRates.length === 0 && invalidRates.length === 0,
        missingRates,
        invalidRates
    };
}

/**
 * Get consistent currency display label for an amount
 * @param amount - Amount to format
 * @param currency - Currency code
 * @returns Formatted string with currency label
 */
export function getCurrencyDisplayLabel(
    amount: number,
    currency: CurrencyCode | string
): string {
    return formatAmountWithCurrency(amount, currency as CurrencyCode, true);
}

/**
 * Check if a currency code is valid/supported
 * @param currency - Currency code to validate
 * @returns true if valid, false otherwise
 */
export function isValidCurrency(currency: string): currency is CurrencyCode {
    return Object.keys(CURRENCY_SYMBOLS).includes(currency);
}