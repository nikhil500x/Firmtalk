'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import RecurringExpensesHub from '@/components/finance/RecurringExpensesHub';
import ExpenseRecordsHub from '@/components/finance/ExpenseRecordsHub';
import VendorsHub from '@/components/finance/VendorsHub';
import ProtectedRoute from '@/components/ProtectedRoute';

export const dynamic = 'force-dynamic';

function FinancePageContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  
  const [activeTab, setActiveTab] = useState<| 'recurring' | 'records' | 'vendors'>('recurring');
  const [refreshTrigger] = useState(0);

  // Set active tab based on URL parameter
  useEffect(() => {
    if (tabParam === 'recurring') {
      setActiveTab('recurring');
    } else if (tabParam === 'records') {
      setActiveTab('records');
    } else if (tabParam === 'vendors') {
      setActiveTab('vendors');
    }
  }, [tabParam]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <ProtectedRoute requiredRoute="/finance">
      <div className="p-6">
        {/* MAIN CONTENT AREA */}
        <div className="bg-white rounded-[22px] shadow-sm border border-gray-200 overflow-hidden">
        {/* TABS NAVIGATION */}
        <div className="flex items-center gap-0 px-6 mt-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('recurring')}
            className={`px-3 py-2.5 text-base font-semibold transition-colors ${
              activeTab === 'recurring'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            Recurring Tracker
          </button>
          <button
            onClick={() => setActiveTab('records')}
            className={`px-3 py-2.5 text-base font-semibold transition-colors ${
              activeTab === 'records'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            Expense Records
          </button>
          <button
            onClick={() => setActiveTab('vendors')}
            className={`px-3 py-2.5 text-base font-semibold transition-colors ${
              activeTab === 'vendors'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            Vendors
          </button>
        </div>

        {/* TAB CONTENT - Conditionally rendered components */}
        
        {activeTab === 'recurring' && <RecurringExpensesHub refreshTrigger={refreshTrigger} />}
        {activeTab === 'records' && <ExpenseRecordsHub refreshTrigger={refreshTrigger} />}
        {activeTab === 'vendors' && <VendorsHub refreshTrigger={refreshTrigger} />}
        </div>
      </div>
    </ProtectedRoute>
  );
}

export default function FinancePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
      <FinancePageContent />
    </Suspense>
  );
}
