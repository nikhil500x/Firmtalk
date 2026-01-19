'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'react-toastify';
import { API_BASE_URL } from '@/lib/api';
import { Save, X, ArrowRightLeft } from 'lucide-react';
import { formatAmountWithCurrency, validateExchangeRates, type CurrencyCode } from '@/lib/currencyUtils';
import CurrencyBadge from '@/components/ui/currency-badge';

interface DraftInvoiceEditorProps {
  invoice: {
    id: number;
    status: string;
    subtotal?: number;
    finalAmount?: number;
    invoiceAmount?: number;
    discountType?: string | null;
    discountValue?: number;
    discountAmount?: number;
    userExchangeRate?: number | null;
    amountInINR?: number | null;
    description: string;
    notes: string | null;
    matter?: { currency?: string } | null;
    matters?: Array<{ id: number; title: string; currency?: string }>;
    invoiceCurrency?: string;
    matterCurrency?: string;
    exchangeRates?: Record<string, number> | null; // ✅ Saved exchange rates from backend
    timesheets?: Array<{
      billedAmount?: number | null;
      billedHours?: number | null;
      hourlyRate?: number | null;
      currency?: string; // Currency for this timesheet
    }>;
  };
  onUpdate: () => void;
}

export default function DraftInvoiceEditor({ invoice, onUpdate }: DraftInvoiceEditorProps) {
  console.log('invoice.discountValue from backend:', invoice.discountValue);
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed' | null>(
    (invoice.discountType as 'percentage' | 'fixed') || null
  );
  const [discountValue, setDiscountValue] = useState<number | null>(invoice.discountValue === 0 ? null : invoice.discountValue ?? null);
  const [exchangeRate, setExchangeRate] = useState<number | null>(
    invoice.userExchangeRate || null
  );
  const [description, setDescription] = useState<string>(invoice.description || '');
  const [notes, setNotes] = useState<string>(invoice.notes || '');
  const [isSaving, setIsSaving] = useState(false);
  
  // ✅ Multi-currency support
  const [currencyBreakdown, setCurrencyBreakdown] = useState<Array<{
    currency: string;
    matters: Array<{ id: number; title: string }>;
    amount: number;
  }>>([]);
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});
  const [showCurrencyBreakdown, setShowCurrencyBreakdown] = useState(false);

  // ✅ Sync state when invoice prop updates (e.g., after billed hours change)
  useEffect(() => {
    setDiscountType((invoice.discountType as 'percentage' | 'fixed') || null);
    setDiscountValue(invoice.discountValue === 0 ? null : invoice.discountValue ?? null);
    setExchangeRate(invoice.userExchangeRate || null);
    setDescription(invoice.description || '');
    setNotes(invoice.notes || '');
    
    // ✅ Detect currencies from invoice timesheets/matters
    const detectCurrencies = () => {
      const breakdown: Record<string, {
        currency: string;
        matters: Array<{ id: number; title: string }>;
        amount: number;
      }> = {};
      
      // Get currencies from matters
      const matters = invoice.matters || (invoice.matter ? [invoice.matter] : []);
      matters.forEach(m => {
        const currency = m.currency || invoice.matterCurrency || 'INR';
        if (!breakdown[currency]) {
          breakdown[currency] = {
            currency,
            matters: [],
            amount: 0,
          };
        }
        breakdown[currency].matters.push({
          id: (m as any).id || ((invoice.matter as any)?.id || 0),
          title: (m as any).title || ((invoice.matter as any)?.title || ''),
        });
      });
      
      // Get currencies from timesheets - ✅ USE ORIGINAL AMOUNTS (not billedAmount which is converted)
      if (invoice.timesheets && invoice.timesheets.length > 0) {
        invoice.timesheets.forEach(ts => {
          // ✅ Use originalAmount (original timesheet amount in original currency), not billedAmount (converted to invoice currency)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const originalAmount = (ts as any).originalAmount || ts.billedAmount || 0;
          if (originalAmount === 0) return;
          
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const currency = (ts as any).currency || invoice.matterCurrency || 'INR';
          
          if (!breakdown[currency]) {
            breakdown[currency] = {
              currency,
              matters: [],
              amount: 0,
            };
          }
          breakdown[currency].amount += originalAmount;
        });
      }
      
      // ✅ ADD EXPENSES (always in INR) - if expenses are provided in invoice
      if ((invoice as any).expenses && Array.isArray((invoice as any).expenses) && (invoice as any).expenses.length > 0) {
        const expenses = (invoice as any).expenses;
        const currency = 'INR'; // Expenses are always in INR
        
        if (!breakdown[currency]) {
          breakdown[currency] = {
            currency,
            matters: [],
            amount: 0,
          };
        }
        
        expenses.forEach((exp: any) => {
          const amount = exp.originalAmount || exp.amount || 0;
          if (amount > 0) {
            breakdown[currency].amount += amount;
          }
        });
      }
      
      const breakdownArray = Object.values(breakdown).sort((a, b) => a.currency.localeCompare(b.currency));
      setCurrencyBreakdown(breakdownArray);
      setShowCurrencyBreakdown(breakdownArray.length > 1 && invoice.invoiceCurrency ? true : false);
      
      // ✅ Initialize exchange rates from saved rates in invoice
      if (invoice.exchangeRates && typeof invoice.exchangeRates === 'object') {
        setExchangeRates(invoice.exchangeRates);
      } else {
        // Initialize empty exchange rates object
        setExchangeRates({});
      }
    };
    
    detectCurrencies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice.discountType, invoice.discountValue, invoice.userExchangeRate, invoice.description, invoice.notes, invoice.subtotal, invoice.timesheets, invoice.matters, invoice.matter, invoice.invoiceCurrency, invoice.matterCurrency, invoice.exchangeRates, (invoice as any).expenses]);

  // Calculate derived values
  // ✅ Calculate subtotal from sum of all billed amounts WITH currency conversion
  // This ensures consistency even if invoice.subtotal is not set or outdated
  const invoiceCurrency = (invoice.invoiceCurrency || invoice.matterCurrency || invoice.matter?.currency || 'INR') as CurrencyCode;
  
  // ✅ Calculate subtotal from timesheets (using original amounts and converting)
  const timesheetSubtotal = invoice.timesheets?.reduce((sum, ts) => {
    // ✅ Use originalAmount (in original currency), not billedAmount (already converted)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const originalAmount = (ts as any).originalAmount || ts.billedAmount || 0;
    if (originalAmount === 0) return sum;
    
    // Get timesheet currency
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tsCurrency = (ts as any).currency || invoice.matterCurrency || invoiceCurrency || 'INR';
    
    // If same currency, no conversion needed
    if (tsCurrency === invoiceCurrency) {
      return sum + originalAmount;
    }
    
    // Convert using exchange rate if available
    // exchangeRates map stores rates FROM tsCurrency TO invoiceCurrency
    const rate = exchangeRates[tsCurrency];
    if (rate && rate > 0) {
      return sum + (originalAmount * rate);
    }
    
    // If no rate available yet, return original amount (will update when rate is entered)
    return sum + originalAmount;
  }, 0) ?? 0;
  
  // ✅ Calculate subtotal from expenses (always in INR, convert if needed)
  const expenseSubtotal = ((invoice as any).expenses && Array.isArray((invoice as any).expenses) && (invoice as any).expenses.length > 0)
    ? (invoice as any).expenses.reduce((sum: number, exp: any) => {
        const originalAmount = exp.originalAmount || exp.amount || 0;
        if (originalAmount === 0) return sum;
        
        // Expenses are always in INR
        if (invoiceCurrency === 'INR') {
          return sum + originalAmount;
        } else {
          // Convert INR to invoice currency
          const inrRate = exchangeRates['INR'];
          if (inrRate && inrRate > 0) {
            return sum + (originalAmount * inrRate);
          }
          return sum + originalAmount; // Fallback if no rate
        }
      }, 0)
    : 0;
  
  const calculatedSubtotal = timesheetSubtotal + expenseSubtotal;
  
  // Use calculated subtotal if available and > 0, otherwise fall back to invoice.subtotal or other fields
  const subtotal = calculatedSubtotal > 0 
    ? calculatedSubtotal 
    : (invoice.subtotal ?? invoice.finalAmount ?? invoice.invoiceAmount ?? 0);
 const discountAmount =
  discountType && discountValue
    ? discountType === 'percentage'
      ? subtotal * (discountValue / 100)
      : discountValue
    : 0;
  const finalAmount = subtotal - discountAmount;
  
  // ✅ Calculate amount in INR
  // If invoice currency is INR, finalAmount is already in INR
  // Otherwise, we need to convert from invoiceCurrency to INR
  let amountInINR: number | null = null;
  if (invoiceCurrency === 'INR') {
    amountInINR = finalAmount;
  } else {
    // Invoice currency is not INR, need to convert
    // For multi-currency, exchangeRates stores rates TO invoiceCurrency
    // To convert invoiceCurrency to INR, we'd need the inverse or a separate rate
    // For now, if invoiceCurrency is not INR, use userExchangeRate if available
    if (exchangeRate && exchangeRate > 0) {
      amountInINR = finalAmount * exchangeRate;
    }
  }

  const handleSave = async () => {
    // ✅ Validate exchange rates for multi-currency invoices
    if (showCurrencyBreakdown && currencyBreakdown.length > 1) {
      const currenciesNeedingConversion = currencyBreakdown
        .map(b => b.currency)
        .filter(c => c !== invoiceCurrency);
      
      const validation = validateExchangeRates(
        currenciesNeedingConversion,
        exchangeRates,
        invoiceCurrency
      );
      
      if (!validation.isValid) {
        if (validation.missingRates.length > 0) {
          toast.error(`Missing exchange rates for: ${validation.missingRates.join(', ')}`);
          return;
        }
        if (validation.invalidRates.length > 0) {
          toast.error(`Invalid exchange rates for: ${validation.invalidRates.join(', ')}. Rates must be > 0 and <= 10000`);
          return;
        }
      }
    }

    setIsSaving(true);
    try {
      // ✅ Prepare exchange rates payload - ensure all required rates are included
      let exchangeRatesPayload: Record<string, number> | undefined = undefined;
      if (showCurrencyBreakdown && Object.keys(exchangeRates).length > 0) {
        // Validate all rates are positive and within range
        const invalidRates = Object.entries(exchangeRates).filter(([, rate]) => 
          !rate || rate <= 0 || rate > 10000
        );
        
        if (invalidRates.length > 0) {
          toast.error(`Invalid exchange rates: ${invalidRates.map(([curr]) => curr).join(', ')}`);
          setIsSaving(false);
          return;
        }
        
        exchangeRatesPayload = exchangeRates;
      }

      const response = await fetch(`${API_BASE_URL}/api/invoices/${invoice.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          discountType,
          discountValue: discountType ? discountValue : 0,
          userExchangeRate: exchangeRate,
          description,
          notes,
          // ✅ Send exchange rates if multi-currency (validated above)
          exchangeRates: exchangeRatesPayload,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to update invoice');
      }

      toast.success('Invoice updated successfully');
      onUpdate();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error('Error updating invoice:', error);
      toast.error(error.message || 'Failed to update invoice');
    } finally {
      setIsSaving(false);
    }
  };

  // ✅ Check if exchange rates changed
  const exchangeRatesChanged = showCurrencyBreakdown && invoice.exchangeRates 
    ? JSON.stringify(exchangeRates) !== JSON.stringify(invoice.exchangeRates)
    : Object.keys(exchangeRates).length > 0 && !invoice.exchangeRates;
  
  const hasChanges =
    discountType !== (invoice.discountType as 'percentage' | 'fixed') ||
    discountValue !== (invoice.discountValue || 0) ||
    exchangeRate !== (invoice.userExchangeRate || null) ||
    description !== (invoice.description || '') ||
    notes !== (invoice.notes || '') ||
    exchangeRatesChanged; // ✅ Include exchange rate changes

  return (
    <div className="space-y-6">
      {/* Description Editor */}
      <div>
        <Label htmlFor="description">Description</Label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
          placeholder="Describe the services provided..."
        />
      </div>

      {/* Discount Editor */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <Label className="text-sm font-semibold text-gray-700">Discount</Label>
          <Select
            value={discountType || 'none'}
            onValueChange={(value) => {
              setDiscountType(value === 'none' ? null : (value as 'percentage' | 'fixed'));
              if (value === 'none') setDiscountValue(null);
            }}
          >
            <SelectTrigger className="w-32 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="percentage">Percentage</SelectItem>
              <SelectItem value="fixed">Fixed Amount</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {discountType && (
          <div className="mt-2">
            <Input
              type="number"
              step="0.01"
              min="0"
              max={discountType === 'percentage' ? 100 : subtotal}
              value={discountValue ?? ''}
              onChange={(e) =>
                setDiscountValue(e.target.value === '' ? null : Number(e.target.value))
              }
              placeholder={discountType === 'percentage' ? 'Enter %' : 'Enter amount'}
            />
            {discountType === 'percentage' &&
              discountValue !== null && discountValue > 100 && (
              <p className="text-xs text-red-500 mt-1">Percentage cannot exceed 100%</p>
            )}
            {discountType === 'fixed' &&
              discountValue !== null && discountValue > subtotal && (
              <p className="text-xs text-red-500 mt-1">Discount cannot exceed subtotal</p>
            )}
          </div>
        )}

        {discountType && discountAmount > 0 && (
          <div className="mt-2 text-sm text-gray-600">
            Discount Amount: <span className="font-semibold">{formatAmountWithCurrency(discountAmount, invoiceCurrency)}</span>
          </div>
        )}
      </div>

      {/* Currency Breakdown & Exchange Rates (for multi-currency invoices) */}
      {showCurrencyBreakdown && currencyBreakdown.length > 1 && invoice.invoiceCurrency && (
        <div className="bg-yellow-50 rounded-lg p-4 border-2 border-yellow-300 space-y-4">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-yellow-700" />
            <Label className="text-base font-semibold text-yellow-900">
              Currency Breakdown & Exchange Rates
            </Label>
          </div>
          <p className="text-sm text-yellow-800">
            Multiple currencies detected. Update exchange rates to convert all amounts to <strong>{invoice.invoiceCurrency}</strong>.
          </p>
          
          <div className="space-y-3">
            {currencyBreakdown.map((breakdown) => {
              if (breakdown.currency === invoice.invoiceCurrency) {
                // No conversion needed for invoice currency
                return (
                  <div key={breakdown.currency} className="p-3 bg-white rounded border border-yellow-200">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          <CurrencyBadge currency={breakdown.currency as CurrencyCode} />
                          {breakdown.currency}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {breakdown.matters.length > 0 && (
                            <>
                              {breakdown.matters.length} matter{breakdown.matters.length > 1 ? 's' : ''}: {breakdown.matters.map(m => m.title).join(', ')}
                            </>
                          )}
                          {breakdown.currency === 'INR' && (invoice as any).expenses && (invoice as any).expenses.length > 0 && (
                            <>
                              {breakdown.matters.length > 0 && ' • '}
                              {(invoice as any).expenses.length} expense{(invoice as any).expenses.length > 1 ? 's' : ''}
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{formatAmountWithCurrency(breakdown.amount, breakdown.currency as CurrencyCode)}</div>
                        <div className="text-xs text-gray-500">No conversion needed</div>
                      </div>
                    </div>
                  </div>
                );
              }
              
              const currentRate = exchangeRates[breakdown.currency] || '';
              const convertedAmount = currentRate && breakdown.amount > 0 
                ? breakdown.amount * parseFloat(currentRate.toString()) 
                : null;
              
              return (
                <div key={breakdown.currency} className="p-3 bg-white rounded border border-yellow-200 space-y-2">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        <CurrencyBadge currency={breakdown.currency as CurrencyCode} />
                        {breakdown.currency}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {breakdown.matters.length} matter{breakdown.matters.length > 1 ? 's' : ''}: {breakdown.matters.map(m => m.title).join(', ')}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatAmountWithCurrency(breakdown.amount, breakdown.currency as CurrencyCode)}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                    <div className="flex-1">
                      <Label htmlFor={`rate-${breakdown.currency}`} className="text-xs text-gray-600">
                        Exchange Rate ({breakdown.currency} → {invoice.invoiceCurrency})
                      </Label>
                      <Input
                        id={`rate-${breakdown.currency}`}
                        type="number"
                        step="0.0001"
                        min="0.0001"
                        placeholder="e.g., 0.012"
                        value={currentRate}
                        onChange={(e) => {
                          const rate = e.target.value;
                          setExchangeRates((prev) => {
                            const newRates = { ...prev };
                            if (rate && !isNaN(parseFloat(rate))) {
                              newRates[breakdown.currency] = parseFloat(rate);
                            } else {
                              delete newRates[breakdown.currency];
                            }
                            return newRates;
                          });
                        }}
                        className="mt-1"
                      />
                    </div>
                    {convertedAmount !== null && (
                      <div className="text-right">
                        <div className="text-xs text-gray-600">Converted:</div>
                        <div className="font-semibold text-sm">
                          {formatAmountWithCurrency(convertedAmount, invoice.invoiceCurrency as CurrencyCode)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Total in Invoice Currency */}
          {currencyBreakdown.length > 0 && Object.keys(exchangeRates).length > 0 && 
           Object.values(exchangeRates).every(rate => rate && rate > 0) && (
            <div className="mt-4 p-3 bg-green-50 border border-green-300 rounded">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-green-900">Total in {invoice.invoiceCurrency}:</span>
                <span className="text-lg font-bold text-green-900">
                  {formatAmountWithCurrency(calculatedSubtotal, invoice.invoiceCurrency as CurrencyCode)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Exchange Rate Editor (for single currency to INR conversion) */}
      {!showCurrencyBreakdown && invoiceCurrency !== 'INR' && (
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <Label className="text-sm font-semibold text-gray-700 mb-2 block">
            Exchange Rate to INR
          </Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={exchangeRate || ''}
            onChange={(e) =>
              setExchangeRate(e.target.value ? parseFloat(e.target.value) : null)
            }
            placeholder="Enter exchange rate (e.g., 83.50)"
            className="w-full"
          />
          {amountInINR && (
            <div className="mt-2 text-sm text-gray-600">
              Amount in INR: <span className="font-semibold">{formatAmountWithCurrency(amountInINR, 'INR')}</span>
            </div>
          )}
        </div>
      )}

      {/* Notes Editor */}
      <div>
        <Label htmlFor="notes">Notes (Optional)</Label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
          placeholder="Additional notes or payment instructions..."
        />
      </div>

      {/* Real-time Preview */}
      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Invoice Summary</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Subtotal:</span>
            <span className="font-semibold">{formatAmountWithCurrency(calculatedSubtotal, invoiceCurrency)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-red-600">
              <span>Discount:</span>
              <span className="font-semibold">-{formatAmountWithCurrency(discountAmount, invoiceCurrency)}</span>
            </div>
          )}
          <div className="flex justify-between pt-2 border-t border-blue-300">
            <span className="font-semibold text-gray-900">Total Amount:</span>
            <span className="font-bold text-lg text-gray-900">{formatAmountWithCurrency(finalAmount, invoiceCurrency)}</span>
          </div>
          {amountInINR && (
            <div className="flex justify-between pt-1 text-xs text-gray-500">
              <span>Equivalent in INR:</span>
              <span className="font-semibold">{formatAmountWithCurrency(amountInINR, 'INR')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Save Button */}
      {hasChanges && (
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button
            variant="outline"
            onClick={() => {
              setDiscountType((invoice.discountType as 'percentage' | 'fixed') || null);
              setDiscountValue(invoice.discountValue === 0 ? null : invoice.discountValue ?? null);
              setExchangeRate(invoice.userExchangeRate || null);
              setDescription(invoice.description || '');
              setNotes(invoice.notes || '');
            }}
            disabled={isSaving}
          >
            <X size={16} className="mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700">
            <Save size={16} className="mr-2" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      )}
    </div>
  );
}

