'use client';

import React, { useState, useRef, useEffect } from 'react';
import { DollarSign, Check } from 'lucide-react';
import { useCurrency, CurrencyCode } from '@/contexts/CurrencyContext';
import { CURRENCY_SYMBOLS } from '@/lib/currencyUtils';

// ============================================================================
// CURRENCY SWITCHER COMPONENT
// ============================================================================

export default function CurrencySwitcher() {
    const { currency, setCurrency } = useCurrency();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const currencies: CurrencyCode[] = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'JPY'];

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleCurrencyChange = (newCurrency: CurrencyCode) => {
        setCurrency(newCurrency);
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Currency Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-xl transition-all duration-200 group"
                aria-label="Change currency"
                title="Currency"
            >
                <DollarSign size={18} className="text-gray-600 group-hover:text-gray-900 transition-colors" />
                <span className="text-sm font-medium text-gray-700 hidden md:block">
                    {currency}
                </span>
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-200 py-2 animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                    <div className="px-3 py-2 border-b border-gray-100">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Select Currency
                        </p>
                    </div>

                    <div className="py-1">
                        {currencies.map((curr) => {
                            const currencyInfo = CURRENCY_SYMBOLS[curr];
                            const isSelected = currency === curr;

                            return (
                                <button
                                    key={curr}
                                    onClick={() => handleCurrencyChange(curr)}
                                    className={`w-full px-4 py-2.5 text-left flex items-center justify-between hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50' : ''
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-lg">{currencyInfo.symbol}</span>
                                        <div>
                                            <p className={`text-sm font-medium ${isSelected ? 'text-blue-700' : 'text-gray-900'
                                                }`}>
                                                {curr}
                                            </p>
                                            <p className="text-xs text-gray-500">{currencyInfo.name}</p>
                                        </div>
                                    </div>
                                    {isSelected && (
                                        <Check size={16} className="text-blue-600" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}