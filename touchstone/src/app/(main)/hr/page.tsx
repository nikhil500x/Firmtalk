'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Lawyers from '@/components/hr/LawyerOverview';
import HolidaysList from '@/components/hr/HolidaysList';
import LeaveOverview from '@/components/hr/LeaveOverview';
import FirmwideLeavesThisWeek from '@/components/leave/FirmwideLeavesThisWeek';
export const dynamic = 'force-dynamic';

function HRPageContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');

  const [activeTab, setActiveTab] = useState<'lawyers' | 'holidays' | 'leaves' | 'firmwide'>('lawyers');

  // Set active tab based on URL parameter
  React.useEffect(() => {
    if (tabParam === 'lawyers') {
      setActiveTab('lawyers');
    } else if (tabParam === 'holidays') {
      setActiveTab('holidays');
    } else if (tabParam === 'leaves') {
      setActiveTab('leaves');
    } else if (tabParam === 'firmwide') {
      setActiveTab('firmwide');
    }
  }, [tabParam]);

  return (
    <div className="p-6">

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('lawyers')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'lawyers'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            Users
          </button>
          <button
            onClick={() => setActiveTab('holidays')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'holidays'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            Holidays
          </button>
          <button
            onClick={() => setActiveTab('leaves')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'leaves'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            Leaves
          </button>
          <button
            onClick={() => setActiveTab('firmwide')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'firmwide'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            Firmwide This Week
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'lawyers' && <Lawyers />}
        {activeTab === 'holidays' && <HolidaysList />}
        {activeTab === 'leaves' && <LeaveOverview />}
        {activeTab === 'firmwide' && <FirmwideLeavesThisWeek />}
      </div>
    </div>
  );
}

export default function HRPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full">Loading...</div>}>
      <HRPageContent />
    </Suspense>
  );
}

