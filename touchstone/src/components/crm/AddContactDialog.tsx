import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../ui/dialog';
// import { Input } from '../ui/input';
import { Input } from '../ui/input'
import { Button } from '../ui/button';
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../ui/command';
import { Field, FieldLabel, FieldError } from '../ui/field';
import { API_ENDPOINTS } from '@/lib/api';
import { Plus, Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import ClientDialog from '@/components/crm/ClientDialog'; // Adjust path as needed
import { toast } from 'react-toastify';


interface AddContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContactAdded?: () => void;
}

interface FormData {
  clientId: string;
  name: string;
  number: string;
  email: string;
  designation: string;
}

interface FormErrors {
  clientId?: string;
  name?: string;
  number?: string;
  email?: string;
}

interface Client {
  id: number;
  companyName: string;
  industry?: string;
}

export default function AddContactDialog({ open, onOpenChange, onContactAdded }: AddContactDialogProps) {
  const [formData, setFormData] = useState<FormData>({
    clientId: '',
    name: '',
    number: '',
    email: '',
    designation: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientComboboxOpen, setClientComboboxOpen] = useState(false);
  const [showClientDialog, setShowClientDialog] = useState(false);
  // Fetch clients when dialog opens
  useEffect(() => {
    if (open) {
      fetchClients();
    }
  }, [open]);

  const fetchClients = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.clients.list, {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setClients(data.data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.clientId) {
      newErrors.clientId = 'Client is required';
    }

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.number.trim()) {
      newErrors.number = 'Phone number is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(API_ENDPOINTS.contacts.create, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: parseInt(formData.clientId),
          name: formData.name,
          number: formData.number,
          email: formData.email,
          designation: formData.designation || null,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Reset form
        setFormData({
          clientId: '',
          name: '',
          number: '',
          email: '',
          designation: '',
        });
        setErrors({});
        
        // Close dialog and trigger refresh
        onOpenChange(false);
        if (onContactAdded) {
          onContactAdded();
        }
      } else {
        // alert(data.message || 'Failed to create contact');
        toast.error(data.message || 'Failed to create contact');
      }
    } catch (error) {
      console.error('Create contact error:', error);
      // alert('Failed to create contact. Please try again.');
      toast.error('Failed to create contact. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setFormData({
        clientId: '',
        name: '',
        number: '',
        email: '',
        designation: '',
      });
      setErrors({});
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[472px] bg-[#F9FAFB] border-[1.5px] border-[#F3F4F6]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-[#2F3C44]">
              Add New Contact
            </DialogTitle>
            <DialogDescription>
              Create a new contact for a client. All fields except designation are required.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-6">
            {/* Row 1: Client */}
            <Field>
              <FieldLabel className="text-base font-medium text-[#2F3C44]">
                Client
              </FieldLabel>
              <Popover open={clientComboboxOpen} onOpenChange={setClientComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={clientComboboxOpen}
                    className="w-full justify-between bg-white border-[1.5px] border-[#E8E8E8] rounded-lg"
                    disabled={isSubmitting}
                  >
                    {formData.clientId ? (
                      (() => {
                        const selectedClient = clients.find(
                          (client) => client.id.toString() === formData.clientId
                        );
                        return selectedClient ? (
                          <>
                            {selectedClient.companyName}
                            {selectedClient.industry && (
                              <span className="text-gray-500 text-xs ml-2">
                                ({selectedClient.industry})
                              </span>
                            )}
                          </>
                        ) : (
                          "Select client"
                        );
                      })()
                    ) : (
                      "Select client"
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search clients..." />
                    <CommandList>
                      <CommandEmpty>No clients found.</CommandEmpty>
                      <CommandGroup>
                        {Array.isArray(clients) && clients.length > 0 ? (
                          clients.map((client, index) => {
                            const id = client?.id?.toString?.() || `temp-${index}`;
                            const name = client?.companyName || "Unnamed Client";

                            return (
                              <CommandItem
                                key={id}
                                value={`${name} ${client?.industry || ''}`}
                                onSelect={() => {
                                  handleChange('clientId', id);
                                  setClientComboboxOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    formData.clientId === id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span>{name}</span>
                                  {client?.industry && (
                                    <span className="text-gray-500 text-xs">
                                      {client.industry}
                                    </span>
                                  )}
                                </div>
                              </CommandItem>
                            );
                          })
                        ) : null}
                        <CommandItem
                          value="__create_new__"
                          onSelect={() => {
                            setShowClientDialog(true);
                            setClientComboboxOpen(false);
                          }}
                          className="text-blue-600 font-medium border-t"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Create New Client
                        </CommandItem>
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {errors.clientId && <FieldError>{errors.clientId}</FieldError>}
              {/* {showNewClientDialog && (
                <p className="text-sm text-blue-600 mt-1">
                  Please use the Clients Hub to create a new client, then return here to select it.
                </p>
              )} */}

            </Field>

            {/* Row 2: Name and Email */}
            <div className="flex gap-6">
              <Field className="flex-1">
                <FieldLabel className="text-base font-medium text-[#2F3C44]">
                  Name
                </FieldLabel>
                <Input
                  placeholder="Enter full name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  disabled={isSubmitting}
                  className="bg-white border-[1.5px] border-[#E8E8E8] rounded-lg"
                />
                {errors.name && <FieldError>{errors.name}</FieldError>}
              </Field>

              <Field className="flex-1">
                <FieldLabel className="text-base font-medium text-[#2F3C44]">
                  Email
                </FieldLabel>
                <Input
                  type="email"
                  placeholder="Enter email address"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={isSubmitting}
                  className="bg-white border-[1.5px] border-[#E8E8E8] rounded-lg"
                />
                {errors.email && <FieldError>{errors.email}</FieldError>}
              </Field>
            </div>

            {/* Row 3: Phone Number and Designation */}
            <div className="flex gap-6">
              <Field className="flex-1">
                <FieldLabel className="text-base font-medium text-[#2F3C44]">
                  Phone Number
                </FieldLabel>
                <Input
                  type="tel"
                  placeholder="Enter phone number"
                  value={formData.number}
                  onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                  disabled={isSubmitting}
                  className="bg-white border-[1.5px] border-[#E8E8E8] rounded-lg"
                />
                {errors.number && <FieldError>{errors.number}</FieldError>}
              </Field>

              <Field className="flex-1">
                <FieldLabel className="text-base font-medium text-[#2F3C44]">
                  Designation
                </FieldLabel>
                <Input
                  placeholder="Enter designation (optional)"
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  disabled={isSubmitting}
                  className="bg-white border-[1.5px] border-[#E8E8E8] rounded-lg"
                />
              </Field>
            </div>
          </div>

          <DialogFooter className="flex gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 border-[1.5px] border-[#0752C2] text-[#0752C2] rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-[#0752C2] hover:bg-[#053F9B] text-white rounded-xl"
            >
              {isSubmitting ? 'Adding...' : 'Add Contact'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

       {/* Client Dialog for creating new client */}
      <ClientDialog
        open={showClientDialog}
        onOpenChange={setShowClientDialog}
        mode="create"
        industries={[]}
        onSuccess={async () => {
          // Refresh clients list after creating new client
          try {
            const response = await fetch(API_ENDPOINTS.clients.list, {
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              },
            });

            if (response.ok) {
              const data = await response.json();
              if (data.success) {
                setClients(data.data);
                // Auto-select the newly created client (last in the list)
                if (data.data.length > 0) {
                  const newClient = data.data[data.data.length - 1];
                  handleChange('clientId', newClient.id.toString());
                }
              }
            }
          } catch (error) {
            console.error('Error refreshing clients:', error);
          }
        }}
      />
    </Dialog>
  );
}