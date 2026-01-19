'use client';

import React, { useState, useEffect } from 'react';
import { X, Calendar, Mail, Phone, FileText, Briefcase, MessageSquare, Clock, Plus } from 'lucide-react';
import { API_ENDPOINTS, apiRequest } from '@/lib/api';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';

interface InteractionData {
  subject?: string;
  title?: string;
  date?: string;
  participants?: Array<{ name?: string; email?: string }> | string;
  notes?: string;
  [key: string]: unknown;
}

interface Interaction {
  id: number;
  type: string;
  data?: InteractionData;
  summary?: {
    subject: string;
    date: string;
    participantsCount: number;
  };
  relatedEntityType?: string;
  relatedEntityId?: number;
  createdBy?: {
    id: number;
    name: string;
    email: string;
  };
  createdAt: string;
}

interface InteractionTimelineProps {
  contactId: number;
  contactName: string;
  onClose: () => void;
}

const interactionIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  calendar_event: Calendar,
  meeting: Calendar,
  note: FileText,
  email: Mail,
  call: Phone,
  task: Briefcase,
  matter: Briefcase,
};

export default function InteractionTimeline({ contactId, contactName, onClose }: InteractionTimelineProps) {
  const { role } = useAuth();
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showQuickEntry, setShowQuickEntry] = useState(false);
  const [quickEntryType, setQuickEntryType] = useState('note');
  const [quickEntrySubject, setQuickEntrySubject] = useState('');
  const [quickEntryNotes, setQuickEntryNotes] = useState('');
  const [savingQuickEntry, setSavingQuickEntry] = useState(false);

  const isPartner = role?.name === 'partner' || role?.name === 'superadmin' || role?.name === 'admin';

  useEffect(() => {
    fetchInteractions();
  }, [contactId]);

  const fetchInteractions = async () => {
    try {
      setLoading(true);
      setError(null);
      interface TimelineDay {
        date: string;
        interactions: Interaction[];
      }
      const response = await apiRequest<TimelineDay[]>(API_ENDPOINTS.interactions.timeline(contactId));
      if (response.success && response.data) {
        // Flatten timeline structure
        const allInteractions: Interaction[] = [];
        response.data.forEach((day: TimelineDay) => {
          allInteractions.push(...day.interactions);
        });
        setInteractions(allInteractions);
      } else {
        setError('Failed to load interactions');
      }
    } catch (err) {
      console.error('Error fetching interactions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load interactions');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch {
      return dateString;
    }
  };

  const formatDateTime = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy h:mm a');
    } catch {
      return dateString;
    }
  };

  const getInteractionIcon = (type: string) => {
    const Icon = interactionIcons[type] || MessageSquare;
    return Icon;
  };

  const handleQuickEntrySave = async () => {
    if (!quickEntrySubject.trim() && !quickEntryNotes.trim()) {
      return;
    }

    setSavingQuickEntry(true);
    try {
      const response = await apiRequest(API_ENDPOINTS.interactions.create, {
        method: 'POST',
        body: JSON.stringify({
          contactId,
          interactionType: quickEntryType,
          interactionData: {
            subject: quickEntrySubject.trim() || 'Interaction',
            notes: quickEntryNotes.trim(),
            date: new Date().toISOString(),
          },
        }),
      });

      if (response.success) {
        setQuickEntrySubject('');
        setQuickEntryNotes('');
        setShowQuickEntry(false);
        // Refresh interactions
        fetchInteractions();
      }
    } catch (err) {
      console.error('Error saving quick entry:', err);
    } finally {
      setSavingQuickEntry(false);
    }
  };

  const handleQuickEntryCancel = () => {
    setQuickEntrySubject('');
    setQuickEntryNotes('');
    setShowQuickEntry(false);
  };

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-xl z-50 flex flex-col border-l">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Interactions</h3>
          <p className="text-sm text-gray-600">{contactName}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 relative">
        {/* Quick Entry Form */}
        {showQuickEntry && (
          <div className="mb-4 p-4 border rounded-lg bg-gray-50">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Quick Add Interaction</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={handleQuickEntryCancel}
                  disabled={savingQuickEntry}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
              
              <Select value={quickEntryType} onValueChange={setQuickEntryType} disabled={savingQuickEntry}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="note">Note</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>

              <Input
                placeholder="Subject"
                value={quickEntrySubject}
                onChange={(e) => setQuickEntrySubject(e.target.value)}
                disabled={savingQuickEntry}
                className="text-sm"
              />

              <Textarea
                placeholder="Notes (optional)"
                value={quickEntryNotes}
                onChange={(e) => setQuickEntryNotes(e.target.value)}
                disabled={savingQuickEntry}
                className="min-h-[60px] text-sm resize-none"
              />

              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleQuickEntrySave}
                  disabled={savingQuickEntry || (!quickEntrySubject.trim() && !quickEntryNotes.trim())}
                  className="flex-1"
                >
                  {savingQuickEntry ? 'Saving...' : 'Save'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleQuickEntryCancel}
                  disabled={savingQuickEntry}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={fetchInteractions} size="sm">
              Retry
            </Button>
          </div>
        ) : interactions.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-600">No interactions recorded</p>
          </div>
        ) : (
          <div className="space-y-4">
            {interactions.map((interaction) => {
              const Icon = getInteractionIcon(interaction.type);
              return (
                <div
                  key={interaction.id}
                  className="border rounded-lg p-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Icon className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900 capitalize">
                          {interaction.type.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDateTime(interaction.createdAt)}
                        </span>
                      </div>
                      
                      {isPartner && interaction.data ? (
                        <div className="space-y-1 text-sm text-gray-600">
                          {interaction.data.subject && (
                            <p className="font-medium">{interaction.data.subject}</p>
                          )}
                          {interaction.data.participants && (
                            <p className="text-xs">
                              Participants: {Array.isArray(interaction.data.participants) 
                                ? interaction.data.participants.map((p: { name?: string; email?: string }) => p.name || p.email).join(', ')
                                : typeof interaction.data.participants === 'string' 
                                  ? interaction.data.participants
                                  : 'N/A'}
                            </p>
                          )}
                          {interaction.data.notes && (
                            <p className="text-xs italic">{interaction.data.notes}</p>
                          )}
                          {interaction.createdBy && (
                            <p className="text-xs text-gray-500">
                              By: {interaction.createdBy.name}
                            </p>
                          )}
                        </div>
                      ) : interaction.summary ? (
                        <div className="space-y-1 text-sm text-gray-600">
                          <p className="font-medium">{interaction.summary.subject}</p>
                          <p className="text-xs">
                            {interaction.summary.participantsCount} participant{interaction.summary.participantsCount !== 1 ? 's' : ''}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500">No details available</p>
                      )}

                      {interaction.relatedEntityType && interaction.relatedEntityId && (
                        <div className="mt-2 pt-2 border-t">
                          <p className="text-xs text-gray-500">
                            Related: {interaction.relatedEntityType} #{interaction.relatedEntityId}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      {!loading && !error && (
        <div className="p-4 border-t bg-white">
          <Button
            variant="default"
            size="sm"
            className="w-full"
            onClick={() => setShowQuickEntry(!showQuickEntry)}
          >
            <Plus className="w-4 h-4 mr-2" />
            {showQuickEntry ? 'Cancel' : 'Quick Add Interaction'}
          </Button>
        </div>
      )}
    </div>
  );
}

