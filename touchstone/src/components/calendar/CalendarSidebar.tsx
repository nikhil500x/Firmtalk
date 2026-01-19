'use client';

import { useState } from 'react';
import MiniCalendar from './MiniCalendar';
import { Plus, Calendar as CalendarIcon, Filter } from 'lucide-react';

interface CalendarSidebarProps {
  currentDate: Date;
  selectedDate?: Date;
  onDateSelect?: (date: Date) => void;
  onMonthChange?: (date: Date) => void;
  showWorkEvents?: boolean;
  showPersonalEvents?: boolean;
  onFilterChange?: (filters: { work: boolean; personal: boolean }) => void;
  onNewEvent?: () => void;
}

export default function CalendarSidebar({
  currentDate,
  selectedDate,
  onDateSelect,
  onMonthChange,
  showWorkEvents = true,
  showPersonalEvents = true,
  onFilterChange,
  onNewEvent,
}: CalendarSidebarProps) {
  const [selectedCalendar, setSelectedCalendar] = useState('Calendar');
  const [workEventsVisible, setWorkEventsVisible] = useState(showWorkEvents);
  const [personalEventsVisible, setPersonalEventsVisible] = useState(showPersonalEvents);

  const handleWorkToggle = (checked: boolean) => {
    setWorkEventsVisible(checked);
    if (onFilterChange) {
      onFilterChange({ work: checked, personal: personalEventsVisible });
    }
  };

  const handlePersonalToggle = (checked: boolean) => {
    setPersonalEventsVisible(checked);
    if (onFilterChange) {
      onFilterChange({ work: workEventsVisible, personal: checked });
    }
  };

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-full flex flex-col">
      {/* Mini Calendar Section */}
      <div className="p-4 border-b border-gray-200">
        <MiniCalendar
          currentDate={currentDate}
          selectedDate={selectedDate}
          onDateSelect={onDateSelect}
          onMonthChange={onMonthChange}
        />
      </div>

      {/* Actions Section */}
      <div className="p-4 border-b border-gray-200 space-y-2">
        <button 
          onClick={onNewEvent}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Event</span>
        </button>
        <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-colors">
          <Plus className="w-4 h-4" />
          <span>Add calendar</span>
        </button>
      </div>

      {/* Calendar Filters */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-600" />
          <h3 className="text-sm font-semibold text-gray-900">Filters</h3>
        </div>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={workEventsVisible}
              onChange={(e) => handleWorkToggle(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <div className="flex items-center gap-2 flex-1">
              <div className="w-3 h-3 rounded bg-blue-500"></div>
              <span className="text-sm text-gray-700 group-hover:text-gray-900">Work Events</span>
            </div>
          </label>
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={personalEventsVisible}
              onChange={(e) => handlePersonalToggle(e.target.checked)}
              className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
            />
            <div className="flex items-center gap-2 flex-1">
              <div className="w-3 h-3 rounded bg-green-500"></div>
              <span className="text-sm text-gray-700 group-hover:text-gray-900">Personal Events</span>
            </div>
          </label>
        </div>
      </div>

      {/* My Calendars Section */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">My Calendars</h3>
        </div>
        <div className="space-y-1">
          <button
            onClick={() => setSelectedCalendar('Calendar')}
            className={`
              w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors
              ${selectedCalendar === 'Calendar'
                ? 'bg-blue-50 text-blue-900 font-medium'
                : 'text-gray-700 hover:bg-gray-50'
              }
            `}
          >
            <CalendarIcon className="w-4 h-4" />
            <span>All Calendars</span>
          </button>
        </div>
      </div>
    </div>
  );
}

