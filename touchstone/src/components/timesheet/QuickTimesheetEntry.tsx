import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { API_ENDPOINTS } from '@/lib/api';
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
import { toast } from 'react-toastify';

interface QuickTimesheetEntryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date | null;
  selectedTimesheet?: Timesheet | null; 
  onSuccess?: () => void;
}

interface Timesheet {
  id: number;
  date: string;
  hoursWorked: number;
  billableHours: number;
  nonBillableHours: number;
  activityType: string;
  description: string;
  matter: {
    id: number;
    title: string;
  } | null;
}

interface Matter {
  id: number;
  title: string;
  client: {
    id: number;
    name: string;
  };
}
// Helper functions for time conversion
const timeStringToMinutes = (timeString: string): number => {
  if (!timeString) return 0;
  const [hours, minutes] = timeString.split(':').map(Number);
  return (hours * 60) + minutes;
};

const minutesToTimeString = (minutes: number): string => {
  if (!minutes) return '00:00';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

export default function QuickTimesheetEntry({
  open,
  onOpenChange,
  selectedTimesheet,
  selectedDate,
  onSuccess,
}: QuickTimesheetEntryProps) {
  const [matters, setMatters] = useState<Matter[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false); 
  const [formData, setFormData] = useState({
    matterId: '',
    billableHours: '00:00',  // Changed to time string
    nonBillableHours: '00:00',  // Changed to time string
    hoursWorked: '00:00',  // Changed to time string
    activityType: '',
    description: '',
  });

  useEffect(() => {
    if (open) {
      fetchMatters();

      // Check if we're editing an existing timesheet
      if (selectedTimesheet) {
        setIsEditMode(true);
        setFormData({
          matterId: selectedTimesheet.matter?.id.toString() || '',
          billableHours: minutesToTimeString(selectedTimesheet.billableHours),
          nonBillableHours: minutesToTimeString(selectedTimesheet.nonBillableHours),
          hoursWorked: minutesToTimeString(selectedTimesheet.hoursWorked),
          activityType: selectedTimesheet.activityType,
          description: selectedTimesheet.description || '',
        });
      } else {
        // Reset form for new entry
        setIsEditMode(false);
        setFormData({
          matterId: '',
          billableHours: '00:00',
          nonBillableHours: '00:00',
          hoursWorked: '00:00',
          activityType: '',
          description: '',
        });
      }
    }
  }, [open, selectedTimesheet]);

  const fetchMatters = async () => {
    try {
      setLoading(true);
      const response = await fetch(API_ENDPOINTS.timesheets.assignedMatters, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch matters');
      }

      const data = await response.json();
      if (data.success) {
        setMatters(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching matters:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleHoursChange = (field: 'billableHours' | 'nonBillableHours', value: string) => {
    const updatedFormData = { ...formData, [field]: value };

    const billableMinutes = timeStringToMinutes(field === 'billableHours' ? value : formData.billableHours);
    const nonBillableMinutes = timeStringToMinutes(field === 'nonBillableHours' ? value : formData.nonBillableHours);
    const totalMinutes = billableMinutes + nonBillableMinutes;

    setFormData({
      ...updatedFormData,
      hoursWorked: minutesToTimeString(totalMinutes),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedDate) {
      // alert('Invalid date selected');
      toast.error('Invalid date selected');
      return;
    }

    if (!formData.matterId || !formData.hoursWorked) {
      // alert('Please fill in all required fields');
      toast.error('Please fill in all required fields');
      return;
    }

    const hoursWorkedMinutes = timeStringToMinutes(formData.hoursWorked);
    const billableMinutes = timeStringToMinutes(formData.billableHours);
    const nonBillableMinutes = timeStringToMinutes(formData.nonBillableHours);

    if (hoursWorkedMinutes <= 0) {
      // alert('Please enter valid hours');
      toast.error('Please enter valid hours');
      return;
    }

    try {
      setSubmitting(true);

      // Determine if we're creating or updating
      const url = isEditMode && selectedTimesheet
        ? API_ENDPOINTS.timesheets.update(selectedTimesheet.id)
        : API_ENDPOINTS.timesheets.create;

      const method = isEditMode ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          matterId: parseInt(formData.matterId),
          date: format(selectedDate, 'yyyy-MM-dd'),
          billableHours: billableMinutes,  // Send as minutes
          nonBillableHours: nonBillableMinutes,  // Send as minutes
          activityType: formData.activityType || 'general',
          description: formData.description || '',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || `Failed to ${isEditMode ? 'update' : 'create'} timesheet entry`);
      }

      const data = await response.json();
      if (data.success) {
        onSuccess?.();
        onOpenChange(false);
      } else {
        throw new Error(data.message || `Failed to ${isEditMode ? 'update' : 'create'} timesheet entry`);
      }
    } catch (error) {
      // alert(error instanceof Error ? error.message : `Failed to ${isEditMode ? 'update' : 'create'} timesheet entry`);
      toast.error(error instanceof Error ? error.message : `Failed to ${isEditMode ? 'update' : 'create'} timesheet entry`);
    } finally {
      setSubmitting(false);
    }
  };

  const activityTypes = [
    'research',
    'drafting',
    'review',
    'meeting',
    'court_hearing',
    'client_communication',
    'document_review',
    'general',
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? 'Edit Timesheet Entry' : 'Quick Timesheet Entry'}
          </DialogTitle>
          <DialogDescription>
            {isEditMode 
              ? `Update timesheet entry for ${selectedDate ? format(selectedDate, 'MMMM d, yyyy') : 'selected date'}`
              : `Add timesheet entry for ${selectedDate ? format(selectedDate, 'MMMM d, yyyy') : 'selected date'}`
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="matter">Matter <span className="text-red-500 -ml-1.5">*</span></Label>
              <Select
                value={formData.matterId}
                onValueChange={(value) => setFormData({ ...formData, matterId: value })}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a matter" />
                </SelectTrigger>
                <SelectContent>
                  {matters.map((matter) => (
                    <SelectItem key={matter.id} value={matter.id.toString()}>
                      {matter.title} - {matter.client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>


            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="billableHours">Billable Hours</Label>
                <Input
                  id="billableHours"
                  type="time"
                  value={formData.billableHours}
                  onChange={(e) => handleHoursChange('billableHours', e.target.value)}
                  className="bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="nonBillableHours">Non-Billable Hours</Label>
                <Input
                  id="nonBillableHours"
                  type="time"
                  value={formData.nonBillableHours}
                  onChange={(e) => handleHoursChange('nonBillableHours', e.target.value)}
                  className="bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="hoursWorked">
                Total Hours <span className="text-red-500 -ml-1.5">*</span>
              </Label>
              <Input
                id="hoursWorked"
                type="time"
                value={formData.hoursWorked}
                readOnly
                className="bg-gray-50 appearance-none [&::-webkit-calendar-picker-indicator]:hidden"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="activityType">Activity Type</Label>
              <Select
                value={formData.activityType}
                onValueChange={(value) => setFormData({ ...formData, activityType: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select activity type" />
                </SelectTrigger>
                <SelectContent>
                  {activityTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of work done"
              />
            </div>

            {/* Info message about rates */}
            {formData.matterId && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <p className="text-xs text-blue-800">
                  ℹ️ Billing rates will be calculated based on your matter assignment. If no rate is set, the amount will remain empty until rates are assigned.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || loading}>
              {submitting ? 'Saving...' : isEditMode ? 'Update Entry' : 'Save Entry'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

