'use client';

import React, { useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';
import { generateInvoiceHTML } from './InvoiceDocumentHTML';

interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  clientName: string;
  clientAddress?: string;
  matterTitle?: string;
  matters?: Array<{ id: number; title: string; currency?: string }>;
  periodFrom?: string;
  periodTo?: string;
  amount: number;
  subtotal?: number;
  discountType?: 'percentage' | 'fixed' | null;
  discountValue?: number;
  discountAmount?: number;
  lawyerFees?: Array<{
    lawyerName: string;
    lawyerRole: string;
    hours: number;
    hourlyRate: number;
    fees: number;
  }>;
  timesheetEntries?: Array<{
    timesheetId?: number;
    date: string;
    lawyerName: string;
    lawyerRole: string;
    description?: string | null;
    hours: number;
    hourlyRate: number;
    fees: number;
    currency?: string;
    originalCurrency?: string;
    originalHours?: number;
    originalFees?: number;
    matterTitle?: string | null;
    matterId?: number | null;
    clientCode?: string | null;
    activityType?: string;
  }>;
  expenseEntries?: Array<{
    category: string;
    subCategory?: string | null;
    description: string;
    originalAmount: number;
    billedAmount: number;
    originalCurrency: string;
    currency: string;
    exchangeRate?: number | null;
  }>;
  partnerShares?: Array<{
    userId: number;
    userName: string;
    userEmail?: string;
    percentage: number;
  }>;
  payments?: Array<{
    id: number;
    paymentDate: string;
    amount: number;
    paymentMethod: string;
    transactionRef?: string | null;
    notes?: string | null;
  }>;
  disbursements?: number;
  companyName?: string;
  companyAddress?: string;
  companyEmail?: string;
  companyPhone?: string;
  billingLocation?: string;
  matterCurrency?: string;
  invoiceCurrency?: string;
  userExchangeRate?: number | null;
  amountInINR?: number | null;
  exchangeRates?: Record<string, number>;
  description?: string;
  notes?: string;
  status: string;
  amountPaid: number;
  remainingAmount: number;
}

interface InvoicePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceData: InvoiceData | null;
  onDownload: () => void;
}

export default function InvoicePreviewModal({
  open,
  onOpenChange,
  invoiceData,
  onDownload,
}: InvoicePreviewModalProps) {
  // Generate HTML document
  const htmlContent = useMemo(() => {
    if (!invoiceData) return '';
    return generateInvoiceHTML(invoiceData);
  }, [invoiceData]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open || !invoiceData) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[100]"
        onClick={() => onOpenChange(false)}
      />

      {/* Modal */}
      <div
        className="fixed z-[101] flex flex-col bg-white shadow-2xl"
        style={{
          top: '2.5vh',
          left: '2.5vw',
          right: '2.5vw',
          bottom: '2.5vh',
          width: '95vw',
          height: '95vh',
          borderRadius: '12px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b bg-white flex items-center justify-between flex-shrink-0 rounded-t-xl">
          <h2 className="text-xl font-semibold">Invoice Preview</h2>
          <button
            onClick={() => onOpenChange(false)}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-gray-200 min-h-0">
          <div className="w-full h-full flex justify-center items-start py-8">
            <div
              className="bg-white shadow-2xl"
              style={{
                width: '21cm',
                maxWidth: 'calc(100% - 4rem)',
              }}
            >
              <iframe
                srcDoc={htmlContent}
                scrolling="no"
                style={{
                  width: '100%',
                  height: 'auto',
                  border: 'none',
                  display: 'block',
                  margin: 0,
                  padding: 0,
                  overflow: 'hidden',
                }}
                title="Invoice Preview"
                onLoad={(e) => {
                  const iframe = e.target as HTMLIFrameElement;
                  if (iframe.contentWindow) {
                    const height = iframe.contentWindow.document.documentElement.scrollHeight;
                    iframe.style.height = height + 'px';
                  }
                }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-white flex justify-end gap-3 flex-shrink-0 shadow-lg rounded-b-xl">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={onDownload} className="gap-2">
            <Download size={16} />
            Download Word Document
          </Button>
        </div>
      </div>
    </>
  );
}

