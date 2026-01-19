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
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import VendorDialog from './VendorDialog'; // Adjust path as needed

interface OneTimeExpense {
  expense_id: number;
  category: string;
  sub_category: string | null;
  description: string;
  vendor?: {
    vendor_id: number;
    vendor_name: string;
  } | null;
  matter?: {
    matter_id: number;
    matter_title: string;
  } | null;
  amount: number;
  due_date: string | null;
  receipt_url: string | null;
  notes: string | null;
}

interface ExpenseRecordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  mode: 'create' | 'edit';
  expenseId?: number;
  initialData?: OneTimeExpense | null;
}

interface Vendor {
  vendor_id: number;
  vendor_name: string;
}

interface Matter {
  id: number;
  matterTitle: string;
}

const initialFormData = {
  category: '',
  sub_category: '',
  description: '',
  vendor_id: '',
  matter_id: '',
  amount: '',
  due_date: '',
  receipt_url: '',
  notes: '',
};

export default function ExpenseRecordDialog({
  open,
  onOpenChange,
  onSuccess,
  mode,
  expenseId,
  initialData,
}: ExpenseRecordDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [matters, setMatters] = useState<Matter[]>([]);
  const [formData, setFormData] = useState(initialFormData);
  const [vendorComboboxOpen, setVendorComboboxOpen] = useState(false);
  const [matterComboboxOpen, setMatterComboboxOpen] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [showVendorDialog, setShowVendorDialog] = useState(false);
  const [savedFormData, setSavedFormData] = useState<typeof initialFormData | null>(null);

  useEffect(() => {
    if (open && mode === 'edit' && initialData) {
      setFormData({
        category: initialData.category || '',
        sub_category: initialData.sub_category || '',
        description: initialData.description || '',
        vendor_id: initialData.vendor?.vendor_id?.toString() || '',
        matter_id: initialData.matter?.matter_id?.toString() || '',
        amount: initialData.amount?.toString() || '',
        due_date: initialData.due_date ? new Date(initialData.due_date).toISOString().split('T')[0] : '',
        receipt_url: initialData.receipt_url || '',
        notes: initialData.notes || '',
      });
    } else if (open && mode === 'create') {
      setFormData(initialFormData);
    }
  }, [open, mode, initialData]);

  useEffect(() => {
    const fetchData = async () => {
      if (!open) return;

      try {
        const [vendorsRes, mattersRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/vendors?active_status=true`, { credentials: 'include' }),
          fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/matters`, { credentials: 'include' }),
        ]);

        if (vendorsRes.ok) {
          const vendorsData = await vendorsRes.json();
          setVendors(vendorsData.data || []);
        }

        if (mattersRes.ok) {
          const mattersData = await mattersRes.json();
          console.log(mattersData.data);
          setMatters(mattersData.data || []);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, [open]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (e.g., max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      alert('File size must be less than 5MB');
      return;
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      alert('Only images and PDFs are allowed');
      return;
    }

    setReceiptFile(file);

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setReceiptPreview(null);
    }
  };

  const uploadReceiptToS3 = async (file: File): Promise<string> => {
    try {
      // Step 1: Get pre-signed URL from backend
      const presignedResponse = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/uploads/receipt/presigned-url`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type,
          }),
        }
      );

      if (!presignedResponse.ok) {
        throw new Error('Failed to get upload URL');
      }

      const { data } = await presignedResponse.json();
      const { uploadUrl, publicUrl } = data;

      // Step 2: Upload file directly to S3
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file to S3');
      }

      return publicUrl;
    } catch (error) {
      console.error('Error uploading receipt:', error);
      throw error;
    }
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
      let receiptUrl = formData.receipt_url;

      // Upload receipt if a new file was selected
      if (receiptFile) {
        setUploadingReceipt(true);
        receiptUrl = await uploadReceiptToS3(receiptFile);
        setUploadingReceipt(false);
      }

      const payload = {
        category: formData.category,
        sub_category: formData.sub_category || null,
        description: formData.description,
        vendor_id: formData.vendor_id ? parseInt(formData.vendor_id) : null,
        matter_id: formData.matter_id ? parseInt(formData.matter_id) : null,
        amount: parseFloat(formData.amount),
        due_date: formData.due_date || null,
        receipt_url: receiptUrl || null,
        notes: formData.notes || null,
      };

      const url = mode === 'create'
        ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/expenses/onetime`
        : `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/expenses/onetime/${expenseId}`;

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
        throw new Error(data.message || `Failed to ${mode} expense`);
      }

      setFormData(initialFormData);
      setReceiptFile(null);
      setReceiptPreview(null);
      onSuccess();
      onOpenChange(false);
      alert(`Expense ${mode === 'create' ? 'created' : 'updated'} successfully!`);
    } catch (error) {
      console.error(`Error ${mode}ing expense:`, error);
      alert(error instanceof Error ? error.message : `Failed to ${mode} expense.`);
    } finally {
      setIsSubmitting(false);
      setUploadingReceipt(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Add Expense Record' : 'Edit Expense Record'}
          </DialogTitle>
          <DialogDescription>
            Fill in the expense details below. Fields marked with * are required.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">
                  Category <span className="text-red-500 -ml-1.5">*</span>
                </Label>
                <Select
                  value={formData.category ? formData.category : undefined}
                  onValueChange={(value) => handleChange('category', value)}
                >
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="legal_services">Legal Services</SelectItem>
                    <SelectItem value="office_supplies">Office Supplies</SelectItem>
                    <SelectItem value="equipment">Equipment</SelectItem>
                    <SelectItem value="travel">Travel</SelectItem>
                    <SelectItem value="consulting">Consulting</SelectItem>
                    <SelectItem value="misc">Miscellaneous</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sub_category">Sub Category</Label>
                <Input
                  id="sub_category"
                  value={formData.sub_category}
                  onChange={(e) => handleChange('sub_category', e.target.value)}
                  placeholder="e.g., court fees"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">
                Description <span className="text-red-500 -ml-1.5">*</span>
              </Label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                required
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vendor">Vendor</Label>
                <Popover open={vendorComboboxOpen} onOpenChange={setVendorComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={vendorComboboxOpen}
                      className="w-full justify-between"
                    >
                      {formData.vendor_id ? (
                        (() => {
                          const selectedVendor = vendors.find(
                            (vendor) => vendor.vendor_id.toString() === formData.vendor_id
                          );
                          return selectedVendor ? selectedVendor.vendor_name : "Select vendor (optional)";
                        })()
                      ) : (
                        "Select vendor (optional)"
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
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
                                handleChange('vendor_id', String(vendor.vendor_id));
                                setVendorComboboxOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  formData.vendor_id === String(vendor.vendor_id) ? "opacity-100" : "opacity-0"
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

              <div className="space-y-2">
                <Label htmlFor="matter">Matter</Label>
                <Popover open={matterComboboxOpen} onOpenChange={setMatterComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={matterComboboxOpen}
                      className="w-full justify-between"
                    >
                      {formData.matter_id ? (
                        (() => {
                          const selectedMatter = matters.find(
                            (matter) => matter.id.toString() === formData.matter_id
                          );
                          return selectedMatter ? selectedMatter.matterTitle : "Select matter (optional)";
                        })()
                      ) : (
                        "Select matter (optional)"
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search matters..." />
                      <CommandList>
                        <CommandEmpty>No matters found.</CommandEmpty>
                        <CommandGroup>
                          {matters.map((matter) => (
                            <CommandItem
                              key={matter.id}
                              value={matter.matterTitle}
                              onSelect={() => {
                                handleChange('matter_id', String(matter.id));
                                setMatterComboboxOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  formData.matter_id === String(matter.id) ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {matter.matterTitle}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
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
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="due_date">Due Date</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => handleChange('due_date', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="receipt">Receipt Upload</Label>

              {/* Show existing receipt URL if in edit mode */}
              {formData.receipt_url && !receiptFile && (
                <div className="mb-2 p-2 bg-gray-50 rounded border border-gray-200">
                  <p className="text-sm text-gray-600">Current receipt:</p>
                  <a
                    href={formData.receipt_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline break-all"
                  >
                    View Receipt
                  </a>
                </div>
              )}

              {/* File input */}
              <Input
                id="receipt"
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileSelect}
                disabled={uploadingReceipt || isSubmitting}
              />

              <p className="text-xs text-gray-500">
                Supported formats: JPG, PNG, GIF, WebP, PDF (max 5MB)
              </p>

              {/* Preview */}
              {receiptPreview && (
                <div className="mt-2">
                  <Image src={receiptPreview} alt="Receipt preview" width={100} height={100} />
                </div>
              )}

              {receiptFile && (
                <p className="text-sm text-green-600">
                  Selected: {receiptFile.name}
                </p>
              )}

              {uploadingReceipt && (
                <p className="text-sm text-blue-600">
                  Uploading receipt...
                </p>
              )}
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

