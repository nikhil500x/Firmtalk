'use client';

import { Calendar, Clock, MapPin, Users } from 'lucide-react';

interface CalendarEvent {
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
}

interface EventListProps {
  events: CalendarEvent[];
  loading?: boolean;
}

export default function EventList({ events, loading }: EventListProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading events...</p>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-12">
        <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">No calendar events found</p>
        <p className="text-sm text-gray-500 mt-2">Your Outlook calendar events will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {events.map((event) => (
        <div
          key={event.id}
          className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {event.subject || 'Untitled Event'}
              </h3>

              <div className="space-y-2 text-sm text-gray-600">
                {/* Date and Time */}
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span>
                    {formatDate(event.start.dateTime)} • {formatTime(event.start.dateTime)} - {formatTime(event.end.dateTime)}
                  </span>
                </div>

                {/* Location */}
                {event.location?.displayName && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span>{event.location.displayName}</span>
                  </div>
                )}

                {/* Organizer */}
                {event.organizer && (
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span>
                      Organizer: {event.organizer.emailAddress.name || event.organizer.emailAddress.address}
                    </span>
                  </div>
                )}

                {/* Attendees Count */}
                {event.attendees && event.attendees.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span>{event.attendees.length} attendee{event.attendees.length !== 1 ? 's' : ''}</span>
                  </div>
                )}

                {/* Preview */}
                {event.bodyPreview && (
                  <p className="text-gray-500 mt-2 line-clamp-2">{event.bodyPreview}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

