'use client';

import { CalendarEvent, getWeekDates, getWorkWeekDates, getEventsForDay, calculateEventPosition, groupOverlappingEvents, isToday } from '@/lib/calendarUtils';
import CalendarEventBlock from './CalendarEventBlock';
import { format, getHours, getMinutes } from 'date-fns';
import { parseISO } from 'date-fns';

interface WeekViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  onDateClick?: (date: Date) => void;
  weekStartsOn?: 0 | 1;
  isWorkWeek?: boolean;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i); // 0-23 hours
const SLOT_HEIGHT = 60; // pixels per hour

export default function WeekView({
  currentDate,
  events,
  onEventClick,
  onDateClick,
  weekStartsOn = 0,
  isWorkWeek = false,
}: WeekViewProps) {
  const { days } = isWorkWeek ? getWorkWeekDates(currentDate) : getWeekDates(currentDate, weekStartsOn);
  const gridColsClass = isWorkWeek ? 'grid-cols-6' : 'grid-cols-8'; // 1 time column + 5/7 day columns
  const now = new Date();
  const currentHour = getHours(now);
  const currentMinute = getMinutes(now);
  const currentTimePosition = (currentHour + currentMinute / 60) * SLOT_HEIGHT;

  // Group all-day events separately
  const allDayEvents = events.filter(event => {
    const start = parseISO(event.start.dateTime);
    const end = parseISO(event.end.dateTime);
    const duration = end.getTime() - start.getTime();
    return duration >= 86400000 || !event.start.dateTime.includes('T'); // 24 hours or no time component
  });

  return (
    <div className="h-full flex flex-col">
      {/* All-Day Events Bar */}
      {allDayEvents.length > 0 && (
        <div className="border-b border-gray-200 bg-gray-50 px-16 py-2">
          <div className="text-xs font-semibold text-gray-500 mb-1">All day</div>
          <div className="flex gap-2">
            {allDayEvents.map((event) => (
              <CalendarEventBlock
                key={event.id}
                event={event}
                view="week"
                onClick={onEventClick}
              />
            ))}
          </div>
        </div>
      )}

      {/* Week Grid */}
      <div className="flex-1 overflow-auto relative">
        {/* Day Headers */}
        <div className={`sticky top-0 z-10 grid ${gridColsClass} border-b border-gray-200 bg-white`}>
          <div className="px-4 py-3 border-r border-gray-200"></div>
          {days.map((day, index) => {
            const isDayToday = isToday(day);
            return (
              <div
                key={index}
                onClick={() => onDateClick?.(day)}
                className={`
                  px-4 py-3 text-center border-r border-gray-200 last:border-r-0 cursor-pointer transition-colors
                  ${isDayToday ? 'bg-blue-50' : ''}
                `}
              >
                <div className="text-sm font-semibold text-gray-900">
                  {format(day, 'EEE')}
                </div>
                <div
                  className={`
                    text-lg font-semibold mt-1
                    ${isDayToday ? 'text-blue-600' : 'text-gray-900'}
                  `}
                >
                  {format(day, 'd')}
                </div>
              </div>
            );
          })}
        </div>

        {/* Time Slots Grid */}
        <div className={`grid ${gridColsClass} relative`}>
          {/* Time Column */}
          <div className="border-r border-gray-200 bg-gray-50">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="h-[60px] border-b border-gray-100 relative"
              >
                <div className="absolute -top-2 left-2 text-xs text-gray-500">
                  {format(new Date(2000, 0, 1, hour, 0, 0), 'h:mm a')}
                </div>
              </div>
            ))}
          </div>

          {/* Day Columns */}
          {days.map((day, index) => {
            const dayEvents = getEventsForDay(events, day).filter(event => {
              const start = parseISO(event.start.dateTime);
              const end = parseISO(event.end.dateTime);
              const duration = end.getTime() - start.getTime();
              return duration < 86400000 && event.start.dateTime.includes('T'); // Not all-day
            });

            const overlappingGroups = groupOverlappingEvents(dayEvents);

            return (
              <div
                key={index}
                className="border-r border-gray-200 last:border-r-0 relative"
              >
                {/* Time Slots */}
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="h-[60px] border-b border-gray-100 relative"
                  ></div>
                ))}

                {/* Current Time Indicator */}
                {isToday(day) && (
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
                {overlappingGroups.map((group, groupIndex) => {
                  const groupWidth = 100 / group.length;
                  return group.map((event, eventIndex) => {
                    const position = calculateEventPosition(event, SLOT_HEIGHT);
                    const left = (eventIndex * groupWidth);
                    const width = groupWidth;

                    return (
                      <div
                        key={event.id}
                        className="absolute z-10"
                        style={{
                          top: `${position.top}px`,
                          left: `${left}%`,
                          width: `${width}%`,
                          height: `${position.height}px`,
                        }}
                      >
                        <CalendarEventBlock
                          event={event}
                          view="week"
                          onClick={onEventClick}
                          className="h-full"
                        />
                      </div>
                    );
                  });
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

