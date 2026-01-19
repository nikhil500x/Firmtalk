import { xchangerate } from 'xchange-rates';
import prisma from '../prisma-client';

export type SupportedCurrency = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED' | 'JPY';

export const SUPPORTED_CURRENCIES: SupportedCurrency[] = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'JPY'];

/**
 * Currency Service
 * Handles currency conversion using xchange-rates library
 * All rate cards are stored in INR (base currency)
 */
export class CurrencyService {
  /**
   * Convert an amount from one currency to another
   * @param amount - The amount to convert
   * @param fromCurrency - Source currency code
   * @param toCurrency - Target currency code
   * @returns Object containing converted amount and exchange rate
   */
  static async convertAmount(
    amount: number,
    fromCurrency: string,
    toCurrency: string
  ): Promise<{ convertedAmount: number; rate: number }> {
    try {
      // If currencies are the same, no conversion needed
      if (fromCurrency === toCurrency) {
        return {
          convertedAmount: amount,
          rate: 1
        };
      }

      // Get exchange rate
      const rateResult = await xchangerate(fromCurrency, toCurrency);
      
      // Extract the actual rate number from the result
      const rate = typeof rateResult === 'object' && rateResult !== null && 'rate' in rateResult
        ? (rateResult as any).rate
        : rateResult;

      const convertedAmount = amount * rate;

      return {
        convertedAmount: parseFloat(convertedAmount.toFixed(2)),
        rate: parseFloat(rate.toFixed(6))
      };
    } catch (error) {
      console.error(`Error converting ${amount} from ${fromCurrency} to ${toCurrency}:`, error);
      throw new Error(`Failed to convert currency from ${fromCurrency} to ${toCurrency}`);
    }
  }

  /**
   * Get exchange rate between two currencies
   * @param fromCurrency - Source currency code
   * @param toCurrency - Target currency code
   * @returns Exchange rate
   */
  static async getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number> {
    try {
      if (fromCurrency === toCurrency) {
        return 1;
      }

      const rateResult = await xchangerate(fromCurrency, toCurrency);
      
      // Extract the actual rate number from the result
      const rate = typeof rateResult === 'object' && rateResult !== null && 'rate' in rateResult
        ? (rateResult as any).rate
        : rateResult;

      return parseFloat(rate.toFixed(6));
    } catch (error) {
      console.error(`Error fetching exchange rate from ${fromCurrency} to ${toCurrency}:`, error);
      throw new Error(`Failed to fetch exchange rate from ${fromCurrency} to ${toCurrency}`);
    }
  }

  /**
   * Get user's rate card converted to matter currency
   * Rate cards are always stored in INR, this method converts them to the target currency
   * ✅ NEW: Now handles empty rate cards (when min/max are null)
   * @param userId - User ID
   * @param serviceType - Service type
   * @param matterCurrency - Target currency for conversion
   * @returns Rate card with converted rates or null if not found
   */
  static async getRateCardInMatterCurrency(
    userId: number,
    serviceType: string,
    matterCurrency: string
  ): Promise<{
    has_rate_card: boolean;
    has_rates: boolean;
    min_rate: number | null;
    max_rate: number | null;
    suggested_rate: number | null;
    original_currency: string;
    target_currency: string;
    conversion_rate: number;
    is_empty_rate_card: boolean;
  } | null> {
    try {
      // Fetch the rate card (always in INR)
      const rateCard = await prisma.user_rate_card.findFirst({
        where: {
          user_id: userId,
          service_type: serviceType,
          is_active: true,
          effective_date: {
            lte: new Date()
          },
          OR: [
            { end_date: null },
            { end_date: { gte: new Date() } }
          ]
        },
        orderBy: {
          effective_date: 'desc'
        }
      });

      if (!rateCard) {
        return null;
      }

      // ✅ Check if this is an empty rate card
      const isEmptyRateCard = rateCard.min_hourly_rate === null || rateCard.max_hourly_rate === null;
      const hasRates = !isEmptyRateCard;

      // If empty rate card, return null rates
      if (isEmptyRateCard) {
        return {
          has_rate_card: true,
          has_rates: false,
          min_rate: null,
          max_rate: null,
          suggested_rate: null,
          original_currency: 'INR',
          target_currency: matterCurrency,
          conversion_rate: 1,
          is_empty_rate_card: true
        };
      }

      // If matter currency is INR, no conversion needed
      if (matterCurrency === 'INR') {
        return {
          has_rate_card: true,
          has_rates: true,
          min_rate: rateCard.min_hourly_rate!,
          max_rate: rateCard.max_hourly_rate!,
          suggested_rate: (rateCard.min_hourly_rate! + rateCard.max_hourly_rate!) / 2,
          original_currency: 'INR',
          target_currency: 'INR',
          conversion_rate: 1,
          is_empty_rate_card: false
        };
      }

      // Convert rates to matter currency
      const conversionRate = await this.getExchangeRate('INR', matterCurrency);
      
      const minRateConverted = rateCard.min_hourly_rate! * conversionRate;
      const maxRateConverted = rateCard.max_hourly_rate! * conversionRate;

      return {
        has_rate_card: true,
        has_rates: true,
        min_rate: parseFloat(minRateConverted.toFixed(2)),
        max_rate: parseFloat(maxRateConverted.toFixed(2)),
        suggested_rate: parseFloat(((minRateConverted + maxRateConverted) / 2).toFixed(2)),
        original_currency: 'INR',
        target_currency: matterCurrency,
        conversion_rate: conversionRate,
        is_empty_rate_card: false
      };
    } catch (error) {
      console.error('Error getting rate card in matter currency:', error);
      return null;
    }
  }

  /**
   * Validate if a currency code is supported
   * @param currency - Currency code to validate
   * @returns true if supported, false otherwise
   */
  static isSupportedCurrency(currency: string): boolean {
    return SUPPORTED_CURRENCIES.includes(currency as SupportedCurrency);
  }

  /**
   * Get list of all supported currencies
   * @returns Array of supported currency codes
   */
  static getSupportedCurrencies(): SupportedCurrency[] {
    return SUPPORTED_CURRENCIES;
  }

  /**
   * Convert multiple amounts in batch (useful for invoice calculations)
   * @param amounts - Array of amounts to convert
   * @param fromCurrency - Source currency
   * @param toCurrency - Target currency
   * @returns Object with converted amounts array and exchange rate
   */
  static async convertAmountsBatch(
    amounts: number[],
    fromCurrency: string,
    toCurrency: string
  ): Promise<{ convertedAmounts: number[]; rate: number; total: number }> {
    try {
      if (fromCurrency === toCurrency) {
        const total = amounts.reduce((sum, amt) => sum + amt, 0);
        return {
          convertedAmounts: amounts,
          rate: 1,
          total
        };
      }

      const rate = await this.getExchangeRate(fromCurrency, toCurrency);
      const convertedAmounts = amounts.map(amt => parseFloat((amt * rate).toFixed(2)));
      const total = convertedAmounts.reduce((sum, amt) => sum + amt, 0);

      return {
        convertedAmounts,
        rate,
        total: parseFloat(total.toFixed(2))
      };
    } catch (error) {
      console.error('Error converting amounts in batch:', error);
      throw new Error(`Failed to convert amounts from ${fromCurrency} to ${toCurrency}`);
    }
  }

  /**
   * Convert amount synchronously using provided exchange rates (for invoice calculations)
   * This uses stored exchange rates from invoices instead of fetching from API
   * @param amount - Amount to convert
   * @param fromCurrency - Source currency code
   * @param toCurrency - Target currency code
   * @param exchangeRates - Map of exchange rates: { "USD": 91.5, "EUR": 98.2 } (rate FROM currency TO toCurrency)
   * @returns Converted amount (rounded to 4 decimals internally for precision)
   */
  // static convertAmount(
  //   amount: number,
  //   fromCurrency: string,
  //   toCurrency: string,
  //   exchangeRates: Record<string, number> | null | undefined
  // ): number {
  //   if (!amount || amount === 0) return 0;
    
  //   // If same currency, no conversion needed
  //   if (fromCurrency === toCurrency) return amount;
    
  //   // If no exchange rates provided, throw error
  //   if (!exchangeRates || !exchangeRates[fromCurrency]) {
  //     throw new Error(`Missing exchange rate for ${fromCurrency} to ${toCurrency}`);
  //   }
    
  //   const rate = exchangeRates[fromCurrency];
  //   if (!rate || rate <= 0 || rate > 10000) {
  //     throw new Error(`Invalid exchange rate for ${fromCurrency}: ${rate}. Rate must be > 0 and <= 10000`);
  //   }
    
  //   // Convert: amount * rate (rate is FROM fromCurrency TO toCurrency)
  //   const converted = amount * rate;
    
  //   // Round to 4 decimals internally for precision (will be rounded to 2 for display)
  //   return parseFloat(converted.toFixed(4));
  // }

  /**
   * Validate that all required exchange rates are provided for invoice finalization
   * @param invoiceCurrencies - Array of unique currency codes in the invoice (timesheets + expenses)
   * @param invoiceCurrency - Target invoice currency
   * @param exchangeRates - Map of provided exchange rates
   * @returns Object with validation result and missing/invalid rates
   */
  static validateInvoiceExchangeRates(
    invoiceCurrencies: string[],
    invoiceCurrency: string,
    exchangeRates: Record<string, number> | null | undefined
  ): { 
    isValid: boolean; 
    missingRates: string[]; 
    invalidRates: string[];
    errors: string[];
  } {
    const missingRates: string[] = [];
    const invalidRates: string[] = [];
    const errors: string[] = [];
    
    if (!exchangeRates || typeof exchangeRates !== 'object') {
      // All currencies (except invoice currency) need rates
      invoiceCurrencies.forEach(currency => {
        if (currency !== invoiceCurrency) {
          missingRates.push(currency);
          errors.push(`Missing exchange rate for ${currency} to ${invoiceCurrency}`);
        }
      });
      return { isValid: false, missingRates, invalidRates, errors };
    }
    
    // Get unique currencies that need conversion
    const currenciesNeedingConversion = [...new Set(invoiceCurrencies)].filter(c => c !== invoiceCurrency);
    
    currenciesNeedingConversion.forEach(currency => {
      const rate = exchangeRates[currency];
      
      if (rate === undefined || rate === null) {
        missingRates.push(currency);
        errors.push(`Missing exchange rate for ${currency} to ${invoiceCurrency}`);
      } else if (rate <= 0 || rate > 10000) {
        invalidRates.push(currency);
        errors.push(`Invalid exchange rate for ${currency}: ${rate}. Rate must be > 0 and <= 10000`);
      }
    });
    
    return {
      isValid: missingRates.length === 0 && invalidRates.length === 0,
      missingRates,
      invalidRates,
      errors
    };
  }
}

