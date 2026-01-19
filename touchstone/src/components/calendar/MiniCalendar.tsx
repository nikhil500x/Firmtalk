'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
} from 'date-fns';
import { isToday } from '@/lib/calendarUtils';

interface MiniCalendarProps {
  currentDate: Date;
  selectedDate?: Date;
  onDateSelect?: (date: Date) => void;
  onMonthChange?: (date: Date) => void;
}

export default function MiniCalendar({
  currentDate,
  selectedDate,
  onDateSelect,
  onMonthChange,
}: MiniCalendarProps) {
  const [displayMonth, setDisplayMonth] = useState(startOfMonth(currentDate));

  const monthStart = startOfMonth(displayMonth);
  const monthEnd = endOfMonth(displayMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const dayAbbreviations = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const handlePreviousMonth = () => {
    const newMonth = subMonths(displayMonth, 1);
    setDisplayMonth(newMonth);
    onMonthChange?.(newMonth);
  };

  const handleNextMonth = () => {
    const newMonth = addMonths(displayMonth, 1);
    setDisplayMonth(newMonth);
    onMonthChange?.(newMonth);
  };

  const handleDateClick = (date: Date) => {
    onDateSelect?.(date);
  };

  return (
    <div className="w-full">
      {/* Month/Year Header with Navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={handlePreviousMonth}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-4 h-4 text-gray-600" />
        </button>
        <div className="text-sm font-semibold text-gray-900">
          {format(displayMonth, 'MMMM yyyy')}
        </div>
        <button
          onClick={handleNextMonth}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          aria-label="Next month"
        >
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      {/* Day Abbreviations */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {dayAbbreviations.map((day, index) => (
          <div
            key={index}
            className="text-xs font-medium text-gray-500 text-center py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, index) => {
          const isCurrentMonth = isSameMonth(day, displayMonth);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isCurrentDay = isToday(day);

          return (
            <button
              key={index}
              onClick={() => handleDateClick(day)}
              className={`
                aspect-square text-xs p-1 rounded transition-colors
                ${!isCurrentMonth ? 'text-gray-400' : 'text-gray-900'}
                ${isCurrentDay
                  ? 'bg-blue-600 text-white font-semibold'
                  : isSelected
                  ? 'bg-blue-100 text-blue-900 font-semibold'
                  : 'hover:bg-gray-100'
                }
              `}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}

