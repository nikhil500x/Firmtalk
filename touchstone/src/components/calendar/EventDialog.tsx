'use client';

import { useState, useEffect } from 'react';
import { format, parseISO, addHours, setHours, setMinutes } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CalendarEvent, isRecurringEvent } from '@/lib/calendarUtils';
import { API_ENDPOINTS, apiRequest } from '@/lib/api';
import { Calendar as CalendarIcon, Clock, MapPin, Repeat2, X } from 'lucide-react';

interface Calendar {
  id: string;
  name: string;
  color?: string;
  canEdit?: boolean;
  canShare?: boolean;
  isDefaultCalendar?: boolean;
}

interface EventDialogProps {
  event: CalendarEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
  defaultDate?: Date;
  defaultStartTime?: Date;
  defaultEndTime?: Date;
}

export default function EventDialog({
  event,
  open,
  onOpenChange,
  onSave,
  defaultDate,
  defaultStartTime,
  defaultEndTime,
}: EventDialogProps) {
  const isEditMode = !!event;
  
  // Form state
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form fields
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isAllDay, setIsAllDay] = useState(false);
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  
  // Recurring event fields
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceDaysOfWeek, setRecurrenceDaysOfWeek] = useState<string[]>([]);
  const [recurrenceDayOfMonth, setRecurrenceDayOfMonth] = useState<number>(1);
  const [recurrenceEndType, setRecurrenceEndType] = useState<'never' | 'date' | 'count'>('never');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [recurrenceCount, setRecurrenceCount] = useState(10);

  // Load calendars on mount
  useEffect(() => {
    if (open) {
      loadCalendars();
    }
  }, [open]);

  // Populate form when editing
  useEffect(() => {
    if (event && open) {
      const start = parseISO(event.start.dateTime);
      const end = parseISO(event.end.dateTime);
      
      setSubject(event.subject || '');
      setStartDate(format(start, 'yyyy-MM-dd'));
      setStartTime(format(start, 'HH:mm'));
      setEndDate(format(end, 'yyyy-MM-dd'));
      setEndTime(format(end, 'HH:mm'));
      setIsAllDay(event.isAllDay || false);
      setLocation(event.location?.displayName || '');
      setDescription(event.bodyPreview || '');
      setSelectedCalendarId(event.calendarId || '');
      
      // Handle recurrence
      const recurring = isRecurringEvent(event);
      setIsRecurring(recurring);
      
      if (recurring && event.recurrence?.pattern) {
        const pattern = event.recurrence.pattern;
        if (pattern.type) {
          setRecurrenceType(pattern.type as 'daily' | 'weekly' | 'monthly' | 'yearly');
        }
        if (pattern.interval) {
          setRecurrenceInterval(pattern.interval);
        }
        if (pattern.daysOfWeek) {
          setRecurrenceDaysOfWeek(pattern.daysOfWeek);
        }
        if (pattern.dayOfMonth) {
          setRecurrenceDayOfMonth(pattern.dayOfMonth);
        }
        
        if (event.recurrence?.range) {
          const range = event.recurrence.range;
          if (range.endDate) {
            setRecurrenceEndType('date');
            setRecurrenceEndDate(range.endDate.split('T')[0]);
          } else if (range.numberOfOccurrences) {
            setRecurrenceEndType('count');
            setRecurrenceCount(range.numberOfOccurrences);
          }
        }
      }
    } else if (!event && open) {
      // New event - set defaults
      const now = defaultDate || new Date();
      const start = defaultStartTime || now;
      const end = defaultEndTime || addHours(start, 1);
      
      setSubject('');
      setStartDate(format(start, 'yyyy-MM-dd'));
      setStartTime(format(start, 'HH:mm'));
      setEndDate(format(end, 'yyyy-MM-dd'));
      setEndTime(format(end, 'HH:mm'));
      setIsAllDay(false);
      setLocation('');
      setDescription('');
      setIsRecurring(false);
      
      // Set default calendar once calendars are loaded
      if (calendars.length > 0 && !selectedCalendarId) {
        const defaultCalendar = calendars.find(c => c.isDefaultCalendar) || calendars[0];
        if (defaultCalendar) {
          setSelectedCalendarId(defaultCalendar.id);
        }
      }
    }
  }, [event, open, defaultDate, defaultStartTime, defaultEndTime]);

  // Set default calendar when calendars load
  useEffect(() => {
    if (calendars.length > 0 && !selectedCalendarId && !isEditMode) {
      const defaultCalendar = calendars.find(c => c.isDefaultCalendar) || calendars[0];
      if (defaultCalendar) {
        setSelectedCalendarId(defaultCalendar.id);
      }
    }
  }, [calendars, selectedCalendarId, isEditMode]);

  const loadCalendars = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiRequest<{ calendars: Calendar[] }>(
        API_ENDPOINTS.azure.calendar.calendars
      );
      
      if (response.success && response.data) {
        setCalendars(response.data.calendars);
      } else {
        setError('Failed to load calendars');
      }
    } catch (err) {
      console.error('Error loading calendars:', err);
      setError('Failed to load calendars');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!subject.trim()) {
      setError('Subject is required');
      return;
    }
    
    if (!selectedCalendarId) {
      setError('Please select a calendar');
      return;
    }
    
    setSaving(true);
    setError(null);
    
    try {
      const startDateTime = isAllDay 
        ? `${startDate}T00:00:00`
        : `${startDate}T${startTime}:00`;
      const endDateTime = isAllDay
        ? `${endDate}T23:59:59`
        : `${endDate}T${endTime}:00`;
      
      const eventData: {
        calendarId: string;
        subject: string;
        start: string;
        end: string;
        isAllDay: boolean;
        location?: string;
        body?: string;
        recurrence?: {
          type: string;
          interval: number;
          daysOfWeek?: string[];
          dayOfMonth?: number;
          endDate?: string;
          occurrences?: number;
        };
      } = {
        calendarId: selectedCalendarId,
        subject: subject.trim(),
        start: startDateTime,
        end: endDateTime,
        isAllDay,
        location: location.trim() || undefined,
        body: description.trim() || undefined,
      };
      
      // Add recurrence if enabled
      if (isRecurring) {
        const recurrence: {
          type: string;
          interval: number;
          daysOfWeek?: string[];
          dayOfMonth?: number;
          endDate?: string;
          occurrences?: number;
        } = {
          type: recurrenceType,
          interval: recurrenceInterval,
        };
        
        if (recurrenceType === 'weekly' && recurrenceDaysOfWeek.length > 0) {
          recurrence.daysOfWeek = recurrenceDaysOfWeek;
        }
        
        if ((recurrenceType === 'monthly' || recurrenceType === 'yearly') && recurrenceDayOfMonth) {
          recurrence.dayOfMonth = recurrenceDayOfMonth;
        }
        
        if (recurrenceEndType === 'date' && recurrenceEndDate) {
          recurrence.endDate = `${recurrenceEndDate}T23:59:59`;
        } else if (recurrenceEndType === 'count' && recurrenceCount > 0) {
          recurrence.occurrences = recurrenceCount;
        }
        
        eventData.recurrence = recurrence;
      }
      
      if (isEditMode && event) {
        // Update existing event
        const response = await apiRequest(
          API_ENDPOINTS.azure.calendar.updateEvent(event.id),
          {
            method: 'PUT',
            body: JSON.stringify(eventData),
          }
        );
        
        if (response.success) {
          onSave();
          onOpenChange(false);
        } else {
          setError(response.message || 'Failed to update event');
        }
      } else {
        // Create new event
        const response = await apiRequest(
          API_ENDPOINTS.azure.calendar.createEvent,
          {
            method: 'POST',
            body: JSON.stringify(eventData),
          }
        );
        
        if (response.success) {
          onSave();
          onOpenChange(false);
        } else {
          setError(response.message || 'Failed to create event');
        }
      }
    } catch (err) {
      console.error('Error saving event:', err);
      setError('Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!event || !confirm('Are you sure you want to delete this event?')) {
      return;
    }
    
    setSaving(true);
    setError(null);
    
    try {
      const response = await apiRequest(
        API_ENDPOINTS.azure.calendar.deleteEvent(event.id) + `?calendarId=${encodeURIComponent(event.calendarId || 'default')}&deleteSeries=false`,
        {
          method: 'DELETE',
        }
      );
      
      if (response.success) {
        onSave();
        onOpenChange(false);
      } else {
        setError(response.message || 'Failed to delete event');
      }
    } catch (err) {
      console.error('Error deleting event:', err);
      setError('Failed to delete event');
    } finally {
      setSaving(false);
    }
  };

  const weekDays = [
    { value: 'monday', label: 'Mon' },
    { value: 'tuesday', label: 'Tue' },
    { value: 'wednesday', label: 'Wed' },
    { value: 'thursday', label: 'Thu' },
    { value: 'friday', label: 'Fri' },
    { value: 'saturday', label: 'Sat' },
    { value: 'sunday', label: 'Sun' },
  ];

  const toggleDayOfWeek = (day: string) => {
    setRecurrenceDaysOfWeek(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">
            {isEditMode ? 'Edit Event' : 'New Event'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm">
              {error}
            </div>
          )}

          {/* Calendar Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" />
              Calendar
            </label>
            <select
              value={selectedCalendarId}
              onChange={(e) => setSelectedCalendarId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
              required
            >
              <option value="">Select a calendar...</option>
              {calendars.map((cal) => (
                <option key={cal.id} value={cal.id}>
                  {cal.name}
                </option>
              ))}
            </select>
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Subject *
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Event title"
              required
            />
          </div>

          {/* All Day Toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="allDay"
              checked={isAllDay}
              onChange={(e) => setIsAllDay(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <label htmlFor="allDay" className="text-sm font-medium text-gray-700">
              All day
            </label>
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Start {isAllDay ? 'Date' : 'Date & Time'} *
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              {!isAllDay && (
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                End {isAllDay ? 'Date' : 'Date & Time'} *
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              {!isAllDay && (
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              )}
            </div>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Event location"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
              placeholder="Event description"
            />
          </div>

          {/* Recurring Event */}
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="recurring"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <label htmlFor="recurring" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Repeat2 className="w-4 h-4" />
                Recurring event
              </label>
            </div>

            {isRecurring && (
              <div className="pl-6 space-y-4 bg-gray-50 p-4 rounded-md">
                {/* Recurrence Type */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Repeat
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={recurrenceType}
                      onChange={(e) => setRecurrenceType(e.target.value as 'daily' | 'weekly' | 'monthly' | 'yearly')}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                    <input
                      type="number"
                      min="1"
                      value={recurrenceInterval}
                      onChange={(e) => setRecurrenceInterval(parseInt(e.target.value) || 1)}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Interval"
                    />
                  </div>
                </div>

                {/* Weekly: Days of Week */}
                {recurrenceType === 'weekly' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Days of week
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {weekDays.map((day) => (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => toggleDayOfWeek(day.value)}
                          className={`px-3 py-1 rounded-md text-sm ${
                            recurrenceDaysOfWeek.includes(day.value)
                              ? 'bg-blue-600 text-white'
                              : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Monthly/Yearly: Day of Month */}
                {(recurrenceType === 'monthly' || recurrenceType === 'yearly') && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Day of month
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={recurrenceDayOfMonth}
                      onChange={(e) => setRecurrenceDayOfMonth(parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                {/* Recurrence End */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    End
                  </label>
                  <select
                    value={recurrenceEndType}
                    onChange={(e) => setRecurrenceEndType(e.target.value as 'never' | 'date' | 'count')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="never">Never</option>
                    <option value="date">On date</option>
                    <option value="count">After occurrences</option>
                  </select>

                  {recurrenceEndType === 'date' && (
                    <input
                      type="date"
                      value={recurrenceEndDate}
                      onChange={(e) => setRecurrenceEndDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}

                  {recurrenceEndType === 'count' && (
                    <input
                      type="number"
                      min="1"
                      value={recurrenceCount}
                      onChange={(e) => setRecurrenceCount(parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div>
              {isEditMode && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={saving}
                >
                  Delete
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving || loading}
              >
                {saving ? 'Saving...' : isEditMode ? 'Save Changes' : 'Create Event'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

