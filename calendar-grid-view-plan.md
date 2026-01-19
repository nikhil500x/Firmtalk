# Outlook-Style Calendar Grid View Implementation Plan

## Overview
Transform the current list-based calendar view into a professional Outlook-style calendar with week, month, and day views matching the Microsoft Outlook calendar interface. Events will be displayed as light blue blocks overlaid on the calendar grid with proper time slots, visual hierarchy, and a left sidebar with mini calendar.

## Reference Design
Based on Outlook calendar interface with:
- Top navigation bar with view toggles (Day, Work week, Week, Month)
- Left sidebar with mini calendar navigation
- Main calendar grid with month view as default
- Events as light blue blocks showing time and title
- Current date highlighted with blue circle
- Clean, professional layout

## Current State
- Calendar currently shows events in a simple list format (`EventList.tsx`)
- Basic navigation (previous/next month, today button)
- Events fetched from Azure Graph API with date range filtering
- Uses Tailwind CSS, shadcn/ui components, and date-fns (already installed)
- Main app has sidebar and topbar layout structure

## Implementation Plan

### Phase 1: Create Calendar Grid Components

**New Files:**
1. `touchstone/src/components/calendar/CalendarLayout.tsx` - Main calendar layout with sidebar and grid
2. `touchstone/src/components/calendar/CalendarSidebar.tsx` - Left sidebar with mini calendar and calendar list
3. `touchstone/src/components/calendar/MiniCalendar.tsx` - Compact month calendar in sidebar
4. `touchstone/src/components/calendar/WeekView.tsx` - Week view grid (7 days, hourly time slots)
5. `touchstone/src/components/calendar/MonthView.tsx` - Month view grid (default, traditional calendar layout)
6. `touchstone/src/components/calendar/DayView.tsx` - Day view (single day, hourly slots)
7. `touchstone/src/components/calendar/CalendarEventBlock.tsx` - Individual event block component (light blue blocks)
8. `touchstone/src/components/calendar/CalendarNavigation.tsx` - Top navigation bar with view toggles
9. `touchstone/src/components/calendar/ViewToggle.tsx` - View selector buttons (Day/Work week/Week/Month)
10. `touchstone/src/components/calendar/EventDetailModal.tsx` - Modal for event details on click

**Key Features:**
- Grid-based layout with proper time slots
- Events displayed as colored blocks positioned by start/end time
- Hover effects and click handlers for event details
- Responsive design for different screen sizes
- Smooth transitions between views

### Phase 2: Create Calendar Layout with Sidebar

**File: `touchstone/src/components/calendar/CalendarLayout.tsx`**

**Features:**
- Full-page calendar layout (hides default app sidebar/topbar for calendar page)
- Left sidebar (~250px width) with mini calendar
- Main content area with calendar grid
- Top navigation bar inside calendar layout

**File: `touchstone/src/components/calendar/CalendarSidebar.tsx`**

**Features:**
- Month/year selector with navigation arrows
- Mini calendar component (compact month view)
- Calendar list section (My Calendars)
- Add calendar button
- Links: "Add calendar", "Go to my booking page"
- Shows currently selected calendar (default: "Calendar")

**File: `touchstone/src/components/calendar/MiniCalendar.tsx`**

**Features:**
- Compact month grid (~150px width)
- Day abbreviations (M, T, W, T, F, S, S)
- Dates from previous/next month in muted gray
- Current date highlighted with blue circle (matching main calendar)
- Click on date to navigate to that date
- Month/year navigation arrows

**File: `touchstone/src/components/calendar/CalendarNavigation.tsx`**

**Features:**
- Top navigation bar matching Outlook style
- Left: View toggle buttons (Day, Work week, Week, Month)
- Center: Month/year display with navigation arrows and "Today" button
- Right: Action buttons (Filter, Share, Print - optional for now)
- Clean, professional styling

### Phase 3: Update CalendarView Component

**File: `touchstone/src/components/calendar/CalendarView.tsx`**

**Changes:**
1. Wrap content in `CalendarLayout` component
2. Add view state management (day/work-week/week/month)
3. Use `CalendarNavigation` for top bar
4. Replace `EventList` with conditional rendering of grid views
5. Update date range logic to work with different views:
   - Month view: Show full month (default)
   - Week view: Show 7 days from selected week
   - Work week: Show Monday-Friday
   - Day view: Show single day
6. Add current date/week/month indicator
7. Update navigation buttons to work with selected view

**View State Management:**
```typescript
type CalendarView = 'day' | 'work-week' | 'week' | 'month';
const [currentView, setCurrentView] = useState<CalendarView>('month'); // Default to month
const [currentDate, setCurrentDate] = useState(new Date());
```

### Phase 4: Week View Implementation

**File: `touchstone/src/components/calendar/WeekView.tsx`**

**Features:**
- 7-column grid (Sunday-Saturday or Monday-Sunday based on locale)
- Hourly time slots (e.g., 6 AM - 11 PM) with 30-minute increments
- Events positioned by start time and duration
- Current time indicator line
- Day headers with date numbers
- All-day events bar at top
- Scrollable time slots area
- Click on time slot to create event (future feature placeholder)

**Layout:**
- Left column: Time labels (6:00 AM, 6:30 AM, etc.)
- Top row: Day headers (Sun, Mon, Tue, etc. with dates)
- Grid cells: Time slots for each day
- Event blocks: Positioned absolutely within grid cells

### Phase 5: Month View Implementation (Primary View)

**File: `touchstone/src/components/calendar/MonthView.tsx`**

**Features:**
- Traditional calendar month grid (6 rows × 7 columns) matching Outlook
- Days from previous/next month shown in muted gray (like image)
- Current day highlighted with blue circle/border
- Event blocks styled as light blue blocks (bg-blue-100 or similar)
- Events show time (e.g., "8 AM", "11:30 AM") and truncated title
- Events positioned in date cells with proper spacing
- Long event titles truncated with ellipsis (e.g., "Sandeep Das Birthday")
- Click on event to open detail modal
- Click on date to switch to day view (optional)
- Hover effect on events (slight shadow/elevation)

**Layout:**
- Grid of date cells with day headers (Sunday, Monday, Tuesday, etc.)
- Each cell shows date number at top
- Events displayed as blocks below date number
- Cell height adjusts to show multiple events (up to ~3-4 visible)
- Overflow handling: Show "+N more" if many events (future enhancement)

**Styling (Matching Image):**
- Light blue event blocks: `bg-blue-100 text-blue-900` or similar
- Event text: Time in bold, title truncated
- Cell borders: Light gray
- Current date: Blue circle with white text or blue border
- Font sizes: Small text for events in month view

### Phase 6: Day View Implementation

**File: `touchstone/src/components/calendar/DayView.tsx`**

**Features:**
- Single day with hourly time slots (full 24 hours or 6 AM - 11 PM)
- Events displayed as blocks with full width
- Current time indicator
- Event details visible in blocks (title, time, location icon)
- Scrollable time slots

### Phase 7: Event Block Component

**File: `touchstone/src/components/calendar/CalendarEventBlock.tsx`**

**Features:**
- Light blue blocks matching Outlook style (default color)
- Positioned by start time and duration (week/day views) or in date cells (month view)
- Shows time (e.g., "8 AM", "11:30 AM") and event title
- Truncates long titles with ellipsis (especially in month view)
- Hover effect (slight elevation/shadow)
- Click to open event detail modal
- Handles overlapping events (side-by-side layout in week/day views)

**Styling (Matching Image):**
- Month view: Light blue blocks `bg-blue-100` or `bg-blue-50`, text `text-blue-900`
- Week/Day views: Full-width blocks with more detail
- Padding: Small padding for month view, larger for week/day
- Font sizes: 12-14px for month view, larger for other views
- Border radius: `rounded` or `rounded-sm`
- Time displayed first in bold, then title

### Phase 8: Event Detail Modal

**File: `touchstone/src/components/calendar/EventDetailModal.tsx`**

**Features:**
- Full event details (title, date/time, location, organizer, attendees, description)
- Use existing Dialog component from shadcn/ui
- Close button and backdrop click to close
- Format dates/times using date-fns
- Show all event metadata from Azure Graph API response

### Phase 9: View Toggle and Navigation

**File: `touchstone/src/components/calendar/ViewToggle.tsx`**

**Features:**
- Button group matching Outlook: "Day", "Work week", "Week", "Month"
- Active view highlighted in blue (matching Outlook style)
- Buttons styled as outlined buttons with active state
- Positioned in top navigation bar

**Styling:**
- Default: White background, gray border, gray text
- Active: Blue background or blue border, blue text
- Hover: Light gray background
- Spacing between buttons

### Phase 10: Date Navigation Updates

**Update `CalendarNavigation.tsx` and `CalendarView.tsx`:**
- Previous/Next arrows work with current view:
  - Week: Navigate by week
  - Month: Navigate by month
  - Day: Navigate by day
  - Work week: Navigate by work week (5 days)
- Today button resets to current date/week/month
- Month/year display updates based on current view
- Mini calendar in sidebar updates when navigating
- Clicking date in mini calendar navigates main calendar to that date

### Phase 11: Event Positioning Logic

**Utility Functions (new file: `touchstone/src/lib/calendarUtils.ts`):**

**Functions:**
1. `getEventsForDateRange(events, startDate, endDate)` - Filter events by date range
2. `getEventsForDay(events, date)` - Get events for specific day
3. `calculateEventPosition(event, viewType, timeSlotHeight)` - Calculate top position and height for event block
4. `groupOverlappingEvents(events)` - Group events that overlap in time
5. `formatEventTime(event)` - Format start/end time for display
6. `getEventColor(eventId)` - Generate consistent color for event

**Event Positioning:**
- Week/Day views: Calculate position based on start time (hours * slot height + minutes)
- Calculate height based on duration
- Handle events spanning multiple days in week view
- Handle all-day events separately

### Phase 12: Styling and Polish

**Styling Updates:**
- Consistent color scheme using Tailwind CSS variables
- Smooth transitions between views
- Loading states for grid views
- Empty state when no events
- Responsive breakpoints:
  - Desktop: Full grid views
  - Tablet: Adjusted column widths
  - Mobile: Stack day view or simplified month view

**Accessibility:**
- Keyboard navigation (arrow keys to navigate dates)
- ARIA labels for calendar grid
- Focus states for interactive elements
- Screen reader support

### Phase 13: Integration and Testing

**Integration:**
- Ensure date range updates trigger API calls correctly
- Test with various event scenarios:
  - Single events
  - Overlapping events
  - All-day events
  - Multi-day events
  - Events spanning week boundaries
- Test view switching and date navigation
- Test custom date range selection

**Performance:**
- Memoize event calculations
- Virtual scrolling for month view if needed
- Lazy load events outside visible range

## File Structure

```
touchstone/src/components/calendar/
├── CalendarView.tsx (updated)
├── CalendarViewWrapper.tsx (no changes)
├── CalendarLayout.tsx (new - full page layout with sidebar)
├── CalendarSidebar.tsx (new - left sidebar with mini calendar)
├── MiniCalendar.tsx (new - compact month calendar)
├── CalendarNavigation.tsx (new - top navigation bar)
├── EventList.tsx (keep for fallback or remove)
├── WeekView.tsx (new)
├── MonthView.tsx (new - primary/default view)
├── DayView.tsx (new)
├── CalendarEventBlock.tsx (new - light blue blocks)
├── ViewToggle.tsx (new)
└── EventDetailModal.tsx (new)

touchstone/src/lib/
└── calendarUtils.ts (new)
```

## Dependencies

**Already Installed:**
- `date-fns` - Date manipulation
- `react-day-picker` - Date range picker
- `lucide-react` - Icons
- Tailwind CSS - Styling

**No Additional Dependencies Needed** - All functionality can be built with existing libraries and React.

## Implementation Order

1. Create utility functions (`calendarUtils.ts`)
2. Create `CalendarLayout` component (full page wrapper)
3. Create `CalendarSidebar` and `MiniCalendar` components
4. Create `CalendarNavigation` and `ViewToggle` components
5. Create `CalendarEventBlock` component (light blue styling)
6. Create `MonthView` component (primary/default view)
7. Create `WeekView` component
8. Create `DayView` component
9. Create `EventDetailModal` component
10. Update `CalendarView` to integrate layout, sidebar, and all views
11. Update calendar page to use full-page layout (hide default sidebar)
12. Test and polish styling to match Outlook design
13. Remove or deprecate old `EventList` if no longer needed

## Success Criteria

- Calendar layout matches Outlook design with left sidebar and top navigation
- Month view is the default view and displays events as light blue blocks
- Users can toggle between Day, Work week, Week, and Month views
- Events are displayed as light blue blocks with time and title (matching image)
- Events are positioned correctly by time in week/day views
- Events are shown on correct dates in month view
- Mini calendar in sidebar shows current date with blue highlight
- Clicking an event shows full details in a modal
- Navigation (previous/next/today) works correctly for each view
- Clicking a date in mini calendar navigates main calendar
- Current date highlighted with blue circle in both mini and main calendar
- Calendar is responsive and works on different screen sizes
- Performance is smooth with typical event counts (50-200 events)

