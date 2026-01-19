'use client';

import { CalendarEvent, formatEventTime, getEventColorClasses } from '@/lib/calendarUtils';

interface CalendarEventBlockProps {
  event: CalendarEvent;
  view: 'month' | 'week' | 'day' | 'work-week';
  onClick?: (event: CalendarEvent) => void;
  style?: React.CSSProperties;
  className?: string;
}

export default function CalendarEventBlock({
  event,
  view,
  onClick,
  style,
  className = '',
}: CalendarEventBlockProps) {
  const timeStr = formatEventTime(event);
  const title = event.subject || 'Untitled Event';
  
  // Get color classes based on calendar type (organizational vs personal)
  const colorClasses = getEventColorClasses(event);
  
  // Truncate title for month view - adjust based on available space
  // In month view, show time + truncated title (e.g., "8 AM Virender Singh Ch")
  let displayTitle = title;
  if (view === 'month') {
    // Account for time string length (e.g., "8 AM " or "11:30 AM ")
    const timeWithSpace = timeStr.length + 1;
    const maxTitleLength = 30 - timeWithSpace; // Adjust based on typical cell width
    if (title.length > maxTitleLength) {
      displayTitle = `${title.substring(0, maxTitleLength - 3)}...`;
    }
  }

  const handleClick = () => {
    onClick?.(event);
  };

  // Base styling classes
  const baseClasses = 'rounded cursor-pointer transition-all hover:shadow-md';
  
  // View-specific sizing classes
  const viewSizeClasses = {
    month: 'text-xs px-2 py-0.5 mb-1 font-medium',
    week: 'text-sm px-2 py-1.5 mb-1',
    day: 'text-sm px-3 py-2 mb-1',
    'work-week': 'text-sm px-2 py-1.5 mb-1',
  };

  // Combine color and size classes
  const combinedClasses = `${baseClasses} ${colorClasses.bg} ${colorClasses.text} ${viewSizeClasses[view]} ${className}`;

  return (
    <div
      className={combinedClasses}
      style={style}
      onClick={handleClick}
      title={`${timeStr} - ${event.subject || 'Untitled Event'}${event.calendarName ? ` (${event.calendarName})` : ''}`}
    >
      {view === 'month' ? (
        <div className="truncate">
          <span className="font-semibold">{timeStr}</span>
          {' '}
          <span>{displayTitle}</span>
        </div>
      ) : (
        <div className="flex items-start gap-1.5">
          <span className="font-semibold text-xs shrink-0">{timeStr}</span>
          <span className="truncate">{displayTitle}</span>
        </div>
      )}
    </div>
  );
}

