'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { ArrowRightLeft } from 'lucide-react';
import { getCurrencySymbol, type CurrencyCode } from '@/lib/currencyUtils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// ============================================================================
// TYPES
// ============================================================================

interface CurrencyBadgeProps {
  currency: CurrencyCode;
  variant?: 'default' | 'converted' | 'info';
  showSymbol?: boolean;
  showCode?: boolean;
  tooltip?: string;
  className?: string;
  convertedFrom?: CurrencyCode;
  conversionRate?: number;
}

// ============================================================================
// CURRENCY COLORS
// ============================================================================

const CURRENCY_COLORS: Record<CurrencyCode, string> = {
  INR: 'bg-blue-100 text-blue-800 hover:bg-blue-200',
  USD: 'bg-green-100 text-green-800 hover:bg-green-200',
  EUR: 'bg-purple-100 text-purple-800 hover:bg-purple-200',
  GBP: 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200',
  AED: 'bg-amber-100 text-amber-800 hover:bg-amber-200',
  JPY: 'bg-red-100 text-red-800 hover:bg-red-200',
};

// ============================================================================
// COMPONENT
// ============================================================================

export default function CurrencyBadge({
  currency,
  variant = 'default',
  showSymbol = true,
  showCode = true,
  tooltip,
  className = '',
  convertedFrom,
  conversionRate,
}: CurrencyBadgeProps) {
  const symbol = getCurrencySymbol(currency);
  const colorClass = CURRENCY_COLORS[currency] || 'bg-gray-100 text-gray-800';
  
  const badgeContent = (
    <Badge
      variant="secondary"
      className={`${colorClass} ${className} font-medium text-xs px-2 py-0.5 inline-flex items-center gap-1`}
    >
      {variant === 'converted' && (
        <ArrowRightLeft className="w-3 h-3" aria-label="Converted currency" />
      )}
      {showSymbol && <span>{symbol}</span>}
      {showCode && <span>{currency}</span>}
    </Badge>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {badgeContent}
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-sm">{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badgeContent;
}

// ============================================================================
// CONVERSION BADGE VARIANT
// ============================================================================

interface ConversionBadgeProps {
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  rate?: number;
  className?: string;
}

export function ConversionBadge({
  fromCurrency,
  toCurrency,
  rate,
  className = '',
}: ConversionBadgeProps) {
  const tooltip = rate
    ? `Converted from ${fromCurrency} to ${toCurrency} at rate ${rate.toFixed(4)}`
    : `Converted from ${fromCurrency} to ${toCurrency}`;

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      <CurrencyBadge currency={fromCurrency} showSymbol={false} />
      <ArrowRightLeft className="w-3 h-3 text-gray-400" />
      <CurrencyBadge
        currency={toCurrency}
        showSymbol={false}
        tooltip={tooltip}
        variant="converted"
      />
    </div>
  );
}

