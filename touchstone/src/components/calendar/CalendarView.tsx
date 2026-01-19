'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import CalendarLayout from './CalendarLayout';
import MonthView from './MonthView';
import WeekView from './WeekView';
import DayView from './DayView';
import EventDetailModal from './EventDetailModal';
import EventDialog from './EventDialog';
import { CalendarEvent } from '@/lib/calendarUtils';
import { API_ENDPOINTS, apiRequest } from '@/lib/api';
import { navigatePreviousDate, navigateNextDate, getEventsForDateRange, isOrganizationalCalendar } from '@/lib/calendarUtils';
import { startOfMonth, startOfWeek, startOfDay, addHours } from 'date-fns';
import type { CalendarView as ViewType } from './ViewToggle';
import { useCalendarShortcuts } from './useCalendarShortcuts';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface CalendarResponse {
  events: CalendarEvent[];
}

export default function CalendarView() {
  const searchParams = useSearchParams();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<ViewType>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showReconnectDialog, setShowReconnectDialog] = useState(false);
  const [isRefreshingToken, setIsRefreshingToken] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [eventDialogDate, setEventDialogDate] = useState<Date | undefined>(undefined);
  const [eventDialogStartTime, setEventDialogStartTime] = useState<Date | undefined>(undefined);
  const [eventDialogEndTime, setEventDialogEndTime] = useState<Date | undefined>(undefined);
  const [showWorkEvents, setShowWorkEvents] = useState(true);
  const [showPersonalEvents, setShowPersonalEvents] = useState(true);
  const fetchedRangesRef = useRef<Set<string>>(new Set());
  const currentMonthYearRef = useRef<string>('');

  // Calculate date range based on current view - memoized to prevent unnecessary recalculations
  const getDateRange = useMemo(() => {
    switch (currentView) {
      case 'day':
        const dayStart = startOfDay(currentDate);
        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);
        return { start: dayStart, end: dayEnd };
      case 'work-week':
      case 'week':
        const weekStart = startOfWeek(currentDate, { weekStartsOn: currentView === 'work-week' ? 1 : 0 });
        const weekEnd = new Date(weekStart);
        if (currentView === 'work-week') {
          weekEnd.setDate(weekEnd.getDate() + 4); // Monday to Friday
        } else {
          weekEnd.setDate(weekEnd.getDate() + 6); // Sunday to Saturday
        }
        weekEnd.setHours(23, 59, 59, 999);
        // Add buffer weeks before and after
        const extendedWeekStart = new Date(weekStart);
        extendedWeekStart.setDate(extendedWeekStart.getDate() - 7); // One week before
        const extendedWeekEnd = new Date(weekEnd);
        extendedWeekEnd.setDate(extendedWeekEnd.getDate() + 7); // One week after
        return { start: extendedWeekStart, end: extendedWeekEnd };
      case 'month':
        const monthStart = startOfMonth(currentDate);
        const monthEnd = new Date(monthStart);
        monthEnd.setMonth(monthEnd.getMonth() + 1);
        monthEnd.setDate(0); // Last day of month
        monthEnd.setHours(23, 59, 59, 999);
        // Fetch wider range to include previous/next month dates shown in grid
        const extendedStart = new Date(monthStart);
        extendedStart.setDate(extendedStart.getDate() - 7); // One week before
        const extendedEnd = new Date(monthEnd);
        extendedEnd.setDate(extendedEnd.getDate() + 7); // One week after
        return { start: extendedStart, end: extendedEnd };
    }
  }, [currentView, currentDate]);

  // Attempt to refresh Azure token
  const attemptTokenRefresh = useCallback(async (): Promise<boolean> => {
    try {
      setIsRefreshingToken(true);
      console.log('[Calendar] Attempting to refresh Azure token...');
      
      const response = await apiRequest<{ refreshed: boolean }>(
        API_ENDPOINTS.azure.refreshToken,
        { method: 'POST' }
      );

      if (response.success && response.data?.refreshed) {
        console.log('[Calendar] Token refreshed successfully');
        return true;
      } else {
        console.warn('[Calendar] Token refresh failed:', response.message);
        return false;
      }
    } catch (err) {
      console.error('[Calendar] Token refresh error:', err);
      return false;
    } finally {
      setIsRefreshingToken(false);
    }
  }, []);

  const fetchEvents = useCallback(async (retryAfterRefresh = false) => {
    const range = getDateRange;
    
    // Detect month/year change for month view
    const currentMonthYear = currentView === 'month' 
      ? `${currentDate.getFullYear()}-${currentDate.getMonth()}`
      : '';
    
    const monthChanged = currentMonthYear && currentMonthYearRef.current !== currentMonthYear;
    
    // If month/year changed, clear cache to force fresh fetch
    if (monthChanged) {
      console.log('[Calendar] Month changed from', currentMonthYearRef.current, 'to', currentMonthYear, '- clearing cache');
      fetchedRangesRef.current.clear();
      currentMonthYearRef.current = currentMonthYear;
    }
    
    const rangeKey = `${range.start.toISOString().split('T')[0]}_${range.end.toISOString().split('T')[0]}`;
    
    // Check if we already have this range cached (only if month hasn't changed)
    if (!monthChanged && fetchedRangesRef.current.has(rangeKey)) {
      console.log('[Calendar] Using cached events for range:', range.start.toISOString(), 'to', range.end.toISOString());
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const startDateStr = range.start.toISOString().split('T')[0];
      const endDateStr = range.end.toISOString().split('T')[0];

      console.log('[Calendar] Fetching events for range:', startDateStr, 'to', endDateStr);

      const response = await apiRequest<CalendarResponse>(
        `${API_ENDPOINTS.azure.calendar.events}?startDate=${startDateStr}&endDate=${endDateStr}`
      );

      if (response.success && response.data) {
        const newEvents = response.data.events || [];
        console.log('[Calendar] Fetched', newEvents.length, 'events');
        
        // Merge with existing events, avoiding duplicates
        setEvents(prevEvents => {
          const eventMap = new Map<string, CalendarEvent>();
          
          // Add existing events
          prevEvents.forEach(event => {
            eventMap.set(event.id, event);
          });
          
          // Add new events (overwrite if same ID)
          newEvents.forEach(event => {
            eventMap.set(event.id, event);
          });
          
          const merged = Array.from(eventMap.values());
          console.log('[Calendar] Total events after merge:', merged.length);
          return merged;
        });
        
        // Mark this range as fetched
        fetchedRangesRef.current.add(rangeKey);
      } else {
        const errorMsg = response.message || 'Failed to load calendar events';
        // Check for token expiration or connection issues
        if (errorMsg.includes('expired') || errorMsg.includes('refresh token') || errorMsg.includes('reconnect')) {
          // If we haven't tried refreshing yet, attempt it
          if (!retryAfterRefresh) {
            console.log('[Calendar] Token expired detected, attempting auto-refresh...');
            const refreshed = await attemptTokenRefresh();
            if (refreshed) {
              // Retry fetching events after successful refresh
              console.log('[Calendar] Token refreshed, retrying event fetch...');
              return fetchEvents(true);
            } else {
              // Refresh failed, show reconnect dialog
              setShowReconnectDialog(true);
              setError('Azure token expired. Please reconnect your Azure account to view calendar events.');
            }
          } else {
            // Already tried refresh, show reconnect dialog
            setShowReconnectDialog(true);
            setError('Azure token expired. Please reconnect your Azure account to view calendar events.');
          }
        } else if (errorMsg.includes('not connected')) {
          setError('Azure account not connected. Please connect your Azure account to view calendar events.');
        } else {
          setError(errorMsg);
        }
      }
    } catch (err) {
      console.error('[Calendar] Failed to fetch calendar events:', err);
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      if (errorMsg.includes('not connected')) {
        setError('Azure account not connected. Please connect your Azure account to view calendar events.');
      } else if (errorMsg.includes('expired') || errorMsg.includes('refresh token') || errorMsg.includes('reconnect')) {
        // If we haven't tried refreshing yet, attempt it
        if (!retryAfterRefresh) {
          console.log('[Calendar] Token expired detected in catch, attempting auto-refresh...');
          const refreshed = await attemptTokenRefresh();
          if (refreshed) {
            // Retry fetching events after successful refresh
            console.log('[Calendar] Token refreshed, retrying event fetch...');
            return fetchEvents(true);
          } else {
            // Refresh failed, show reconnect dialog
            setShowReconnectDialog(true);
            setError('Azure token expired. Please reconnect your Azure account to view calendar events.');
          }
        } else {
          // Already tried refresh, show reconnect dialog
          setShowReconnectDialog(true);
          setError('Azure token expired. Please reconnect your Azure account to view calendar events.');
        }
      } else {
        setError('Failed to load calendar events. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [getDateRange, attemptTokenRefresh]);

  // Check for Azure connection success message from OAuth callback
  useEffect(() => {
    const azureConnected = searchParams.get('azure_connected');
    const azureError = searchParams.get('azure_error');
    
    if (azureConnected === 'true') {
      // Reset fetched ranges and fetch fresh data
      fetchedRangesRef.current.clear();
      fetchEvents();
    }
    
    if (azureError) {
      setError(`Azure connection failed: ${decodeURIComponent(azureError)}`);
    }
  }, [searchParams, fetchEvents]);

  // Fetch events when view or date changes
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handlePrevious = () => {
    setCurrentDate(navigatePreviousDate(currentDate, currentView));
  };

  const handleNext = () => {
    setCurrentDate(navigateNextDate(currentDate, currentView));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(undefined);
  };

  const handleViewChange = (view: ViewType) => {
    setCurrentView(view);
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setCurrentDate(date);
    if (currentView === 'month') {
      // Switch to day view when clicking a date in month view
      setCurrentView('day');
    }
  };

  const handleMonthChange = (date: Date) => {
    setCurrentDate(date);
  };

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsEventModalOpen(true);
  };

  const handleDateClick = (date: Date) => {
    handleDateSelect(date);
  };

  const handleTimeSlotClick = (date: Date, hour?: number) => {
    const startTime = hour !== undefined 
      ? new Date(date)
      : new Date(date);
    
    if (hour !== undefined) {
      startTime.setHours(hour, 0, 0, 0);
    }
    
    const endTime = addHours(startTime, 1);
    
    setEventDialogDate(date);
    setEventDialogStartTime(startTime);
    setEventDialogEndTime(endTime);
    setIsEventDialogOpen(true);
  };

  const handleNewEvent = () => {
    setEventDialogDate(undefined);
    setEventDialogStartTime(undefined);
    setEventDialogEndTime(undefined);
    setIsEventDialogOpen(true);
  };

  const handleEventSaved = () => {
    // Clear cache to force refresh
    fetchedRangesRef.current.clear();
    // Refetch events
    fetchEvents();
  };

  const handleEventChanged = () => {
    // Clear cache to force refresh
    fetchedRangesRef.current.clear();
    // Refetch events
    fetchEvents();
  };

  // Keyboard shortcuts
  useCalendarShortcuts({
    onPrevious: handlePrevious,
    onNext: handleNext,
    onToday: handleToday,
    onViewChange: handleViewChange,
    currentView,
    onCloseModal: () => setIsEventModalOpen(false),
  });

  // Filter events for current view range and calendar type
  const getViewEvents = (): CalendarEvent[] => {
    const { start, end } = getDateRange; // getDateRange is a memoized value, not a function
    const rangeEvents = getEventsForDateRange(events, start, end);
    
    // Apply calendar type filters
    return rangeEvents.filter(event => {
      const isOrg = isOrganizationalCalendar(event);
      if (isOrg && !showWorkEvents) return false;
      if (!isOrg && !showPersonalEvents) return false;
      return true;
    });
  };

  const viewEvents = getViewEvents();

  const handleFilterChange = (filters: { work: boolean; personal: boolean }) => {
    setShowWorkEvents(filters.work);
    setShowPersonalEvents(filters.personal);
  };

  return (
    <>
      <CalendarLayout
        currentView={currentView}
        currentDate={currentDate}
        selectedDate={selectedDate}
        onViewChange={handleViewChange}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onToday={handleToday}
        onDateSelect={handleDateSelect}
        onMonthChange={handleMonthChange}
        showWorkEvents={showWorkEvents}
        showPersonalEvents={showPersonalEvents}
        onFilterChange={handleFilterChange}
        onNewEvent={handleNewEvent}
      >
        {error && (
          <div className="p-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <p className="text-red-800 font-medium">{error}</p>
                  {(error.includes('expired') || error.includes('reconnect') || error.includes('not connected')) && (
                    <p className="text-red-700 text-sm mt-2">
                      {isRefreshingToken 
                        ? 'Attempting to refresh your Azure token...'
                        : 'Use the &quot;Azure Connected&quot; button in the top bar to reconnect your Azure account.'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {loading && !error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading events...</p>
            </div>
          </div>
        ) : !error && viewEvents.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No events in this period</h3>
              <p className="text-sm text-gray-500 mb-6">
                {currentView === 'month' 
                  ? 'No events scheduled for this month'
                  : currentView === 'week' || currentView === 'work-week'
                  ? 'No events scheduled for this week'
                  : 'No events scheduled for this day'}
              </p>
              <div className="flex flex-col items-center gap-2 text-xs text-gray-400">
                <p>• Check your calendar filters in the sidebar</p>
                <p>• Navigate to a different date range</p>
                <p>• Make sure your Azure account is connected</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {currentView === 'month' && (
              <MonthView
                currentDate={currentDate}
                events={viewEvents}
                onEventClick={handleEventClick}
                onDateClick={handleDateClick}
              />
            )}
            {currentView === 'week' && (
              <WeekView
                currentDate={currentDate}
                events={viewEvents}
                onEventClick={handleEventClick}
                onDateClick={handleDateClick}
              />
            )}
            {currentView === 'work-week' && (
              <WeekView
                currentDate={currentDate}
                events={viewEvents}
                onEventClick={handleEventClick}
                onDateClick={handleDateClick}
                weekStartsOn={1}
                isWorkWeek={true}
              />
            )}
            {currentView === 'day' && (
              <DayView
                currentDate={currentDate}
                events={viewEvents}
                onEventClick={handleEventClick}
              />
            )}
          </>
        )}
      </CalendarLayout>

      <EventDetailModal
        event={selectedEvent}
        open={isEventModalOpen}
        onOpenChange={setIsEventModalOpen}
        onEventChange={handleEventChanged}
      />

      <EventDialog
        event={null}
        open={isEventDialogOpen}
        onOpenChange={setIsEventDialogOpen}
        onSave={handleEventSaved}
        defaultDate={eventDialogDate}
        defaultStartTime={eventDialogStartTime}
        defaultEndTime={eventDialogEndTime}
      />

      {/* Azure Reconnect Dialog */}
      <Dialog open={showReconnectDialog} onOpenChange={setShowReconnectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Azure Token Expired</DialogTitle>
            <DialogDescription>
              Your Azure authentication token has expired and could not be automatically renewed. 
              Please reconnect your Azure account to continue viewing calendar events.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowReconnectDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                // Redirect to Azure connect endpoint
                window.location.href = API_ENDPOINTS.azure.connect;
              }}
            >
              Reconnect Azure Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
