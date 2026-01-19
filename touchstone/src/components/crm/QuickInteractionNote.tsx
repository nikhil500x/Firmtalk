'use client';

import React, { useState } from 'react';
import { Plus, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { API_ENDPOINTS, apiRequest } from '@/lib/api';

interface QuickInteractionNoteProps {
  contactId: number;
  contactName: string;
  onSuccess?: () => void;
  compact?: boolean;
}

export default function QuickInteractionNote({
  contactId,
  contactName,
  onSuccess,
  compact = false,
}: QuickInteractionNoteProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [note, setNote] = useState('');
  const [subject, setSubject] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!note.trim() && !subject.trim()) {
      setError('Please enter a note or subject');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await apiRequest(API_ENDPOINTS.interactions.create, {
        method: 'POST',
        body: JSON.stringify({
          contactId,
          interactionType: 'note',
          interactionData: {
            subject: subject.trim() || 'Quick Note',
            notes: note.trim(),
            date: new Date().toISOString(),
          },
        }),
      });

      if (response.success) {
        setNote('');
        setSubject('');
        setIsExpanded(false);
        onSuccess?.();
      } else {
        setError(response.message || 'Failed to save note');
      }
    } catch (err) {
      console.error('Error saving quick note:', err);
      setError(err instanceof Error ? err.message : 'Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setNote('');
    setSubject('');
    setError(null);
    setIsExpanded(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (!isExpanded) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="w-full mt-2 text-xs"
        onClick={() => setIsExpanded(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsExpanded(true);
          }
        }}
      >
        <Plus className="w-3 h-3 mr-1" />
        {compact ? 'Note' : 'Quick Note'}
      </Button>
    );
  }

  return (
    <div className="mt-2 p-3 border rounded-lg bg-white shadow-sm">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-700">Add Note for {contactName}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handleCancel}
            disabled={saving}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>

        <input
          type="text"
          placeholder="Subject (optional)"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          disabled={saving}
        />

        <Textarea
          placeholder="Type your note here... (Cmd/Ctrl + Enter to save)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={handleKeyDown}
          className="min-h-[60px] text-sm resize-none"
          disabled={saving}
        />

        {error && (
          <p className="text-xs text-red-600">{error}</p>
        )}

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || (!note.trim() && !subject.trim())}
            className="flex-1"
          >
            {saving ? (
              'Saving...'
            ) : (
              <>
                <Check className="w-3 h-3 mr-1" />
                Save
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancel}
            disabled={saving}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

