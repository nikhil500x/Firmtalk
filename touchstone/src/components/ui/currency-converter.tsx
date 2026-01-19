'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, Info } from 'lucide-react';
import {
  convertCurrency,
  formatAmountWithCurrency,
  formatConvertedAmount,
  type CurrencyCode,
} from '@/lib/currencyUtils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// ============================================================================
// TYPES
// ============================================================================

interface CurrencyConverterProps {
  amount: number;
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  showOriginal?: boolean;
  showTooltip?: boolean;
  className?: string;
  rate?: number; // Optional pre-calculated rate
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function CurrencyConverter({
  amount,
  fromCurrency,
  toCurrency,
  showOriginal = true,
  showTooltip = true,
  className = '',
  rate,
}: CurrencyConverterProps) {
  const [convertedAmount, setConvertedAmount] = useState<number | null>(null);
  const [conversionRate, setConversionRate] = useState<number | null>(rate || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If currencies are the same, no conversion needed
    if (fromCurrency === toCurrency) {
      setConvertedAmount(amount);
      setConversionRate(1);
      return;
    }

    // If rate is provided, calculate directly
    if (rate !== undefined) {
      setConvertedAmount(amount * rate);
      setConversionRate(rate);
      return;
    }

    // Otherwise, fetch conversion
    const fetchConversion = async () => {
      setLoading(true);
      setError(null);

      try {
        const converted = await convertCurrency(amount, fromCurrency, toCurrency);
        setConvertedAmount(converted);
        
        // Calculate rate for tooltip
        if (amount > 0) {
          setConversionRate(converted / amount);
        }
      } catch (err) {
        console.error('Currency conversion error:', err);
        setError('Conversion failed');
      } finally {
        setLoading(false);
      }
    };

    fetchConversion();
  }, [amount, fromCurrency, toCurrency, rate]);

  // Loading state
  if (loading) {
    return (
      <span className={`inline-flex items-center gap-1 text-gray-500 ${className}`}>
        <Loader2 className="w-3 h-3 animate-spin" />
        <span className="text-sm">Converting...</span>
      </span>
    );
  }

  // Error state
  if (error || convertedAmount === null) {
    return (
      <span className={`text-gray-500 ${className}`}>
        {formatAmountWithCurrency(amount, fromCurrency)}
      </span>
    );
  }

  // Same currency - just show the amount
  if (fromCurrency === toCurrency) {
    return (
      <span className={className}>
        {formatAmountWithCurrency(amount, fromCurrency)}
      </span>
    );
  }

  // Different currencies - show conversion
  const originalFormatted = formatAmountWithCurrency(amount, fromCurrency);
  const convertedFormatted = formatAmountWithCurrency(convertedAmount, toCurrency);
  
  const tooltipContent = conversionRate
    ? `Converted at rate: 1 ${fromCurrency} = ${conversionRate.toFixed(4)} ${toCurrency}`
    : `Converted from ${fromCurrency} to ${toCurrency}`;

  const displayText = showOriginal
    ? `${originalFormatted} (≈ ${convertedFormatted})`
    : convertedFormatted;

  if (showTooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={`inline-flex items-center gap-1 cursor-help ${className}`}>
              <span>{displayText}</span>
              <Info className="w-3 h-3 text-gray-400" />
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-sm space-y-1">
              <p>{tooltipContent}</p>
              {showOriginal && (
                <>
                  <p className="text-gray-400">Original: {originalFormatted}</p>
                  <p className="text-gray-400">Converted: {convertedFormatted}</p>
                </>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return <span className={className}>{displayText}</span>;
}

// ============================================================================
// SIMPLE DISPLAY VARIANT (No API call, requires pre-calculated values)
// ============================================================================

interface SimpleCurrencyDisplayProps {
  amount: number;
  currency: CurrencyCode;
  convertedAmount?: number;
  convertedCurrency?: CurrencyCode;
  rate?: number;
  className?: string;
}

export function SimpleCurrencyDisplay({
  amount,
  currency,
  convertedAmount,
  convertedCurrency,
  rate,
  className = '',
}: SimpleCurrencyDisplayProps) {
  const originalFormatted = formatAmountWithCurrency(amount, currency);

  // If no conversion info, just show original
  if (!convertedAmount || !convertedCurrency || currency === convertedCurrency) {
    return <span className={className}>{originalFormatted}</span>;
  }

  const convertedFormatted = formatAmountWithCurrency(convertedAmount, convertedCurrency);
  const displayText = formatConvertedAmount(amount, currency, convertedCurrency, convertedAmount);

  const tooltipContent = rate
    ? `Converted at rate: 1 ${currency} = ${rate.toFixed(4)} ${convertedCurrency}`
    : `Converted from ${currency} to ${convertedCurrency}`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center gap-1 cursor-help ${className}`}>
            <span>{displayText}</span>
            <Info className="w-3 h-3 text-gray-400" />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-sm space-y-1">
            <p>{tooltipContent}</p>
            <p className="text-gray-400">Original: {originalFormatted}</p>
            <p className="text-gray-400">Converted: {convertedFormatted}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

