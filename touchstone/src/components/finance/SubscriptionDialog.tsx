import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface RecurringExpense {
  expense_id: number;
  software_name: string | null;
  description: string | null;
  seats_licenses: number | null;
  amount: number;
  start_date: string;
  end_date: string | null;
  cycle_day: number;
  recurrence_type: string;
  status: string;
  notes: string | null;
}

interface SubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  mode: 'create' | 'edit';
  expenseId?: number;
  initialData?: RecurringExpense | null;
}

const initialFormData = {
  software_name: '',
  description: '',
  seats_licenses: '',
  amount: '',
  start_date: '',
  end_date: '',
  cycle_day: '1',
  recurrence_type: 'monthly',
  status: 'active',
  notes: '',
};

export default function SubscriptionDialog({
  open,
  onOpenChange,
  onSuccess,
  mode,
  expenseId,
  initialData,
}: SubscriptionDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState(initialFormData);

  useEffect(() => {
    if (open && mode === 'edit' && initialData) {
      setFormData({
        software_name: initialData.software_name || '',
        description: initialData.description || '',
        seats_licenses: initialData.seats_licenses?.toString() || '',
        amount: initialData.amount?.toString() || '',
        start_date: initialData.start_date ? new Date(initialData.start_date).toISOString().split('T')[0] : '',
        end_date: initialData.end_date ? new Date(initialData.end_date).toISOString().split('T')[0] : '',
        cycle_day: initialData.cycle_day?.toString() || '1',
        recurrence_type: initialData.recurrence_type || 'monthly',
        status: initialData.status || 'active',
        notes: initialData.notes || '',
      });
    } else if (open && mode === 'create') {
      setFormData(initialFormData);
    }
  }, [open, mode, initialData]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = {
        recurring_type: 'subscription',
        amount: parseFloat(formData.amount),
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        cycle_day: parseInt(formData.cycle_day),
        recurrence_type: formData.recurrence_type,
        status: formData.status,
        software_name: formData.software_name,
        description: formData.description,
        seats_licenses: formData.seats_licenses ? parseInt(formData.seats_licenses) : null,
        notes: formData.notes,
      };

      const url = mode === 'create'
        ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/expenses/recurring`
        : `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/expenses/recurring/${expenseId}`;

      const method = mode === 'create' ? 'POST' : 'PATCH';

      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `Failed to ${mode} subscription`);
      }

      setFormData(initialFormData);
      onSuccess();
      onOpenChange(false);
      alert(`Subscription ${mode === 'create' ? 'created' : 'updated'} successfully!`);
    } catch (error) {
      console.error(`Error ${mode}ing subscription:`, error);
      alert(error instanceof Error ? error.message : `Failed to ${mode} subscription.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Add Subscription' : 'Edit Subscription'}
          </DialogTitle>
          <DialogDescription>
            Fill in the subscription details below. Fields marked with * are required.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="software_name">
                Software Name <span className="text-red-500 -ml-1.5">*</span>
              </Label>
              <Input
                id="software_name"
                value={formData.software_name}
                onChange={(e) => handleChange('software_name', e.target.value)}
                required
                placeholder="e.g., Adobe Creative Cloud"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={2}
                placeholder="Brief description of the subscription"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">
                  Amount <span className="text-red-500 -ml-1.5">*</span>
                </Label>
                <Input
                  id="amount"
                  type="number"
                  value={formData.amount}
                  onChange={(e) => handleChange('amount', e.target.value)}
                  required
                  min="0"
                  step="0.01"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="seats_licenses">Seats/Licenses</Label>
                <Input
                  id="seats_licenses"
                  type="number"
                  value={formData.seats_licenses}
                  onChange={(e) => handleChange('seats_licenses', e.target.value)}
                  min="1"
                  placeholder="Number of seats"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">
                  Start Date <span className="text-red-500 -ml-1.5">*</span>
                </Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => handleChange('start_date', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="end_date">End Date (Optional)</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => handleChange('end_date', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cycle_day">
                  Cycle Day (1-31) <span className="text-red-500 -ml-1.5">*</span>
                </Label>
                <Input
                  id="cycle_day"
                  type="number"
                  value={formData.cycle_day}
                  onChange={(e) => handleChange('cycle_day', e.target.value)}
                  required
                  min="1"
                  max="31"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="recurrence_type">Recurrence</Label>
                <Select
                  value={formData.recurrence_type}
                  onValueChange={(value) => handleChange('recurrence_type', value)}
                >
                  <SelectTrigger id="recurrence_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => handleChange('status', value)}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting 
                ? (mode === 'create' ? 'Creating...' : 'Updating...') 
                : (mode === 'create' ? 'Create Subscription' : 'Update Subscription')
              }
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

