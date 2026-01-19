'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { API_ENDPOINTS } from '@/lib/api';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, isSameMonth } from 'date-fns';
import QuickTimesheetEntry from './QuickTimesheetEntry';

interface Timesheet {
  id: number;
  date: string;
  hoursWorked: number;
  billableHours: number;
  nonBillableHours: number;
  activityType: string;
  description: string;
  status: string;
  matter: {
    id: number;
    title: string;
  } | null;
}

interface TimesheetCalendarProps {
  refreshTrigger?: number;
}

const minutesToTimeString = (minutes: number): string => {
  if (!minutes) return '00:00';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

export default function TimesheetCalendar({ refreshTrigger = 0 }: TimesheetCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isQuickEntryOpen, setIsQuickEntryOpen] = useState(false);
  const [selectedTimesheet, setSelectedTimesheet] = useState<Timesheet | null>(null);
  const [viewMode, setViewMode] = useState<'week' | 'month'>('month'); // ADD THIS LINE


  

  const fetchTimesheets = useCallback(async () => {
    try {
      // Only show full loading state on initial load
      if (timesheets.length === 0) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);
      const response = await fetch(API_ENDPOINTS.timesheets.list, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch timesheets');
      }

      const data = await response.json();
      if (data.success) {
        setTimesheets(data.data || []);
      } else {
        throw new Error(data.message || 'Failed to fetch timesheets');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch timesheets');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [timesheets.length]);

  useEffect(() => {
    fetchTimesheets();
  }, [currentDate, refreshTrigger, fetchTimesheets]);

  // REPLACE handleDateClick with these two functions:
  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setSelectedTimesheet(null); // Clear any selected timesheet
    setIsQuickEntryOpen(true);
  };

  const handleTimesheetClick = (e: React.MouseEvent, timesheet: Timesheet) => {
    e.stopPropagation(); // Prevent triggering the date click
    setSelectedTimesheet(timesheet);
    setSelectedDate(new Date(timesheet.date));
    setIsQuickEntryOpen(true);
  };

  const handleQuickEntrySuccess = () => {
    setIsQuickEntryOpen(false);
    setSelectedDate(null);
    fetchTimesheets();
  };

  const getTimesheetsForDay = (date: Date): Timesheet[] => {
    return timesheets.filter((ts) => isSameDay(new Date(ts.date), date));
  };

  const getTotalHoursForDay = (date: Date): number => {
    const dayTimesheets = getTimesheetsForDay(date);
    return dayTimesheets.reduce((sum, ts) => sum + ts.hoursWorked, 0);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  // Calculate days based on view mode
  let allDays: Date[] = [];

  if (viewMode === 'week') {
    // Get current week (Sunday to Saturday)
    const today = new Date();
    const dayOfWeek = today.getDay();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - dayOfWeek);
    
    // Generate 7 days for the week
    allDays = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      return date;
    });
  } else {
    // Month view - existing logic
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Add days from previous/next month to fill the grid
    const firstDayOfWeek = monthStart.getDay();
    const lastDayOfWeek = monthEnd.getDay();
    const daysBefore = Array.from({ length: firstDayOfWeek }, (_, i) => {
      const date = new Date(monthStart);
      date.setDate(date.getDate() - firstDayOfWeek + i);
      return date;
    });
    const daysAfter = Array.from({ length: 6 - lastDayOfWeek }, (_, i) => {
      const date = new Date(monthEnd);
      date.setDate(date.getDate() + i + 1);
      return date;
    });
    allDays = [...daysBefore, ...days, ...daysAfter];
  }

  const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const toggleViewMode = () => {
    setViewMode((prev) => prev === 'week' ? 'month' : 'week');
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-gray-500">Loading calendar...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {/* Calendar Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-1">
              {viewMode === 'month' && (
              <>
                <button
                  onClick={goToPreviousMonth}
                  className="px-1 py-2 hover:bg-gray-100 rounded-lg disabled:opacity-50"
                  disabled={isRefreshing}
                >
                  ←
                </button>
                <div className="flex items-center space-x-1 min-w-[200px] justify-center">
                  <h2 className="text-xl font-semibold">
                    {format(currentDate, 'MMMM yyyy')}
                  </h2>
                  {isRefreshing && (
                    <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                  )}
                </div>
                <button
                  onClick={goToNextMonth}
                  className="px-1 py-2 hover:bg-gray-100 rounded-lg disabled:opacity-50"
                  disabled={isRefreshing}
                >
                  →
                </button>
              </>
            )}
            {viewMode === 'week' && (
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-semibold">
                  Week ({format(allDays[0], 'MMM d')} - {format(allDays[6], 'MMM d, yyyy')})
                </h2>
                {isRefreshing && (
                  <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                )}
              </div>
            )}
            <button
              onClick={toggleViewMode}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              disabled={isRefreshing}
            >
              {viewMode === 'week' ? 'This Month' : 'This Week'}
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          {/* Day Headers */}
          <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
            {dayHeaders.map((day) => (
              <div
                key={day}
                className="px-4 py-3 text-sm font-semibold text-gray-700 text-center border-r border-gray-200 last:border-r-0"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7">
            {allDays.map((day, index) => {
              const dayTimesheets = getTimesheetsForDay(day);
              const totalHours = getTotalHoursForDay(day);
              const isDayToday = isToday(day);
              const isDayInCurrentMonth = viewMode === 'week' ? true : isSameMonth(day, startOfMonth(currentDate));
              return (
                <div
                  key={index}
                  className={`
                    border-r border-b border-gray-200 p-2 min-h-[120px] transition-colors cursor-pointer
                    ${isDayInCurrentMonth ? 'bg-white' : 'bg-gray-50'}
                    ${isDayToday ? 'bg-blue-50' : ''}
                    hover:bg-gray-100
                  `}
                  onClick={() => handleDateClick(day)}
                >
                  {/* Date Number */}
                  <div
                    className={`
                      flex items-center justify-center w-8 h-8 mb-2 rounded-full text-sm font-medium
                      ${isDayToday
                        ? 'bg-blue-600 text-white'
                        : isDayInCurrentMonth
                        ? 'text-gray-900'
                        : 'text-gray-400'
                      }
                    `}
                  >
                    {format(day, 'd')}
                  </div>

                  {/* Timesheet Entries */}
                  <div className="space-y-1">
                    {dayTimesheets.length > 0 ? (
                      <>
                        {dayTimesheets.slice(0, 2).map((ts) => (
                          <div
                            key={ts.id}
                            className={`text-xs p-1 rounded border ${getStatusColor(ts.status)} cursor-pointer hover:opacity-80`}
                            title={`${ts.matter?.title || 'No Matter'}: ${ts.hoursWorked}h - ${ts.status}`}
                            onDoubleClick={(e) => handleTimesheetClick(e, ts)}
                            onClick={(e) => e.stopPropagation()} // Prevent single click from triggering date click
                          >
                            <div className="font-medium truncate">{ts.matter?.title || 'No Matter'}</div>
                            <div className="text-xs opacity-75">{minutesToTimeString(ts.hoursWorked)}h</div>
                          </div>
                        ))}
                        {dayTimesheets.length > 2 && (
                          <div className="text-xs text-gray-500 px-1">
                            +{dayTimesheets.length - 2} more
                          </div>
                        )}
                        {totalHours > 0 && (
                          <div className="text-xs font-semibold text-gray-700 mt-1">
                            Total: {minutesToTimeString(totalHours)}h
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-xs text-gray-400 text-center py-2">
                        Click to add
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Quick Entry Dialog */}
      {selectedDate && (
        <QuickTimesheetEntry
          open={isQuickEntryOpen}
          onOpenChange={setIsQuickEntryOpen}
          selectedDate={selectedDate}
          selectedTimesheet={selectedTimesheet}
          onSuccess={handleQuickEntrySuccess}
        />
      )}
    </>
  );
}

