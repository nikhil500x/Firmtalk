'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { convertCurrency, formatCurrency, getExchangeRate } from '@/lib/currencyUtils';

// ============================================================================
// TYPES
// ============================================================================

export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED' | 'JPY';

export interface CurrencyContextType {
    currency: CurrencyCode;
    setCurrency: (currency: CurrencyCode) => void;
    convertAmount: (amount: number, fromCurrency?: CurrencyCode) => Promise<number>;
    formatAmount: (amount: number, fromCurrency?: CurrencyCode) => Promise<string>;
    getRate: (toCurrency: CurrencyCode, fromCurrency?: CurrencyCode) => Promise<number>;
    baseCurrency: CurrencyCode;
    loading: boolean;
}

// ============================================================================
// CONTEXT
// ============================================================================

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

interface CurrencyProviderProps {
    children: ReactNode;
}

export function CurrencyProvider({ children }: CurrencyProviderProps) {
    const baseCurrency: CurrencyCode = 'INR'; // Your base currency
    const [currency, setCurrencyState] = useState<CurrencyCode>('INR');
    const [loading, setLoading] = useState(false);

    // Load saved currency preference from localStorage
    useEffect(() => {
        const savedCurrency = localStorage.getItem('preferredCurrency') as CurrencyCode;
        if (savedCurrency) {
            setCurrencyState(savedCurrency);
        }
    }, []);

    // Save currency preference to localStorage
    const setCurrency = (newCurrency: CurrencyCode) => {
        setCurrencyState(newCurrency);
        localStorage.setItem('preferredCurrency', newCurrency);
    };

    // Convert amount from base currency to selected currency
    const convertAmount = useCallback(async (amount: number, fromCurrency: CurrencyCode = baseCurrency): Promise<number> => {
        if (currency === fromCurrency) return amount;
        setLoading(true);
        try {
            return await convertCurrency(amount, fromCurrency, currency);
        } finally {
            setLoading(false);
        }
    }, [currency, baseCurrency]);

    // Format amount with currency symbol
    const formatAmount = useCallback(async (amount: number, fromCurrency: CurrencyCode = baseCurrency): Promise<string> => {
        if (currency === fromCurrency) {
            return formatCurrency(amount, currency);
        }
        
        try {
            const converted = await convertCurrency(amount, fromCurrency, currency);
            return formatCurrency(converted, currency);
        } catch (error) {
            console.error('Error formatting amount:', error);
            // Fallback to original currency formatting
            return formatCurrency(amount, fromCurrency);
        }
    }, [currency, baseCurrency]);

    // Get exchange rate
    const getRate = useCallback(async (toCurrency: CurrencyCode, fromCurrency: CurrencyCode = baseCurrency): Promise<number> => {
        return await getExchangeRate(fromCurrency, toCurrency);
    }, [baseCurrency]);

    const value: CurrencyContextType = {
        currency,
        setCurrency,
        convertAmount,
        formatAmount,
        getRate,
        baseCurrency,
        loading,
    };

    return (
        <CurrencyContext.Provider value={value}>
            {children}
        </CurrencyContext.Provider>
    );
}

// ============================================================================
// HOOK
// ============================================================================

export function useCurrency() {
    const context = useContext(CurrencyContext);
    if (context === undefined) {
        throw new Error('useCurrency must be used within a CurrencyProvider');
    }
    return context;
}