'use client';

import { CalendarEvent, getEventsForDay, calculateEventPosition, isToday } from '@/lib/calendarUtils';
import CalendarEventBlock from './CalendarEventBlock';
import { format, getHours, getMinutes } from 'date-fns';
import { parseISO } from 'date-fns';

interface DayViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i); // 0-23 hours
const SLOT_HEIGHT = 60; // pixels per hour

export default function DayView({
  currentDate,
  events,
  onEventClick,
}: DayViewProps) {
  const dayEvents = getEventsForDay(events, currentDate);
  const now = new Date();
  const isDayToday = isToday(currentDate);
  const currentHour = getHours(now);
  const currentMinute = getMinutes(now);
  const currentTimePosition = (currentHour + currentMinute / 60) * SLOT_HEIGHT;

  // Separate all-day events
  const allDayEvents = dayEvents.filter(event => {
    const start = parseISO(event.start.dateTime);
    const end = parseISO(event.end.dateTime);
    const duration = end.getTime() - start.getTime();
    return duration >= 86400000 || !event.start.dateTime.includes('T');
  });

  const timedEvents = dayEvents.filter(event => {
    const start = parseISO(event.start.dateTime);
    const end = parseISO(event.end.dateTime);
    const duration = end.getTime() - start.getTime();
    return duration < 86400000 && event.start.dateTime.includes('T');
  });

  return (
    <div className="h-full flex flex-col">
      {/* Day Header */}
      <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
        <div className="text-lg font-semibold text-gray-900">
          {format(currentDate, 'EEEE, MMMM d, yyyy')}
        </div>
      </div>

      {/* All-Day Events */}
      {allDayEvents.length > 0 && (
        <div className="border-b border-gray-200 bg-gray-50 px-6 py-2">
          <div className="text-xs font-semibold text-gray-500 mb-2">All day</div>
          <div className="flex gap-2">
            {allDayEvents.map((event) => (
              <CalendarEventBlock
                key={event.id}
                event={event}
                view="day"
                onClick={onEventClick}
              />
            ))}
          </div>
        </div>
      )}

      {/* Time Slots */}
      <div className="flex-1 overflow-auto relative">
        <div className="grid grid-cols-2">
          {/* Time Column */}
          <div className="border-r border-gray-200 bg-gray-50">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="h-[60px] border-b border-gray-100 relative"
              >
                <div className="absolute -top-2 left-4 text-xs text-gray-500">
                  {format(new Date(2000, 0, 1, hour, 0, 0), 'h:mm a')}
                </div>
              </div>
            ))}
          </div>

          {/* Events Column */}
          <div className="relative">
            {/* Time Slots */}
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="h-[60px] border-b border-gray-100"
              ></div>
            ))}

            {/* Current Time Indicator */}
            {isDayToday && (
              <div
                className="absolute left-0 right-0 z-20 pointer-events-none"
                style={{ top: `${currentTimePosition}px` }}
              >
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-red-500 rounded-full -ml-1"></div>
                  <div className="flex-1 h-0.5 bg-red-500"></div>
                </div>
              </div>
            )}

            {/* Event Blocks */}
            {timedEvents.map((event) => {
              const position = calculateEventPosition(event, SLOT_HEIGHT);

              return (
                <div
                  key={event.id}
                  className="absolute z-10 px-2"
                  style={{
                    top: `${position.top}px`,
                    left: '0',
                    right: '0',
                    height: `${position.height}px`,
                  }}
                >
                  <CalendarEventBlock
                    event={event}
                    view="day"
                    onClick={onEventClick}
                    className="h-full"
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

