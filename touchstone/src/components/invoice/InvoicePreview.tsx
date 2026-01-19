'use client';

import React from 'react';
import Image from 'next/image'; 
import { getLocation } from '@/lib/location-constants'; // ✅ ADDED
import { formatAmountWithCurrency, type CurrencyCode } from '@/lib/currencyUtils';

interface InvoicePreviewData {
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  clientName?: string;
  clientAddress?: string;
  matterTitle?: string;
  description?: string;
  amount?: number;
  currency?: CurrencyCode;
  amountInINR?: number | null;
  notes?: string;
  companyName?: string;
  companyAddress?: string;
  companyEmail?: string;
  companyPhone?: string;
  billingLocation?: string; // ✅ ADDED
  // ✅ Discount fields
  subtotal?: number;
  discountType?: 'percentage' | 'fixed' | null;
  discountValue?: number;
  discountAmount?: number;
}

interface InvoicePreviewProps {
  data: InvoicePreviewData;
  className?: string;
}

export default function InvoicePreview({ data, className = '' }: InvoicePreviewProps) {
  const formatDate = (dateString?: string): string => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount?: number): string => {
    const currency = (data.currency || 'INR') as CurrencyCode;
    if (amount === undefined || amount === null) return formatAmountWithCurrency(0, currency);
    return formatAmountWithCurrency(amount, currency);
  };

  // ✅ UPDATED: Get location info instead of hardcoded company info
  const location = getLocation(data.billingLocation);

  return (
    <div className={`bg-white border border-gray-300 rounded-lg p-8 ${className}`}>
      {/* HEADER */}
      <div className="flex justify-between items-start mb-8 pb-6 border-b-2 border-gray-200">
        {/* Company Info */}
        <div>
          <Image
            src="/images/TouchStonePartnersBlackLogo.png"
            alt="Company Logo"
            height={80}
            width={200}
            className="mb-3 object-contain w-auto"
          />
        </div>

        {/* Invoice Title - ✅ UPDATED to use location */}
        <div className="text-right">
          <div className="text-sm text-gray-600 space-y-1 mt-6">
            {location.addressLines.map((line, idx) => (
              <p key={idx}>{line}</p>
            ))}
            <p>Tel: {location.phone}</p>
            {location.fax && <p>F: {location.fax}</p>}
            <p>E: {location.email}</p>
            <p>W: {location.website}</p>
          </div>
        </div>
      </div>

      {/* DATES AND BILL TO */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        {/* Bill To */}
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">
            Bill To
          </h3>
          <div className="text-gray-900">
            <p className="font-semibold text-lg mb-1">
              {data.clientName || 'Client Name'}
            </p>
            {data.clientAddress && (
              <p className="text-sm text-gray-600">{data.clientAddress}</p>
            )}
            {data.matterTitle && (
              <p className="text-sm text-gray-600 mt-2">
                <span className="font-medium">Matter:</span> {data.matterTitle}
              </p>
            )}
          </div>
        </div>

        {/* Invoice Details */}
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">
            Invoice Details
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Invoice Date:</span>
              <span className="font-medium text-gray-900">
                {formatDate(data.invoiceDate)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Due Date:</span>
              <span className="font-medium text-gray-900">
                {formatDate(data.dueDate)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Invoice Number:</span>
              <p className="font-semibold">
                #{data.invoiceNumber || 'INV-XXXX'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* DESCRIPTION/SERVICES */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3 pb-2 border-b border-gray-200">
          Description of Services
        </h3>
        <div className="mt-4">
          {data.description ? (
            <div className="text-gray-900 whitespace-pre-wrap leading-relaxed">
              {data.description}
            </div>
          ) : (
            <p className="text-gray-400 italic">
              Service description will appear here...
            </p>
          )}
        </div>
      </div>

      {/* AMOUNT SECTION */}
      <div className="mb-8">
        <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
          {/* Subtotal */}
          <div className="flex justify-between items-center mb-4">
            <span className="text-gray-700 font-medium">Subtotal:</span>
            <span className="text-gray-900 font-semibold text-lg">
              {formatCurrency(data.subtotal ?? data.amount)}
            </span>
          </div>
          
          {/* Discount (if applicable) */}
          {data.discountType && data.discountAmount && data.discountAmount > 0 && (
            <div className="flex justify-between items-center mb-4 text-red-600">
              <span className="text-gray-700 font-medium">
                Discount {data.discountType === 'percentage' ? `(${data.discountValue}%)` : ''}:
              </span>
              <span className="font-semibold text-lg">
                -{formatCurrency(data.discountAmount)}
              </span>
            </div>
          )}
          
          <div className="border-t border-gray-300 pt-4 mt-4">
            <div className="flex justify-between items-center">
              <span className="text-lg font-bold text-gray-900">
                Total Amount Due:
              </span>
              <span className="text-2xl font-bold text-blue-600">
                {formatCurrency(data.amount)}
              </span>
            </div>
            {data.currency && data.currency !== 'INR' && data.amountInINR && (
              <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
                <span>Equivalent in INR:</span>
                <span className="font-semibold">{formatAmountWithCurrency(data.amountInINR, 'INR')}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* NOTES */}
      {data.notes && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">
            Notes
          </h3>
          <div className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded border border-gray-200">
            {data.notes}
          </div>
        </div>
      )}
    </div>
  );
}