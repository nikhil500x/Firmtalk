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
// Searchable Combobox for Lawyer field
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";

import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";

import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";


interface RecurringExpense {
  expense_id: number;
  user_id: number | null;
  gross_salary: number | null;
  deductions: number | null;
  net_salary: number | null;
  start_date: string;
  cycle_day: number;
  recurrence_type: string;
  status: string;
  notes: string | null;
}

interface SalaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  mode: 'create' | 'edit';
  expenseId?: number;
  initialData?: RecurringExpense | null;
}

interface Lawyer {
  id: number;
  name: string;
  email: string;
}

const initialFormData = {
  user_id: '',
  gross_salary: '',
  deductions: '',
  net_salary: '',
  start_date: '',
  cycle_day: '1',
  recurrence_type: 'monthly',
  status: 'active',
  notes: '',
};

export default function SalaryDialog({
  open,
  onOpenChange,
  onSuccess,
  mode,
  expenseId,
  initialData,
}: SalaryDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [Lawyers, setLawyers] = useState<Lawyer[]>([]);
  const [lawyerComboboxOpen, setLawyerComboboxOpen] = useState(false);
  const [formData, setFormData] = useState(initialFormData);

  // Pre-populate form when in edit mode
  useEffect(() => {
    if (open && mode === 'edit' && initialData) {
      setFormData({
        user_id: initialData.user_id?.toString() || '',
        gross_salary: initialData.gross_salary?.toString() || '',
        deductions: initialData.deductions?.toString() || '0',
        net_salary: initialData.net_salary?.toString() || '',
        start_date: initialData.start_date ? new Date(initialData.start_date).toISOString().split('T')[0] : '',
        cycle_day: initialData.cycle_day?.toString() || '1',
        recurrence_type: initialData.recurrence_type || 'monthly',
        status: initialData.status || 'active',
        notes: initialData.notes || '',
      });
    } else if (open && mode === 'create') {
      setFormData(initialFormData);
    }
  }, [open, mode, initialData]);

  // Fetch Lawyers when dialog opens
  useEffect(() => {
    const fetchLawyers = async () => {
      if (!open) return;

      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/users`, {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to fetch Lawyers');
        }

        const data = await response.json();
        console.log(data.data);
        setLawyers(data.data || []);
      } catch (error) {
        console.error('Error fetching Lawyers:', error);
      }
    };

    fetchLawyers();
  }, [open]);

  // Auto-calculate net salary
  useEffect(() => {
    const gross = parseFloat(formData.gross_salary) || 0;
    const deductions = parseFloat(formData.deductions) || 0;
    const net = gross - deductions;
    if (net >= 0 && formData.gross_salary) {
      setFormData(prev => ({ ...prev, net_salary: net.toString() }));
    }
  }, [formData.gross_salary, formData.deductions]);

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
        recurring_type: 'salary',
        amount: parseFloat(formData.net_salary),
        start_date: formData.start_date,
        cycle_day: parseInt(formData.cycle_day),
        recurrence_type: formData.recurrence_type,
        status: formData.status,
        user_id: parseInt(formData.user_id),
        gross_salary: parseFloat(formData.gross_salary),
        deductions: parseFloat(formData.deductions),
        net_salary: parseFloat(formData.net_salary),
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
        throw new Error(data.message || `Failed to ${mode} salary`);
      }

      // Reset form
      setFormData(initialFormData);

      // Notify parent component
      onSuccess();

      // Close dialog
      onOpenChange(false);

      // Show success message
      alert(`Salary ${mode === 'create' ? 'created' : 'updated'} successfully!`);
    } catch (error) {
      console.error(`Error ${mode}ing salary:`, error);
      alert(error instanceof Error ? error.message : `Failed to ${mode} salary. Please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Add Salary Recurring Entry' : 'Edit Salary'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create' 
              ? 'Fill in the salary details below. Fields marked with * are required.'
              : 'Update the salary details below. Fields marked with * are required.'
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6 py-4">
            {/* Lawyer Selection */}
            <div className="space-y-2">
              <Label htmlFor="Lawyer">
                Lawyer <span className="text-red-500 -ml-1.5">*</span>
              </Label>

              <Popover
                open={lawyerComboboxOpen}
                onOpenChange={setLawyerComboboxOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={lawyerComboboxOpen}
                    disabled={mode === 'edit'} 
                    className="w-full justify-between bg-white border border-gray-300"
                  >
                    {formData.user_id
                      ? (() => {
                          const selected = Lawyers.find(
                            (l) => l.id.toString() === formData.user_id
                          );
                          return selected ? `${selected.name} (${selected.email})` : "Select Lawyer";
                        })()
                      : "Select Lawyer"}

                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>

                <PopoverContent className="w-[300px] p-0">
                  <Command>
                    <CommandInput placeholder="Search lawyers..." />
                    <CommandList>
                      <CommandEmpty>No lawyers found.</CommandEmpty>

                      <CommandGroup>
                        {Lawyers.map((lawyer) => (
                          <CommandItem
                            key={lawyer.id}
                            value={`${lawyer.name} ${lawyer.email}`}
                            onSelect={() => {
                              handleChange("user_id", lawyer.id.toString());
                              setLawyerComboboxOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.user_id === lawyer.id.toString()
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                            <span>{lawyer.name}</span>
                            {/* <span className="text-gray-500 text-xs ml-1">
                              ({lawyer.email})
                            </span> */}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

            </div>

            {/* Salary Fields Row */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gross_salary">
                  Gross Salary <span className="text-red-500 -ml-1.5">*</span>
                </Label>
                <Input
                  id="gross_salary"
                  type="number"
                  value={formData.gross_salary}
                  onChange={(e) => handleChange('gross_salary', e.target.value)}
                  required
                  min="0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="deductions">Deductions</Label>
                <Input
                  id="deductions"
                  type="number"
                  value={formData.deductions}
                  onChange={(e) => handleChange('deductions', e.target.value)}
                  min="0"
                  step="1"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="net_salary">
                  Net Salary <span className="text-red-500 -ml-1.5">*</span>
                </Label>
                <Input
                  id="net_salary"
                  type="number"
                  value={formData.net_salary}
                  readOnly
                  className="bg-gray-50"
                />
              </div>
            </div>

            {/* Date and Cycle Day Row */}
            <div className="grid grid-cols-3 gap-4">
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

            {/* Status */}
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
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
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
            <Button className="mb-2 flex items-center justify-center gap-2 px-4 py-2.5 
                        bg-gradient-to-r from-red-500 to-red-600  text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-colors duration-200 shadow-md py-3" type="submit" disabled={isSubmitting}>
              {isSubmitting 
                ? (mode === 'create' ? 'Creating...' : 'Updating...') 
                : (mode === 'create' ? 'Create Salary' : 'Update Salary')
              }
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

