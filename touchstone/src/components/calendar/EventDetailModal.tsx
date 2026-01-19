'use client';

import { CalendarEvent, formatEventTimeRange, isOrganizationalCalendar, isRecurringEvent, getRecurrenceDescription } from '@/lib/calendarUtils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Clock, MapPin, Users, ExternalLink, ChevronDown, User, Repeat2, Calendar as CalendarIcon, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useState } from 'react';
import EventDialog from './EventDialog';
import { API_ENDPOINTS, apiRequest } from '@/lib/api';

interface EventDetailModalProps {
  event: CalendarEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEventChange?: () => void;
}

export default function EventDetailModal({
  event,
  open,
  onOpenChange,
  onEventChange,
}: EventDetailModalProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!event) return null;

  const start = parseISO(event.start.dateTime);
  const end = parseISO(event.end.dateTime);
  
  // Format date as "Mon 11/24/2025" (EEE M/d/yyyy)
  const dateStr = format(start, 'EEE M/d/yyyy');
  
  // Format time as "8:00 AM"
  const timeStr = format(start, 'h:mm a');
  
  // Check if event is recurring
  const isRecurring = isRecurringEvent(event);
  const recurrenceDescription = isRecurring ? getRecurrenceDescription(event) : '';
  
  // Check if current user is organizer (simplified - would need to compare with session user)
  const isOrganizer = true;
  
  // Determine if this is an organizational or personal calendar event
  const isOrg = isOrganizationalCalendar(event);
  const calendarTypeColor = isOrg ? 'bg-blue-100 text-blue-900' : 'bg-green-100 text-green-900';
  const calendarTypeLabel = isOrg ? 'Work' : 'Personal';

  const handleEdit = () => {
    setEditDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!event || !confirm('Are you sure you want to delete this event?')) {
      return;
    }
    
    setDeleting(true);
    
    try {
      const response = await apiRequest(
        `${API_ENDPOINTS.azure.calendar.deleteEvent(event.id)}?calendarId=${encodeURIComponent(event.calendarId || 'default')}&deleteSeries=false`,
        {
          method: 'DELETE',
        }
      );
      
      if (response.success) {
        onEventChange?.();
        onOpenChange(false);
      } else {
        alert(response.message || 'Failed to delete event');
      }
    } catch (err) {
      console.error('Error deleting event:', err);
      alert('Failed to delete event');
    } finally {
      setDeleting(false);
    }
  };

  const handleEventSaved = () => {
    onEventChange?.();
    setEditDialogOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <DialogTitle className="text-2xl font-semibold text-gray-900 pr-8">
                {event.subject || 'Untitled Event'}
              </DialogTitle>
              {/* Calendar Type Badge */}
              {event.calendarName && (
                <div className="flex items-center gap-2 mt-2">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${calendarTypeColor}`}>
                    <CalendarIcon className="w-3 h-3" />
                    {event.calendarName}
                  </span>
                  <span className="text-xs text-gray-500">
                    ({calendarTypeLabel} calendar)
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <button
                className="p-2 hover:bg-gray-100 rounded transition-colors"
                onClick={(e) => {
                  e.preventDefault();
                  // TODO: Open in new window
                  window.open(`https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(event.subject || '')}`, '_blank');
                }}
              >
                <ExternalLink className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-6">
          {/* Date and Time */}
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="text-sm text-gray-900">
                <span className="font-medium">{dateStr}</span>
                <span className="ml-2">{timeStr}</span>
                {formatEventTimeRange(event).includes(' - ') && (
                  <span className="text-gray-600">
                    {' - '}{format(end, 'h:mm a')}
                  </span>
                )}
              </div>
              {isRecurring && (
                <div className="flex items-center gap-2 mt-2">
                  <Repeat2 className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-600">{recurrenceDescription || 'Recurring event'}</span>
                </div>
              )}
            </div>
          </div>

          {/* Location */}
          {event.location?.displayName && (
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="text-sm text-gray-900">{event.location.displayName}</div>
              </div>
            </div>
          )}

          {/* Organizer */}
          {event.organizer && (
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 mt-0.5 shrink-0 flex items-center justify-center">
                <User className="w-5 h-5 text-gray-400" />
              </div>
              <div className="flex-1">
                {isOrganizer ? (
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-semibold">
                      {event.organizer.emailAddress.name?.[0]?.toUpperCase() || 
                       event.organizer.emailAddress.address?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">You&apos;re the organizer</div>
                      <div className="text-xs text-gray-500">{event.organizer.emailAddress.address}</div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {event.organizer.emailAddress.name || event.organizer.emailAddress.address}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {event.organizer.emailAddress.address}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Attendees */}
          {event.attendees && event.attendees.length > 0 && (
            <div className="flex items-start gap-3">
              <Users className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900 mb-2">
                  Attendees ({event.attendees.length})
                </div>
                <div className="space-y-2">
                  {event.attendees.map((attendee, index) => {
                    const attendeeName = attendee.emailAddress.name || attendee.emailAddress.address;
                    const attendeeEmail = attendee.emailAddress.address;
                    const isRequired = attendee.type === 'required';
                    // Check if status object exists (it may not be in the API response)
                    const responseStatus = (attendee as { status?: { response?: string } }).status?.response || 'none';
                    
                    return (
                      <div key={index} className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gray-300 text-gray-700 flex items-center justify-center text-xs font-semibold shrink-0">
                          {attendeeName[0]?.toUpperCase() || attendeeEmail[0]?.toUpperCase() || 'A'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-gray-900 truncate">
                            {attendeeName}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-xs ${
                              isRequired ? 'text-gray-700 font-medium' : 'text-gray-500'
                            }`}>
                              {isRequired ? 'required' : 'optional'}
                            </span>
                            {responseStatus === 'accepted' && (
                              <span className="text-xs text-green-600">✓ Accepted</span>
                            )}
                            {responseStatus === 'declined' && (
                              <span className="text-xs text-red-600">✗ Declined</span>
                            )}
                            {responseStatus === 'tentativelyAccepted' && (
                              <span className="text-xs text-yellow-600">~ Tentative</span>
                            )}
                            {responseStatus === 'none' && (
                              <span className="text-xs text-gray-400">No response</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Description/Preview */}
          {event.bodyPreview && (
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 mt-0.5 shrink-0"></div>
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900 mb-2">Description</div>
                <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {event.bodyPreview}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {isOrganizer && (
            <div className="flex items-center gap-2 pt-4 border-t border-gray-200">
              <Button
                variant="default"
                size="sm"
                onClick={handleEdit}
                className="gap-2"
              >
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
                className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
                {deleting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>

      {/* Edit Dialog */}
      <EventDialog
        event={event}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSave={handleEventSaved}
      />
    </Dialog>
  );
}
