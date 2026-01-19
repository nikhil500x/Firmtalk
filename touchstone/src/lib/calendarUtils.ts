import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addDays, addWeeks, addMonths, startOfDay, endOfDay, parseISO, getHours, getMinutes, differenceInMinutes } from 'date-fns';

export interface CalendarEvent {
  id: string;
  subject: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  location?: {
    displayName: string;
  };
  organizer?: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
  attendees?: Array<{
    emailAddress: {
      name: string;
      address: string;
    };
    type: string;
  }>;
  bodyPreview?: string;
  calendarName?: string; // Name of the calendar this event belongs to
  calendarId?: string; // ID of the calendar this event belongs to
  recurrence?: {
    pattern?: {
      type?: string;
      interval?: number;
      daysOfWeek?: string[];
      dayOfMonth?: number;
    };
    range?: {
      type?: string;
      endDate?: string;
      numberOfOccurrences?: number;
    };
  };
  isAllDay?: boolean;
}

/**
 * Filter events by date range
 */
export function getEventsForDateRange(events: CalendarEvent[], startDate: Date, endDate: Date): CalendarEvent[] {
  return events.filter(event => {
    const eventStart = parseISO(event.start.dateTime);
    const eventEnd = parseISO(event.end.dateTime);
    
    // Event overlaps with date range if:
    // - Event starts before range ends AND event ends after range starts
    return eventStart <= endDate && eventEnd >= startDate;
  });
}

/**
 * Get events for a specific day
 */
export function getEventsForDay(events: CalendarEvent[], date: Date): CalendarEvent[] {
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);
  return getEventsForDateRange(events, dayStart, dayEnd);
}

/**
 * Check if an event is all-day (spans midnight or is marked as all-day)
 */
export function isAllDayEvent(event: CalendarEvent): boolean {
  const start = parseISO(event.start.dateTime);
  const end = parseISO(event.end.dateTime);
  const duration = differenceInMinutes(end, start);
  // All-day events typically span 24 hours or are marked with date instead of dateTime
  return duration >= 1440 || !event.start.dateTime.includes('T');
}

/**
 * Calculate event position and height for week/day views
 */
export function calculateEventPosition(
  event: CalendarEvent,
  timeSlotHeight: number = 60 // Height of each hour slot in pixels
): { top: number; height: number; left?: number; width?: number } {
  const start = parseISO(event.start.dateTime);
  const end = parseISO(event.end.dateTime);
  
  const startMinutes = getHours(start) * 60 + getMinutes(start);
  const durationMinutes = differenceInMinutes(end, start);
  
  // Minimum height for visibility (15 minutes)
  const minHeight = (15 / 60) * timeSlotHeight;
  
  return {
    top: (startMinutes / 60) * timeSlotHeight,
    height: Math.max((durationMinutes / 60) * timeSlotHeight, minHeight),
  };
}

/**
 * Group overlapping events for side-by-side layout
 */
export function groupOverlappingEvents(events: CalendarEvent[]): CalendarEvent[][] {
  if (events.length === 0) return [];
  
  // Sort events by start time
  const sorted = [...events].sort((a, b) => {
    const startA = parseISO(a.start.dateTime);
    const startB = parseISO(b.start.dateTime);
    return startA.getTime() - startB.getTime();
  });
  
  const groups: CalendarEvent[][] = [];
  const processed = new Set<string>();
  
  for (const event of sorted) {
    if (processed.has(event.id)) continue;
    
    const group: CalendarEvent[] = [event];
    processed.add(event.id);
    
    const eventStart = parseISO(event.start.dateTime);
    const eventEnd = parseISO(event.end.dateTime);
    
    // Find all events that overlap with this event
    for (const otherEvent of sorted) {
      if (processed.has(otherEvent.id)) continue;
      
      const otherStart = parseISO(otherEvent.start.dateTime);
      const otherEnd = parseISO(otherEvent.end.dateTime);
      
      // Check for overlap
      if (otherStart < eventEnd && otherEnd > eventStart) {
        group.push(otherEvent);
        processed.add(otherEvent.id);
      }
    }
    
    groups.push(group);
  }
  
  return groups;
}

/**
 * Format event time for display (e.g., "8 AM", "11:30 AM")
 */
export function formatEventTime(event: CalendarEvent): string {
  const start = parseISO(event.start.dateTime);
  const hours = getHours(start);
  const minutes = getMinutes(start);
  
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  
  if (minutes === 0) {
    return `${displayHours} ${period}`;
  }
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Format event time range for display (e.g., "8 AM - 9:30 AM")
 */
export function formatEventTimeRange(event: CalendarEvent): string {
  const start = parseISO(event.start.dateTime);
  const end = parseISO(event.end.dateTime);
  
  const startHours = getHours(start);
  const startMinutes = getMinutes(start);
  const endHours = getHours(end);
  const endMinutes = getMinutes(end);
  
  const startPeriod = startHours >= 12 ? 'PM' : 'AM';
  const endPeriod = endHours >= 12 ? 'PM' : 'AM';
  const startDisplayHours = startHours > 12 ? startHours - 12 : startHours === 0 ? 12 : startHours;
  const endDisplayHours = endHours > 12 ? endHours - 12 : endHours === 0 ? 12 : endHours;
  
  const startStr = startMinutes === 0 
    ? `${startDisplayHours} ${startPeriod}`
    : `${startDisplayHours}:${startMinutes.toString().padStart(2, '0')} ${startPeriod}`;
  
  const endStr = endMinutes === 0
    ? `${endDisplayHours} ${endPeriod}`
    : `${endDisplayHours}:${endMinutes.toString().padStart(2, '0')} ${endPeriod}`;
  
  return `${startStr} - ${endStr}`;
}

/**
 * Determine if a calendar is organizational (work/company) or personal
 */
export function isOrganizationalCalendar(event: CalendarEvent): boolean {
  const calendarName = event.calendarName?.toLowerCase().trim() || '';
  const organizerEmail = event.organizer?.emailAddress?.address?.toLowerCase().trim() || '';
  
  // Check for personal calendar keywords first (highest priority)
  const personalKeywords = ['personal', 'birthday', 'birthdays', 'holiday', 'holidays', 'family', 'home', 'my calendar'];
  if (personalKeywords.some(keyword => calendarName.includes(keyword))) {
    return false; // Personal
  }
  
  // Check organizer email domain - personal domains indicate personal calendar
  const personalDomains = ['outlook.com', 'hotmail.com', 'gmail.com', 'yahoo.com', 'icloud.com', 'me.com', 'live.com'];
  const organizerDomain = organizerEmail.includes('@') ? organizerEmail.split('@')[1] : '';
  const isPersonalDomain = organizerDomain && personalDomains.some(domain => organizerDomain.includes(domain));
  
  // If organizer has personal domain, treat as personal unless calendar name suggests work
  if (isPersonalDomain) {
    const orgKeywords = ['work', 'company', 'business', 'office', 'team', 'corporate', 'organization', 'touchstone'];
    const hasOrgKeywords = orgKeywords.some(keyword => calendarName.includes(keyword));
    
    // If personal domain but no organizational keywords, it's personal
    if (!hasOrgKeywords) {
      return false; // Personal
    }
  }
  
  // Check if calendar name suggests organizational use
  const orgKeywords = ['work', 'company', 'business', 'office', 'team', 'corporate', 'organization', 'touchstone'];
  if (orgKeywords.some(keyword => calendarName.includes(keyword))) {
    return true; // Organizational
  }
  
  // If organizer email has company domain (not personal), it's organizational
  if (organizerDomain && !isPersonalDomain && organizerDomain.includes('.')) {
    // Has a domain that's not in personal list - likely company email
    return true; // Organizational
  }
  
  // Default calendar name "Calendar" - check organizer email to decide
  if (calendarName === 'calendar' || calendarName === '') {
    // For default calendar, check organizer email domain
    // If organizer has personal domain (and not company domain), it might be personal
    if (isPersonalDomain) {
      // But in work context, even personal domain events in "Calendar" might be work
      // Only treat as personal if there's clear indication
      // For now, default to organizational since we're in work context
      return true;
    }
    // If organizer has company domain or no organizer, it's organizational
    return true;
  }
  
  // Default to organizational if uncertain (work context)
  return true;
}

/**
 * Generate a color hash from a string (consistent color for same input)
 */
function getColorHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

/**
 * Get color classes for event based on calendar type
 */
export function getEventColorClasses(event: CalendarEvent): {
  bg: string;
  text: string;
} {
  const isOrg = isOrganizationalCalendar(event);
  
  // Color palette for different calendar types
  // Organizational calendars get blue variants, personal get green/yellow variants
  const orgColors = [
    { bg: 'bg-blue-100', text: 'text-blue-900' },      // Primary org blue
    { bg: 'bg-indigo-100', text: 'text-indigo-900' },  // Secondary org indigo
    { bg: 'bg-purple-100', text: 'text-purple-900' },  // Tertiary org purple
  ];
  
  const personalColors = [
    { bg: 'bg-green-100', text: 'text-green-900' },    // Primary personal green
    { bg: 'bg-emerald-100', text: 'text-emerald-900' }, // Secondary personal emerald
    { bg: 'bg-teal-100', text: 'text-teal-900' },      // Tertiary personal teal
  ];
  
  if (isOrg) {
    // Organizational/Work events - use blue variants
    // Use calendar name or ID to pick a consistent color for this calendar
    const calendarKey = event.calendarName || event.calendarId || event.id;
    const hash = getColorHash(calendarKey);
    const colorIndex = hash % orgColors.length;
    return orgColors[colorIndex];
  } else {
    // Personal events - use green variants
    // Use calendar name or ID to pick a consistent color for this calendar
    const calendarKey = event.calendarName || event.calendarId || event.id;
    const hash = getColorHash(calendarKey);
    const colorIndex = hash % personalColors.length;
    return personalColors[colorIndex];
  }
}

/**
 * Generate consistent color for event based on ID (legacy function, kept for compatibility)
 */
export function getEventColor(eventId: string): string {
  // Use a simple hash to get consistent color for same event
  let hash = 0;
  for (let i = 0; i < eventId.length; i++) {
    hash = eventId.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Generate hue from hash (0-360)
  const hue = Math.abs(hash) % 360;
  
  // Default to light blue for consistency with Outlook style
  // But allow for different hues if needed
  return `hsl(${hue}, 70%, 85%)`;
}

/**
 * Get week start and end dates
 */
export function getWeekDates(date: Date, weekStartsOn: 0 | 1 = 0): { start: Date; end: Date; days: Date[] } {
  const start = startOfWeek(date, { weekStartsOn });
  const end = endOfWeek(date, { weekStartsOn });
  const days = eachDayOfInterval({ start, end });
  return { start, end, days };
}

/**
 * Get work week dates (Monday-Friday)
 */
export function getWorkWeekDates(date: Date): { start: Date; end: Date; days: Date[] } {
  const start = startOfWeek(date, { weekStartsOn: 1 }); // Monday
  const end = addDays(start, 4); // Friday
  const days = eachDayOfInterval({ start, end });
  return { start, end, days };
}

/**
 * Get month dates including previous/next month dates for grid
 */
export function getMonthDates(date: Date): { 
  start: Date; 
  end: Date; 
  days: Date[]; 
  monthStart: Date; 
  monthEnd: Date;
  firstDayOfMonth: Date;
} {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  
  // Get the first day of the week that contains month start (Sunday = 0)
  const firstDayOfMonth = startOfWeek(monthStart, { weekStartsOn: 0 });
  
  // Get the last day of the week that contains month end
  const lastDayOfMonth = endOfWeek(monthEnd, { weekStartsOn: 0 });
  
  const days = eachDayOfInterval({ start: firstDayOfMonth, end: lastDayOfMonth });
  
  return {
    start: firstDayOfMonth,
    end: lastDayOfMonth,
    days,
    monthStart,
    monthEnd,
    firstDayOfMonth,
  };
}

/**
 * Check if a date is today
 */
export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

/**
 * Check if a date is in the current month
 */
export function isCurrentMonth(date: Date, currentDate: Date): boolean {
  return isSameMonth(date, currentDate);
}

/**
 * Format date for display in calendar grid
 */
export function formatCalendarDate(date: Date): string {
  return format(date, 'd');
}

/**
 * Format month and year for display
 */
export function formatMonthYear(date: Date): string {
  return format(date, 'MMMM yyyy');
}

/**
 * Navigate to previous period based on view type
 */
export function navigatePreviousDate(currentDate: Date, view: 'day' | 'work-week' | 'week' | 'month'): Date {
  switch (view) {
    case 'day':
      return addDays(currentDate, -1);
    case 'work-week':
    case 'week':
      return addWeeks(currentDate, -1);
    case 'month':
      return addMonths(currentDate, -1);
  }
}

/**
 * Navigate to next period based on view type
 */
export function navigateNextDate(currentDate: Date, view: 'day' | 'work-week' | 'week' | 'month'): Date {
  switch (view) {
    case 'day':
      return addDays(currentDate, 1);
    case 'work-week':
    case 'week':
      return addWeeks(currentDate, 1);
    case 'month':
      return addMonths(currentDate, 1);
  }
}

/**
 * Check if event is recurring
 */
export function isRecurringEvent(event: CalendarEvent): boolean {
  return !!event.recurrence && !!event.recurrence.pattern;
}

/**
 * Get recurring pattern description
 */
export function getRecurrenceDescription(event: CalendarEvent): string {
  if (!isRecurringEvent(event)) {
    return '';
  }

  const pattern = event.recurrence!.pattern!;
  const range = event.recurrence!.range;
  
  let description = '';
  
  switch (pattern.type) {
    case 'daily':
      description = pattern.interval && pattern.interval > 1 
        ? `Every ${pattern.interval} days` 
        : 'Daily';
      break;
    case 'weekly':
      if (pattern.daysOfWeek && pattern.daysOfWeek.length > 0) {
        const days = pattern.daysOfWeek.map(d => d.charAt(0).toUpperCase() + d.slice(1).substring(0, 3)).join(', ');
        description = pattern.interval && pattern.interval > 1
          ? `Every ${pattern.interval} weeks on ${days}`
          : `Weekly on ${days}`;
      } else {
        description = pattern.interval && pattern.interval > 1
          ? `Every ${pattern.interval} weeks`
          : 'Weekly';
      }
      break;
    case 'absoluteMonthly':
    case 'monthly':
      description = pattern.interval && pattern.interval > 1
        ? `Every ${pattern.interval} months`
        : 'Monthly';
      if (pattern.dayOfMonth) {
        description += ` on day ${pattern.dayOfMonth}`;
      }
      break;
    case 'absoluteYearly':
    case 'yearly':
      description = pattern.interval && pattern.interval > 1
        ? `Every ${pattern.interval} years`
        : 'Yearly';
      break;
    default:
      description = 'Recurring';
  }
  
  if (range) {
    if (range.type === 'endDate' && range.endDate) {
      description += ` until ${format(parseISO(range.endDate), 'MMM d, yyyy')}`;
    } else if (range.type === 'numbered' && range.numberOfOccurrences) {
      description += ` (${range.numberOfOccurrences} occurrences)`;
    }
  }
  
  return description;
}

