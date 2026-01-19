'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { Plus } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import TimesheetsTable from '@/components/timesheet/TimesheetsTable';
import TimesheetDialog from '@/components/timesheet/TimesheetDialog';
import TimesheetCalendar from '@/components/timesheet/TimesheetCalendar';
import QuickTimesheetEntry from '@/components/timesheet/QuickTimesheetEntry';

export const dynamic = 'force-dynamic';

function TimesheetPageContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  
  const [activeTab, setActiveTab] = useState<'timesheets' | 'calendar'>('calendar');
  const [timesheetRefreshTrigger, setTimesheetRefreshTrigger] = useState(0);
  const [isAddTimesheetDialogOpen, setIsAddTimesheetDialogOpen] = useState(false);
  const [isQuickEntryOpen, setIsQuickEntryOpen] = useState(false);

  // Set active tab based on URL parameter
  useEffect(() => {
    if (tabParam === 'timesheets') {
      setActiveTab('timesheets');
    } else if (tabParam === 'calendar') {
      setActiveTab('calendar');
    }
  }, [tabParam]);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleAddTimeEntry = () => {
    setIsAddTimesheetDialogOpen(true);
  };

  const handleQuickEntry = () => {
    setIsQuickEntryOpen(true);
  };

  const handleTimesheetAdded = () => {
    setTimesheetRefreshTrigger((prev) => prev + 1);
    setIsAddTimesheetDialogOpen(false);
  };

  const handleQuickEntrySuccess = () => {
    setTimesheetRefreshTrigger((prev) => prev + 1);
    setIsQuickEntryOpen(false);
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <>
      {/* TIMESHEET DIALOG */}
      <TimesheetDialog
        open={isAddTimesheetDialogOpen}
        onOpenChange={setIsAddTimesheetDialogOpen}
        mode="create"
        onSuccess={handleTimesheetAdded}
      />

      {/* QUICK ENTRY DIALOG */}
      <QuickTimesheetEntry
        open={isQuickEntryOpen}
        onOpenChange={setIsQuickEntryOpen}
        selectedDate={new Date()}
        onSuccess={handleQuickEntrySuccess}
      />

      <div className="p-6">
        {/* MAIN CONTENT AREA */}
        <div className="bg-white rounded-[22px] shadow-sm border border-gray-200 overflow-hidden">
        {/* TABS AND ACTION BUTTON */}
        <div className="flex items-center justify-between px-6 mt-6 border-b border-gray-200">
          {/* TABS NAVIGATION */}
          <div className="flex items-center gap-0">
            <button
              onClick={() => setActiveTab('calendar')}
              className={`px-3 py-2.5 text-base font-semibold transition-colors ${
                activeTab === 'calendar'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Calendar
            </button>
            <button
              onClick={() => setActiveTab('timesheets')}
              className={`px-3 py-2.5 text-base font-semibold transition-colors ${
                activeTab === 'timesheets'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Timesheets
            </button>
          </div>

          {/* ACTION BUTTONS */}
          {activeTab === 'timesheets' && (
            <button
              onClick={handleAddTimeEntry}
              className="mb-2 flex items-center justify-center gap-2 px-4 py-2.5 
                        rounded-lg bg-gradient-to-b from-blue-500 to-blue-600 text-white
                        hover:from-blue-600 hover:to-blue-700 transition-colors"
            >
              <Plus size={20} className="stroke-[2.5]" />
              <span className="text-base font-medium">
                Add Time Entry
              </span>
            </button>
          )}
        </div>

          {/* TAB CONTENT */}
          {activeTab === 'timesheets' && (
            <TimesheetsTable refreshTrigger={timesheetRefreshTrigger} />
          )}
          {activeTab === 'calendar' && (
            <div className="p-6">
              <TimesheetCalendar refreshTrigger={timesheetRefreshTrigger} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function TimesheetPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
      <TimesheetPageContent />
    </Suspense>
  );
}

