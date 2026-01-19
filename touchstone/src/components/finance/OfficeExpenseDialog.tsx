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
import VendorDialog from './VendorDialog'; // Adjust path as needed


interface RecurringExpense {
  expense_id: number;
  sub_category: string | null;
  vendor?: {
    vendor_id: number;
    vendor_name: string;
  } | null;
  amount: number;
  start_date: string;
  cycle_day: number;
  recurrence_type: string;
  status: string;
  notes: string | null;
}

interface OfficeExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  mode: 'create' | 'edit';
  expenseId?: number;
  initialData?: RecurringExpense | null;
}

interface Vendor {
  vendor_id: number;
  vendor_name: string;
}

const initialFormData = {
  sub_category: '',
  vendor_id: '',
  amount: '',
  start_date: '',
  cycle_day: '1',
  recurrence_type: 'monthly',
  status: 'active',
  notes: '',
};

export default function OfficeExpenseDialog({
  open,
  onOpenChange,
  onSuccess,
  mode,
  expenseId,
  initialData,
}: OfficeExpenseDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [formData, setFormData] = useState(initialFormData);
  const [vendorComboboxOpen, setVendorComboboxOpen] = useState(false);
  const [showVendorDialog, setShowVendorDialog] = useState(false);
  const [savedFormData, setSavedFormData] = useState<typeof initialFormData | null>(null);

  useEffect(() => {
    if (open && mode === 'edit' && initialData) {
      setFormData({
        sub_category: initialData.sub_category || '',
        vendor_id: initialData.vendor?.vendor_id?.toString() || '',
        amount: initialData.amount?.toString() || '',
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

  useEffect(() => {
    const fetchVendors = async () => {
      if (!open) return;

      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/vendors?active_status=true`, {
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          setVendors(data.data || []);
        }
      } catch (error) {
        console.error('Error fetching vendors:', error);
      }
    };

    fetchVendors();
  }, [open]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleCreateVendor = () => {
    // Save current form data before opening vendor dialog
    setSavedFormData({ ...formData });
    setShowVendorDialog(true);
  };

  const handleVendorCreated = async () => {
    // Refresh vendors list
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/vendors?active_status=true`,
        { credentials: 'include' }
      );
      
      if (response.ok) {
        const data = await response.json();
        setVendors(data.data || []);
        
        // Auto-select the newly created vendor (last in the list)
        if (data.data && data.data.length > 0) {
          const newVendor = data.data[data.data.length - 1];
          
          // Restore saved form data and set new vendor
          if (savedFormData) {
            setFormData({
              ...savedFormData,
              vendor_id: newVendor.vendor_id.toString(),
            });
          }
        }
      }
    } catch (error) {
      console.error('Error refreshing vendors:', error);
    }
    
    setShowVendorDialog(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = {
        recurring_type: 'office_expense',
        amount: parseFloat(formData.amount),
        start_date: formData.start_date,
        cycle_day: parseInt(formData.cycle_day),
        recurrence_type: formData.recurrence_type,
        status: formData.status,
        sub_category: formData.sub_category,
        vendor_id: formData.vendor_id ? parseInt(formData.vendor_id) : null,
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
        throw new Error(data.message || `Failed to ${mode} office expense`);
      }

      setFormData(initialFormData);
      onSuccess();
      onOpenChange(false);
      alert(`Office expense ${mode === 'create' ? 'created' : 'updated'} successfully!`);
    } catch (error) {
      console.error(`Error ${mode}ing office expense:`, error);
      alert(error instanceof Error ? error.message : `Failed to ${mode} office expense.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Add Office Expense' : 'Edit Office Expense'}
          </DialogTitle>
          <DialogDescription>
            Fill in the office expense details below. Fields marked with * are required.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sub_category">
                  Category <span className="text-red-500 -ml-1.5">*</span>
                </Label>
                <Select
                  value={formData.sub_category}
                  onValueChange={(value) => handleChange('sub_category', value)}
                  required
                >
                  <SelectTrigger id="sub_category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rent">Rent</SelectItem>
                    <SelectItem value="electricity">Electricity</SelectItem>
                    <SelectItem value="internet">Internet</SelectItem>
                    <SelectItem value="water">Water</SelectItem>
                    <SelectItem value="cleaning">Cleaning</SelectItem>
                    <SelectItem value="security">Security</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="vendor">Vendor</Label>

                <Popover open={vendorComboboxOpen} onOpenChange={setVendorComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={vendorComboboxOpen}
                      className="w-full justify-between bg-white border border-gray-300"
                    >
                      {formData.vendor_id
                        ? (() => {
                            const selected = vendors.find(
                              (v) => v.vendor_id.toString() === formData.vendor_id
                            );
                            return selected ? selected.vendor_name : "Select vendor";
                          })()
                        : "Select vendor (optional)"}

                      <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>

                  <PopoverContent className="w-[300px] p-0">
                    <Command>
                      <CommandInput placeholder="Search vendors..." />

                      <CommandList>
                        <CommandEmpty>No vendors found.</CommandEmpty>

                        <CommandGroup>
                          {/* ✅ Show only first 5 vendors */}
                          {vendors.slice(0, 5).map((vendor) => (
                            <CommandItem
                              key={vendor.vendor_id}
                              value={vendor.vendor_name}
                              onSelect={() => {
                                handleChange("vendor_id", vendor.vendor_id.toString());
                                setVendorComboboxOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  formData.vendor_id === vendor.vendor_id.toString()
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                              {vendor.vendor_name}
                            </CommandItem>
                          ))}
                          
                          {/* ✅ Show message if there are more vendors */}
                          {vendors.length > 5 && (
                            <div className="px-3 py-2 text-xs text-gray-500 italic border-t border-b">
                              + {vendors.length - 5} more vendors (use search to find)
                            </div>
                          )}
                          
                          {/* ✅ Create New Vendor button - always visible at bottom */}
                          <div className="border-t sticky bottom-0 bg-white">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                handleCreateVendor();
                                setVendorComboboxOpen(false);
                              }}
                              className="w-full text-left px-2 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded flex items-center gap-2"
                            >
                              <span className="text-lg">+</span>
                              Create New Vendor
                            </button>
                          </div>
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

            </div>

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
            <Button className="mb-2 flex items-center justify-center gap-2 px-4 py-2.5 
                        bg-gradient-to-r from-red-500 to-red-600  text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-colors duration-200 shadow-md py-3" type="submit" disabled={isSubmitting}>
              {isSubmitting 
                ? (mode === 'create' ? 'Creating...' : 'Updating...') 
                : (mode === 'create' ? 'Create Expense' : 'Update Expense')
              }
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      {/* ✅ Vendor Dialog for creating new vendors */}
      <VendorDialog
        open={showVendorDialog}
        onOpenChange={(open) => {
          setShowVendorDialog(open);
          // If dialog is closed without creating, restore saved data
          if (!open && savedFormData) {
            setFormData(savedFormData);
            setSavedFormData(null);
          }
        }}
        mode="create"
        onSuccess={handleVendorCreated}
      />
    </Dialog>
  );
}

