'use client';

import { ReactNode } from 'react';
import CalendarSidebar from './CalendarSidebar';
import CalendarNavigation from './CalendarNavigation';
import { CalendarView } from './ViewToggle';

interface CalendarLayoutProps {
  children: ReactNode;
  currentView: CalendarView;
  currentDate: Date;
  selectedDate?: Date;
  onViewChange: (view: CalendarView) => void;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onDateSelect?: (date: Date) => void;
  onMonthChange?: (date: Date) => void;
  showWorkEvents?: boolean;
  showPersonalEvents?: boolean;
  onFilterChange?: (filters: { work: boolean; personal: boolean }) => void;
  onNewEvent?: () => void;
}

export default function CalendarLayout({
  children,
  currentView,
  currentDate,
  selectedDate,
  onViewChange,
  onPrevious,
  onNext,
  onToday,
  onDateSelect,
  onMonthChange,
  showWorkEvents = true,
  showPersonalEvents = true,
  onFilterChange,
  onNewEvent,
}: CalendarLayoutProps) {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Left Sidebar */}
      <CalendarSidebar
        currentDate={currentDate}
        selectedDate={selectedDate}
        onDateSelect={onDateSelect}
        onMonthChange={onMonthChange}
        showWorkEvents={showWorkEvents}
        showPersonalEvents={showPersonalEvents}
        onFilterChange={onFilterChange}
        onNewEvent={onNewEvent}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navigation */}
        <CalendarNavigation
          currentView={currentView}
          currentDate={currentDate}
          onViewChange={onViewChange}
          onPrevious={onPrevious}
          onNext={onNext}
          onToday={onToday}
          onDateSelect={onDateSelect}
        />

        {/* Calendar Grid Content */}
        <div className="flex-1 overflow-auto bg-white">
          {children}
        </div>
      </div>
    </div>
  );
}

