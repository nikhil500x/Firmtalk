'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { API_ENDPOINTS } from '@/lib/api';
import { Loader2 } from 'lucide-react';

interface ReopenMatterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matterId: number;
  matterTitle: string;
  onSuccess?: () => void;
}

export default function ReopenMatterDialog({
  open,
  onOpenChange,
  matterId,
  matterTitle,
  onSuccess,
}: ReopenMatterDialogProps) {
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    if (!isSubmitting) {
      setComment('');
      setError(null);
      onOpenChange(false);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(API_ENDPOINTS.matters.update(matterId), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          status: 'active',
          status_change_comment: comment.trim() || undefined,
        }),
      });

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      let data;
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        // If not JSON, read as text to see what we got
        const text = await response.text();
        console.error('Non-JSON response:', text);
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to reopen matter');
      }

      if (onSuccess) {
        onSuccess();
      }
      handleClose();
    } catch (err: unknown) {
      console.error('Error reopening matter:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to reopen matter. Please try again.';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Reopen Matter</DialogTitle>
          <DialogDescription>
            Are you sure you want to reopen &quot;{matterTitle}&quot;? This will allow new timesheets and tasks to be created for this matter again.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="comment">Reason/Comment (Optional)</Label>
            <Textarea
              id="comment"
              placeholder="Optionally provide a reason for reopening this matter..."
              value={comment}
              onChange={(e) => {
                setComment(e.target.value);
                setError(null);
              }}
              rows={4}
              disabled={isSubmitting}
              className={error ? 'border-red-500' : ''}
            />
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-green-600 hover:bg-green-700"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Reopening...
              </>
            ) : (
              'Reopen Matter'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

