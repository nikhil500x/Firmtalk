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

interface Vendor {
  vendor_id: number;
  vendor_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  gstin: string | null;
  pan: string | null;
  bank_name: string | null;
  account_number: string | null;
  ifsc_code: string | null;
  payment_terms: string | null;
  active_status: boolean;
  notes: string | null;
}

interface VendorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  mode: 'create' | 'edit';
  vendorId?: number;
  initialData?: Vendor | null;
}

const initialFormData = {
  vendor_name: '',
  contact_name: '',
  email: '',
  phone: '',
  address: '',
  gstin: '',
  pan: '',
  bank_name: '',
  account_number: '',
  ifsc_code: '',
  payment_terms: '',
  active_status: 'true',
  notes: '',
};

export default function VendorDialog({
  open,
  onOpenChange,
  onSuccess,
  mode,
  vendorId,
  initialData,
}: VendorDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState(initialFormData);

  useEffect(() => {
    if (open && mode === 'edit' && initialData) {
      setFormData({
        vendor_name: initialData.vendor_name || '',
        contact_name: initialData.contact_name || '',
        email: initialData.email || '',
        phone: initialData.phone || '',
        address: initialData.address || '',
        gstin: initialData.gstin || '',
        pan: initialData.pan || '',
        bank_name: initialData.bank_name || '',
        account_number: initialData.account_number || '',
        ifsc_code: initialData.ifsc_code || '',
        payment_terms: initialData.payment_terms || '',
        active_status: initialData.active_status ? 'true' : 'false',
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
        vendor_name: formData.vendor_name,
        contact_name: formData.contact_name || null,
        email: formData.email || null,
        phone: formData.phone || null,
        address: formData.address || null,
        gstin: formData.gstin || null,
        pan: formData.pan || null,
        bank_name: formData.bank_name || null,
        account_number: formData.account_number || null,
        ifsc_code: formData.ifsc_code || null,
        payment_terms: formData.payment_terms || null,
        active_status: formData.active_status === 'true',
        notes: formData.notes || null,
      };

      const url = mode === 'create'
        ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/vendors`
        : `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/vendors/${vendorId}`;

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
        throw new Error(data.message || `Failed to ${mode} vendor`);
      }

      setFormData(initialFormData);
      onSuccess();
      onOpenChange(false);
      alert(`Vendor ${mode === 'create' ? 'created' : 'updated'} successfully!`);
    } catch (error) {
      console.error(`Error ${mode}ing vendor:`, error);
      alert(error instanceof Error ? error.message : `Failed to ${mode} vendor.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Add Vendor' : 'Edit Vendor'}
          </DialogTitle>
          <DialogDescription>
            Fill in the vendor details below. Fields marked with * are required.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6 py-4">
            {/* BASIC INFORMATION */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 uppercase">Basic Information</h3>
              
              <div className="space-y-2">
                <Label htmlFor="vendor_name">
                  Vendor Name <span className="text-red-500 -ml-1.5">*</span>
                </Label>
                <Input
                  id="vendor_name"
                  value={formData.vendor_name}
                  onChange={(e) => handleChange('vendor_name', e.target.value)}
                  required
                  placeholder="Enter vendor name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contact_name">Contact Person</Label>
                  <Input
                    id="contact_name"
                    value={formData.contact_name}
                    onChange={(e) => handleChange('contact_name', e.target.value)}
                    placeholder="Contact person name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    placeholder="+91 XXXXXXXXXX"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="vendor@example.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Full address"
                />
              </div>
            </div>

            {/* TAX INFORMATION */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 uppercase">Tax Information</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gstin">GSTIN</Label>
                  <Input
                    id="gstin"
                    value={formData.gstin}
                    onChange={(e) => handleChange('gstin', e.target.value)}
                    placeholder="22AAAAA0000A1Z5"
                    maxLength={15}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pan">PAN</Label>
                  <Input
                    id="pan"
                    value={formData.pan}
                    onChange={(e) => handleChange('pan', e.target.value)}
                    placeholder="AAAAA0000A"
                    maxLength={10}
                  />
                </div>
              </div>
            </div>

            {/* BANKING INFORMATION */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 uppercase">Banking Information</h3>
              
              <div className="space-y-2">
                <Label htmlFor="bank_name">Bank Account Name</Label>
                <Input
                  id="bank_name"
                  value={formData.bank_name}
                  onChange={(e) => handleChange('bank_name', e.target.value)}
                  placeholder="Bank Account Name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="account_number">Account Number</Label>
                  <Input
                    id="account_number"
                    value={formData.account_number}
                    onChange={(e) => handleChange('account_number', e.target.value)}
                    placeholder="Account number"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ifsc_code">IFSC Code</Label>
                  <Input
                    id="ifsc_code"
                    value={formData.ifsc_code}
                    onChange={(e) => handleChange('ifsc_code', e.target.value)}
                    placeholder="IFSC code"
                    maxLength={11}
                  />
                </div>
              </div>
            </div>

            {/* PAYMENT & STATUS */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 uppercase">Payment & Status</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="payment_terms">Payment Terms</Label>
                  <Input
                    id="payment_terms"
                    value={formData.payment_terms}
                    onChange={(e) => handleChange('payment_terms', e.target.value)}
                    placeholder="e.g., Net 30"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="active_status">Status</Label>
                  <Select
                    value={formData.active_status}
                    onValueChange={(value) => handleChange('active_status', value)}
                  >
                    <SelectTrigger id="active_status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Active</SelectItem>
                      <SelectItem value="false">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* NOTES */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Additional notes"
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
                : (mode === 'create' ? 'Create Vendor' : 'Update Vendor')
              }
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

