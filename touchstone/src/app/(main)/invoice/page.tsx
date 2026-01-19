'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { Plus } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import InvoicesTable from '@/components/invoice/InvoicesTable';
// import RateCardTable from '@/components/invoice/RateCardTable';
import PaidThisWeekTable from '@/components/invoice/PaidThisWeekTable';
import InvoiceDialog from '@/components/invoice/InvoiceDialog';
// import RateCardDialog from '@/components/invoice/RateCardDialog';
import ProtectedRoute from '@/components/ProtectedRoute';

export const dynamic = 'force-dynamic';

function InvoicePageContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  
  const [activeTab, setActiveTab] = useState<'invoices' | 'ratecard' | 'paid-this-week'>('invoices');
  const [invoiceRefreshTrigger, setInvoiceRefreshTrigger] = useState(0);
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  const [isRateCardDialogOpen, setIsRateCardDialogOpen] = useState(false);
  const [invoiceDialogMode, setInvoiceDialogMode] = useState<'create' | 'edit'>('create');
  const [editingInvoiceId, setEditingInvoiceId] = useState<number | undefined>(undefined);
  const [rateCardDialogMode, setRateCardDialogMode] = useState<'create' | 'edit'>('create');
  const [editingRateCardId, setEditingRateCardId] = useState<number | undefined>(undefined);

  // Set active tab based on URL parameter
  useEffect(() => {
    if (tabParam === 'invoices') {
      setActiveTab('invoices');
    } else if (tabParam === 'ratecard') {
      setActiveTab('ratecard');
    } else if (tabParam === 'paid-this-week') {
      setActiveTab('paid-this-week');
    }
  }, [tabParam]);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleInvoiceAdded = () => {
    setInvoiceRefreshTrigger((prev) => prev + 1);
    setIsInvoiceDialogOpen(false);
    setEditingInvoiceId(undefined);
    setInvoiceDialogMode('create');
  };

  const handleEditInvoice = (invoice: { id: number }) => {
    setEditingInvoiceId(invoice.id);
    setInvoiceDialogMode('edit');
    setIsInvoiceDialogOpen(true);
  };

  const handleAddInvoice = () => {
    setEditingInvoiceId(undefined);
    setInvoiceDialogMode('create');
    setIsInvoiceDialogOpen(true);
  };

  const handleRateCardAdded = () => {
    setInvoiceRefreshTrigger((prev) => prev + 1);
    setIsRateCardDialogOpen(false);
    setEditingRateCardId(undefined);
    setRateCardDialogMode('create');
  };

  const handleEditRateCard = (rateCard: {
    ratecard_id: number;
    user_id: number;
    service_type: string;
    min_hourly_rate: number;
    max_hourly_rate: number;
    effective_date: string;
    end_date: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    user: {
      user_id: number;
      name: string;
      email: string;
      practice_area?: string;
    };
  }) => {
    setEditingRateCardId(rateCard.ratecard_id);
    setRateCardDialogMode('edit');
    setIsRateCardDialogOpen(true);
  };

  const handleAddRateCard = () => {
    setEditingRateCardId(undefined);
    setRateCardDialogMode('create');
    setIsRateCardDialogOpen(true);
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <ProtectedRoute requiredRoute="/invoice">
      {/* INVOICE DIALOG */}
      <InvoiceDialog
        open={isInvoiceDialogOpen}
        onOpenChange={setIsInvoiceDialogOpen}
        mode={invoiceDialogMode}
        invoiceId={editingInvoiceId}
        onSuccess={handleInvoiceAdded}
      />

      {/* RATE CARD DIALOG */}
      {/* <RateCardDialog
        open={isRateCardDialogOpen}
        onOpenChange={setIsRateCardDialogOpen}
        mode={rateCardDialogMode}
        rateCardId={editingRateCardId}
        onSuccess={handleRateCardAdded}
      /> */}

      <div className="p-6">
        {/* MAIN CONTENT AREA */}
        <div className="bg-white rounded-[22px] shadow-sm border border-gray-200 overflow-hidden">
          {/* PAGE HEADER */}

          {/* TABS AND ACTION BUTTON */}
          <div className="flex items-center justify-between px-6 mt-6 border-b border-gray-200">
            {/* TABS NAVIGATION */}
            <div className="flex items-center gap-0">
              <button
                onClick={() => setActiveTab('invoices')}
                className={`px-3 py-2.5 text-base font-semibold transition-colors ${
                  activeTab === 'invoices'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                Invoices
              </button>
              <button
                onClick={() => setActiveTab('paid-this-week')}
                className={`px-3 py-2.5 text-base font-semibold transition-colors ${
                  activeTab === 'paid-this-week'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                Paid This Week
              </button>
              {/* <button
                onClick={() => setActiveTab('ratecard')}
                className={`px-3 py-2.5 text-base font-semibold transition-colors ${
                  activeTab === 'ratecard'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                Rate Card
              </button> */}
            </div>

            {/* CONDITIONAL ACTION BUTTONS */}
            {activeTab === 'invoices' && (
              <button
                onClick={handleAddInvoice}
                className="mb-2 flex items-center justify-center gap-2 px-4 py-2.5 
                          bg-gradient-to-r from-red-500 to-red-600  text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-colors"
              >
                <Plus size={20} className="stroke-[2.5]" />
                <span className="text-base font-medium">Create Invoice</span>
              </button>
            )}

            {/* {activeTab === 'ratecard' && (
              <button
                onClick={handleAddRateCard}
                className="mb-2 flex items-center justify-center gap-2 px-4 py-2.5 
                          bg-gradient-to-r from-red-500 to-red-600  text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-colors duration-200"
              >
                <Plus size={20} className="stroke-[2.5]" />
                <span className="text-base font-medium">Add Rate Card</span>
              </button>
            )} */}
          </div>

          {/* TAB CONTENT */}
          {activeTab === 'invoices' && (
            <InvoicesTable 
              refreshTrigger={invoiceRefreshTrigger}
              onEdit={handleEditInvoice}
            />
          )}
          {activeTab === 'paid-this-week' && (
            <PaidThisWeekTable />
          )}
          {/* {activeTab === 'ratecard' && (
            <RateCardTable 
              refreshTrigger={invoiceRefreshTrigger} 
              onEdit={handleEditRateCard}
            />
          )} */}
        </div>
      </div>
    </ProtectedRoute>
  );
}

export default function InvoicePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
      <InvoicePageContent />
    </Suspense>
  );
}