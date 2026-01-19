'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import ViewToggle from './ViewToggle';
import { formatMonthYear } from '@/lib/calendarUtils';
import type { CalendarView } from './ViewToggle';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

interface CalendarNavigationProps {
  currentView: CalendarView;
  currentDate: Date;
  onViewChange: (view: CalendarView) => void;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onDateSelect?: (date: Date) => void;
}

export default function CalendarNavigation({
  currentView,
  currentDate,
  onViewChange,
  onPrevious,
  onNext,
  onToday,
  onDateSelect,
}: CalendarNavigationProps) {
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [dateInput, setDateInput] = useState(format(currentDate, 'yyyy-MM-dd'));
  const monthYear = formatMonthYear(currentDate);

  const handleDateSelect = (date: Date) => {
    if (onDateSelect) {
      onDateSelect(date);
    }
    setIsDatePickerOpen(false);
  };

  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDateInput(e.target.value);
  };

  const handleDateInputSubmit = () => {
    const selectedDate = new Date(dateInput);
    if (!isNaN(selectedDate.getTime())) {
      handleDateSelect(selectedDate);
    }
  };

  return (
    <>
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          {/* Left: View Toggle */}
          <div className="flex items-center gap-4">
            <ViewToggle currentView={currentView} onViewChange={onViewChange} />
          </div>

          {/* Center: Date Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={onPrevious}
              className="p-2 hover:bg-gray-100 rounded transition-colors"
              aria-label="Previous"
              title="Previous (←)"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <button
              onClick={onToday}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              title="Go to Today (T)"
            >
              Today
            </button>
            <button
              onClick={() => {
                setDateInput(format(currentDate, 'yyyy-MM-dd'));
                setIsDatePickerOpen(true);
              }}
              className="text-base font-semibold text-gray-900 min-w-[140px] text-center hover:bg-gray-100 px-3 py-1 rounded transition-colors cursor-pointer"
              title="Click to jump to date"
            >
              {monthYear}
            </button>
            <button
              onClick={onNext}
              className="p-2 hover:bg-gray-100 rounded transition-colors"
              aria-label="Next"
              title="Next (→)"
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Right: Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setDateInput(format(currentDate, 'yyyy-MM-dd'));
                setIsDatePickerOpen(true);
              }}
              className="p-2 hover:bg-gray-100 rounded transition-colors"
              title="Jump to Date"
            >
              <CalendarIcon className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Jump to Date Dialog */}
      <Dialog open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Jump to Date</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label htmlFor="date-input" className="block text-sm font-medium text-gray-700 mb-2">
                Select Date
              </label>
              <Input
                id="date-input"
                type="date"
                value={dateInput}
                onChange={handleDateInputChange}
                className="w-full"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setIsDatePickerOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDateInputSubmit}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Go to Date
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

