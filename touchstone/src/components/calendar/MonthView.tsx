'use client';

import { CalendarEvent, getMonthDates, getEventsForDay, isToday, isCurrentMonth } from '@/lib/calendarUtils';
import CalendarEventBlock from './CalendarEventBlock';
import { format } from 'date-fns';

interface MonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  onDateClick?: (date: Date) => void;
}

export default function MonthView({
  currentDate,
  events,
  onEventClick,
  onDateClick,
}: MonthViewProps) {
  const { days, monthStart } = getMonthDates(currentDate);
  
  const dayHeaders = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className="h-full flex flex-col">
      {/* Day Headers */}
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
        {dayHeaders.map((day, index) => (
          <div
            key={index}
            className="px-4 py-3 text-sm font-semibold text-gray-700 text-center border-r border-gray-200 last:border-r-0"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 grid grid-rows-6 grid-cols-7">
        {days.map((day, index) => {
          const dayEvents = getEventsForDay(events, day);
          const isDayToday = isToday(day);
          const isDayInCurrentMonth = isCurrentMonth(day, monthStart);
          
          // Limit visible events to 3-4 for better display
          const visibleEvents = dayEvents.slice(0, 4);
          const hiddenCount = dayEvents.length - visibleEvents.length;

          return (
            <div
              key={index}
              className={`
                border-r border-b border-gray-200 p-2 min-h-[100px] transition-colors
                ${isDayInCurrentMonth ? 'bg-white' : 'bg-gray-50'}
                ${isDayToday ? 'bg-blue-50' : ''}
              `}
            >
              {/* Date Number */}
              <div
                onClick={() => onDateClick?.(day)}
                className={`
                  flex items-center justify-center w-8 h-8 mb-2 rounded-full cursor-pointer transition-colors
                  ${isDayToday
                    ? 'bg-blue-600 text-white font-semibold'
                    : isDayInCurrentMonth
                    ? 'text-gray-900 hover:bg-gray-100'
                    : 'text-gray-400 hover:bg-gray-100'
                  }
                `}
              >
                {format(day, 'd')}
              </div>

              {/* Events */}
              <div className="space-y-1">
                {visibleEvents.map((event) => (
                  <CalendarEventBlock
                    key={event.id}
                    event={event}
                    view="month"
                    onClick={onEventClick}
                  />
                ))}
                {hiddenCount > 0 && (
                  <div className="text-xs text-gray-500 px-2 py-1">
                    +{hiddenCount} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

