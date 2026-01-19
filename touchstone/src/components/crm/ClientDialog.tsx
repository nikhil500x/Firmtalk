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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { API_ENDPOINTS } from '@/lib/api';
import { Plus, UserPlus, X, Check, Trash2 } from 'lucide-react';
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
import { ChevronsUpDown, Check as CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from 'react-toastify';

interface ClientGroup {
  id: number;
  name: string;
  description?: string;
}

interface Contact {
  id: number;
  name: string;
  email: string;
  number: string;
  designation?: string;
  isPrimary: boolean;
}

interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
}

interface InternalReference {
  id: number;
  name: string;
  email: string;
  phone?: string;
}

interface Client {
  id: number;
  clientCode: string;
  companyName: string;
  industry: string;
  clientGroup: string;
  website: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  contactsCount: number;
  contacts: Contact[];
  status: 'Active' | 'Inactive' | 'Prospect';
  internalReference?: InternalReference;
  externalReferenceName?: string;
  externalReferenceEmail?: string;
  externalReferencePhone?: string;
  notes?: string;
  clientCreationRequestedBy?: number;
}

interface ClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  mode: 'create' | 'edit';
  clientData?: Client;
  industries: string[];
}

interface AdditionalContact {
  id?: number;
  tempId?: string; // For tracking before save
  name: string;
  email: string;
  number: string;
  designation: string;
}

const initialFormData = {
  companyName: '',
  industry: '',
  clientGroup: '',
  website: '',
  address: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
  primaryContactName: '',
  primaryContactEmail: '',
  primaryContactPhone: '',
  primaryContactDesignation: '',
  status: 'Active',
  clientCreationRequestedBy: '',
  internalReferenceId: '',
  externalReferenceName: '',
  externalReferenceEmail: '',
  externalReferencePhone: '',
  notes: '',
};

const createEmptyContact = (): AdditionalContact => ({
  tempId: `temp-${Date.now()}-${Math.random()}`,
  name: '',
  email: '',
  number: '',
  designation: '',
});

export default function ClientDialog({
  open,
  onOpenChange,
  onSuccess,
  mode,
  clientData,
  industries,
}: ClientDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clientGroups, setClientGroups] = useState<ClientGroup[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [showNewGroupInput, setShowNewGroupInput] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [clientGroupComboboxOpen, setClientGroupComboboxOpen] = useState(false);
  
  const [showReferenceSection, setShowReferenceSection] = useState(false);
  const [referenceType, setReferenceType] = useState<'internal' | 'external' | ''>('');
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userComboboxOpen, setUserComboboxOpen] = useState(false);

  const [requestedByUsers, setRequestedByUsers] = useState<User[]>([]);
  const [isLoadingRequestedByUsers, setIsLoadingRequestedByUsers] = useState(false);
  const [requestedByComboboxOpen, setRequestedByComboboxOpen] = useState(false);
  
  const [formData, setFormData] = useState(initialFormData);
  
  // Contact management - similar to expenses
  const [savedContacts, setSavedContacts] = useState<AdditionalContact[]>([]); // Confirmed contacts
  const [currentContact, setCurrentContact] = useState<AdditionalContact | null>(null); // Contact being edited
  const [showContactForm, setShowContactForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showNewIndustryInput, setShowNewIndustryInput] = useState(false);
  const [newIndustryName, setNewIndustryName] = useState('');

  // Pre-populate form when in edit mode
  useEffect(() => {
    if (open && mode === 'edit' && clientData) {
      const primaryContact = clientData.contacts?.find(c => c.isPrimary);
      const nonPrimaryContacts = clientData.contacts?.filter(c => !c.isPrimary) || [];
      
      let refType: 'internal' | 'external' | '' = '';
      if (clientData.internalReference) {
        refType = 'internal';
        setShowReferenceSection(true);
      } else if (clientData.externalReferenceName) {
        refType = 'external';
        setShowReferenceSection(true);
      }
      setReferenceType(refType);
      
      setFormData({
        companyName: clientData.companyName || '',
        industry: clientData.industry || '',
        clientGroup: clientData.clientGroup || '',
        website: clientData.website || '',
        address: clientData.address || '',
        city: clientData.city || '',
        state: clientData.state || '',
        postalCode: clientData.postalCode || '',
        country: clientData.country || '',
        primaryContactName: primaryContact?.name || '',
        primaryContactEmail: primaryContact?.email || '',
        primaryContactPhone: primaryContact?.number || '',
        primaryContactDesignation: primaryContact?.designation || '',
        status: clientData.status || 'Active',
        clientCreationRequestedBy: clientData.clientCreationRequestedBy?.toString() || '',
        internalReferenceId: clientData.internalReference?.id?.toString() || '',
        externalReferenceName: clientData.externalReferenceName || '',
        externalReferenceEmail: clientData.externalReferenceEmail || '',
        externalReferencePhone: clientData.externalReferencePhone || '',
        notes: clientData.notes || '',
      });

      // Set saved contacts (confirmed state)
      setSavedContacts(
        nonPrimaryContacts.map(c => ({
          id: c.id,
          name: c.name,
          email: c.email,
          number: c.number,
          designation: c.designation || '',
        }))
      );
      setCurrentContact(null);
      setShowContactForm(false);
    } else if (open && mode === 'create') {
      setFormData(initialFormData);
      setSavedContacts([]);
      setCurrentContact(null);
      setShowContactForm(false);
      setShowReferenceSection(false);
      setReferenceType('');
    }
  }, [open, mode, clientData]);

  // Fetch client groups
  useEffect(() => {
    const fetchClientGroups = async () => {
      if (!open) return;

      try {
        setIsLoadingGroups(true);
        const response = await fetch(API_ENDPOINTS.clients.groups.list, {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch client groups');
        }

        const data = await response.json();

        if (data.success) {
          setClientGroups(data.data);
        }
      } catch (error) {
        console.error('Error fetching client groups:', error);
      } finally {
        setIsLoadingGroups(false);
      }
    };

    fetchClientGroups();
  }, [open]);

  // Fetch users for "Requested By" dropdown
  useEffect(() => {
    const fetchRequestedByUsers = async () => {
      if (!open) return;

      try {
        setIsLoadingRequestedByUsers(true);
        const response = await fetch(API_ENDPOINTS.users.list, {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch users');
        }

        const data = await response.json();

        if (data.success) {
          setRequestedByUsers(data.data);
        }
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setIsLoadingRequestedByUsers(false);
      }
    };

    fetchRequestedByUsers();
  }, [open]);

  // Fetch users for internal reference
  useEffect(() => {
    const fetchUsers = async () => {
      if (!open || referenceType !== 'internal') return;

      try {
        setIsLoadingUsers(true);
        const response = await fetch(API_ENDPOINTS.users.list, {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch users');
        }

        const data = await response.json();

        if (data.success) {
          setUsers(data.data);
        }
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setIsLoadingUsers(false);
      }
    };

    fetchUsers();
  }, [open, referenceType]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleInternalReferenceSelect = (userId: string) => {
    const selectedUser = users.find(u => u.id.toString() === userId);
    if (selectedUser) {
      setFormData((prev) => ({
        ...prev,
        internalReferenceId: userId,
      }));
    }
  };

  // ============================================================================
  // CONTACT MANAGEMENT - Like Expenses
  // ============================================================================

  const handleAddContactClick = () => {
    setCurrentContact(createEmptyContact());
    setShowContactForm(true);
    setError(null);
  };

  const handleSaveCurrentContact = () => {
    if (!currentContact) return;

    // Validate current contact
    if (!currentContact.name || !currentContact.email || !currentContact.number) {
      setError('Please fill in name, email, and phone for the contact');
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(currentContact.email)) {
      setError('Please enter a valid email address');
      return;
    }

    // Add to saved contacts
    setSavedContacts((prev) => [...prev, currentContact]);
    
    // Reset current contact
    setCurrentContact(null);
    setShowContactForm(false);
    setError(null);
  };

  const handleCancelCurrentContact = () => {
    setCurrentContact(null);
    setShowContactForm(false);
    setError(null);
  };

  const handleRemoveSavedContact = (contactId: string) => {
    setSavedContacts((prev) => prev.filter((contact) => 
      contact.id ? contact.id.toString() !== contactId : contact.tempId !== contactId
    ));
  };

  const handleCurrentContactChange = (field: keyof AdditionalContact, value: string) => {
    if (currentContact) {
      setCurrentContact((prev) => prev ? { ...prev, [field]: value } : null);
    }
  };

  const handleCreateNewGroup = async () => {
    if (!newGroupName.trim()) {
      // alert('Please enter a group name');
      toast.error('Please enter a group name');
      return;
    }

    try {
      setIsCreatingGroup(true);
      const response = await fetch(API_ENDPOINTS.clients.groups.create, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newGroupName }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create client group');
      }

      setClientGroups((prev) => [...prev, data.data]);
      
      setFormData((prev) => ({
        ...prev,
        clientGroup: data.data.name,
      }));

      setNewGroupName('');
      setShowNewGroupInput(false);

      // alert('Client group created successfully!');
      toast.success('Client group created successfully!');
    } catch (error) {
      console.error('Error creating client group:', error);
      // alert(error instanceof Error ? error.message : 'Failed to create client group. Please try again.');
      toast.error(error instanceof Error ? error.message : 'Failed to create client group. Please try again.');
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Check if there's an unsaved contact being edited
    if (showContactForm && currentContact) {
      setError('Please save or cancel the current contact before submitting');
      return;
    }

    setIsSubmitting(true);

    try {
      const url = mode === 'create' 
        ? API_ENDPOINTS.clients.create 
        : API_ENDPOINTS.clients.update(clientData!.id);
      
      const method = mode === 'create' ? 'POST' : 'PUT';

      const clientPayload: Record<string, unknown> = {
        companyName: formData.companyName,
        industry: formData.industry,
        clientGroup: formData.clientGroup,
        website: formData.website,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        postalCode: formData.postalCode,
        country: formData.country,
        status: formData.status,
        notes: formData.notes || null,
        clientCreationRequestedBy: formData.clientCreationRequestedBy ? parseInt(formData.clientCreationRequestedBy) : null,
      };

      if (referenceType === 'internal' && formData.internalReferenceId) {
        clientPayload.internalReferenceId = formData.internalReferenceId;
        clientPayload.externalReferenceName = null;
        clientPayload.externalReferenceEmail = null;
        clientPayload.externalReferencePhone = null;
      } else if (referenceType === 'external' && formData.externalReferenceName) {
        clientPayload.externalReferenceName = formData.externalReferenceName;
        clientPayload.externalReferenceEmail = formData.externalReferenceEmail || null;
        clientPayload.externalReferencePhone = formData.externalReferencePhone || null;
        clientPayload.internalReferenceId = null;
      } else {
        clientPayload.internalReferenceId = null;
        clientPayload.externalReferenceName = null;
        clientPayload.externalReferenceEmail = null;
        clientPayload.externalReferencePhone = null;
      }

      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(clientPayload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `Failed to ${mode} client`);
      }

      const clientId = mode === 'create' ? data.data.id : clientData!.id;

      // Handle primary contact
      if (formData.primaryContactName && formData.primaryContactEmail && formData.primaryContactPhone) {
        const primaryContactPayload = {
          client_id: clientId,
          name: formData.primaryContactName,
          email: formData.primaryContactEmail,
          number: formData.primaryContactPhone,
          designation: formData.primaryContactDesignation || null,
          is_primary: true,
        };

        if (mode === 'edit' && clientData?.contacts) {
          const existingPrimary = clientData.contacts.find(c => c.isPrimary);
          
          if (existingPrimary) {
            await fetch(API_ENDPOINTS.contacts.update(existingPrimary.id), {
              method: 'PUT',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(primaryContactPayload),
            });
          } else {
            await fetch(API_ENDPOINTS.contacts.create, {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(primaryContactPayload),
            });
          }
        } else {
          await fetch(API_ENDPOINTS.contacts.create, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(primaryContactPayload),
          });
        }
      }

      // Handle saved additional contacts
      if (mode === 'edit' && clientData?.contacts) {
        const existingContactIds = clientData.contacts
          .filter(c => !c.isPrimary)
          .map(c => c.id);
        
        const formContactIds = savedContacts
          .filter(c => c.id)
          .map(c => c.id!);

        const contactsToDelete = existingContactIds.filter(id => !formContactIds.includes(id));
        for (const contactId of contactsToDelete) {
          await fetch(API_ENDPOINTS.contacts.delete(contactId), {
            method: 'DELETE',
            credentials: 'include',
          });
        }
      }

      for (const contact of savedContacts) {
        if (!contact.name.trim() || !contact.email.trim() || !contact.number.trim()) {
          continue;
        }

        const contactPayload = {
          client_id: clientId,
          name: contact.name,
          email: contact.email,
          number: contact.number,
          designation: contact.designation || null,
          is_primary: false,
        };

        if (contact.id) {
          await fetch(API_ENDPOINTS.contacts.update(contact.id), {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(contactPayload),
          });
        } else {
          await fetch(API_ENDPOINTS.contacts.create, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(contactPayload),
          });
        }
      }

      setFormData(initialFormData);
      setSavedContacts([]);
      setCurrentContact(null);
      setShowContactForm(false);
      setShowReferenceSection(false);
      setReferenceType('');

      onSuccess?.();
      onOpenChange(false);

      // alert(`Client ${mode === 'create' ? 'created' : 'updated'} successfully!`);
      toast.success(`Client ${mode === 'create' ? 'created' : 'updated'} successfully!`);
    } catch (error) {
      console.error(`Error ${mode}ing client:`, error);
      setError(error instanceof Error ? error.message : `Failed to ${mode} client. Please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedReferrer = users.find(u => u.id.toString() === formData.internalReferenceId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Add New Client' : 'Edit Client'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create' 
              ? 'Fill in the client details below. Fields marked with * are required.'
              : 'Update the client details below. Fields marked with * are required.'
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6 py-4">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}

            {/* CLIENT CREATION REQUESTER */}
            <div className="space-y-4 pb-4 border-b">
              <div className="space-y-2">
                <Label htmlFor="requestedBy">Client Creation Requested By</Label>
                <Popover open={requestedByComboboxOpen} onOpenChange={setRequestedByComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={requestedByComboboxOpen}
                      className="w-full justify-between"
                    >
                      {formData.clientCreationRequestedBy
                        ? requestedByUsers.find(u => u.id.toString() === formData.clientCreationRequestedBy)?.name
                        : "Select user..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput placeholder="Search user..." />
                      <CommandList>
                        <CommandEmpty>No user found.</CommandEmpty>
                        <CommandGroup>
                          {requestedByUsers.map((user) => (
                            <CommandItem
                              key={user.id}
                              value={user.name}
                              onSelect={() => {
                                handleChange('clientCreationRequestedBy', user.id.toString());
                                setRequestedByComboboxOpen(false);
                              }}
                            >
                              <CheckIcon
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  formData.clientCreationRequestedBy === user.id.toString()
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                              <div>
                                <div className="font-medium">{user.name}</div>
                                <div className="text-sm text-gray-500">{user.email}</div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* COMPANY INFORMATION */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Company Information
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">
                    Company Name<span className="text-red-500 -ml-1.5">*</span>
                  </Label>
                  <Input
                    id="companyName"
                    value={formData.companyName}
                    onChange={(e) => handleChange('companyName', e.target.value)}
                    placeholder="e.g., XYZ Corporation Pvt. Ltd."
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="industry">
                    Industry<span className="text-red-500 -ml-1.5">*</span>
                  </Label>

                  {!showNewIndustryInput ? (
                    <Select
                      value={formData.industry || undefined}
                      onValueChange={(value) => handleChange('industry', value)}
                      required
                    >
                      <SelectTrigger id="industry">
                        <SelectValue placeholder="Select industry" />
                      </SelectTrigger>

                      <SelectContent>
                        <div className="max-h-60 overflow-y-auto">

                          {formData.industry &&
                            ![
                              "Finance",
                              "Technology",
                              "Healthcare",
                              "Manufacturing",
                              "Retail",
                              "Real Estate",
                              "Education",
                              "Other",
                            ].includes(formData.industry) && (
                              <SelectItem value={formData.industry}>
                                {formData.industry}
                              </SelectItem>
                            )}
                          <SelectItem value="Finance">Finance</SelectItem>
                          <SelectItem value="Technology">Technology</SelectItem>
                          <SelectItem value="Healthcare">Healthcare</SelectItem>
                          <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                          <SelectItem value="Retail">Retail</SelectItem>
                          <SelectItem value="Real Estate">Real Estate</SelectItem>
                          <SelectItem value="Education">Education</SelectItem>
                          {/* <SelectItem value="Other">Other</SelectItem> */}
                        </div>

                        <div className="border-t p-2">
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 text-sm font-medium text-blue-600"
                            onClick={() => {
                              setShowNewIndustryInput(true);
                              setNewIndustryName('');
                              handleChange('industry', '');
                            }}
                          >
                            <Plus className="h-4 w-4" />
                            Add New Industry
                          </button>
                        </div>
                      </SelectContent>

                    </Select>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        value={newIndustryName}
                        onChange={(e) => {
                          setNewIndustryName(e.target.value);
                          handleChange('industry', e.target.value);
                        }}
                        placeholder="Enter new industry"
                        className="flex-1"
                        autoFocus
                      />

                      <Button
                        type="button"
                        onClick={() => setShowNewIndustryInput(false)}
                        disabled={!newIndustryName.trim()}
                      >
                        Done
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowNewIndustryInput(false);
                          setNewIndustryName('');
                          handleChange('industry', '');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>

              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clientGroup">Client Group</Label>

                  {!showNewGroupInput ? (
                    <div className="flex gap-1">
                      <Popover
                        open={clientGroupComboboxOpen}
                        onOpenChange={setClientGroupComboboxOpen}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={clientGroupComboboxOpen}
                            className="flex-1 justify-between bg-white border border-gray-300"
                          >
                            {formData.clientGroup
                              ? formData.clientGroup
                              : isLoadingGroups
                              ? "Loading..."
                              : "Select or create group"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                          </Button>
                        </PopoverTrigger>

                        <PopoverContent className="w-[300px] p-0">
                          <Command>
                            <CommandInput placeholder="Search groups..." />

                            {/* Scrollable list */}
                            <CommandList className="max-h-64 overflow-y-auto">
                              <CommandEmpty>No matching groups.</CommandEmpty>

                              <CommandGroup>
                                <CommandItem
                                  value="Independent"
                                  onSelect={() => {
                                    handleChange("clientGroup", "Independent");
                                    setClientGroupComboboxOpen(false);
                                  }}
                                >
                                  <CheckIcon
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      formData.clientGroup === "Independent"
                                        ? "opacity-100"
                                        : "opacity-0"
                                    )}
                                  />
                                  Independent (No Group)
                                </CommandItem>

                                {clientGroups.map((group) => (
                                  <CommandItem
                                    key={group.id}
                                    value={group.name}
                                    onSelect={() => {
                                      handleChange("clientGroup", group.name);
                                      setClientGroupComboboxOpen(false);
                                    }}
                                  >
                                    <CheckIcon
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        formData.clientGroup === group.name
                                          ? "opacity-100"
                                          : "opacity-0"
                                      )}
                                    />
                                    {group.name}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>

                            {/* Fixed bottom action */}
                            <div className="border-t bg-white p-2">
                              <CommandItem
                                value="__create_new__"
                                className="text-blue-600 font-medium"
                                onSelect={() => {
                                  setShowNewGroupInput(true);
                                  setFormData((p) => ({ ...p, clientGroup: "" }));
                                  setClientGroupComboboxOpen(false);
                                }}
                              >
                                <Plus className="mr-2 h-4 w-4" />
                                Create New Group
                              </CommandItem>
                            </div>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        placeholder="Enter new group name"
                        className="flex-1"
                      />

                      <Button
                        type="button"
                        onClick={handleCreateNewGroup}
                        disabled={isCreatingGroup || !newGroupName.trim()}
                        className="shrink-0"
                      >
                        {isCreatingGroup ? "Creating..." : "Create"}
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowNewGroupInput(false);
                          setNewGroupName("");
                        }}
                        className="shrink-0"
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>


                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={formData.website}
                    onChange={(e) => handleChange('website', e.target.value)}
                    placeholder="e.g., www.xyzcorp.com"
                    type="url"
                  />
                </div>
              </div>
            </div>

            {/* ADDRESS INFORMATION */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Address Information
              </h3>

              <div className="space-y-2">
                <Label htmlFor="address">Street Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  placeholder="e.g., 123, Block A, Business District"
                />
              </div>

              {/* <div className="grid grid-cols-2 gap-4"> */}
                {/* <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => handleChange('city', e.target.value)}
                    placeholder="e.g., Mumbai"
                  />
                </div> */}

                {/* <div className="space-y-2">
                  <Label htmlFor="state">State/Province</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => handleChange('state', e.target.value)}
                    placeholder="e.g., Maharashtra"
                  />
                </div> */}
              {/* </div> */}

              {/* <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="postalCode">Postal Code</Label>
                  <Input
                    id="postalCode"
                    value={formData.postalCode}
                    onChange={(e) => handleChange('postalCode', e.target.value)}
                    placeholder="e.g., 110046"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(e) => handleChange('country', e.target.value)}
                    placeholder="e.g., India"
                  />
                </div>
              </div> */}
            </div>

            {/* PRIMARY CONTACT INFORMATION */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Primary Contact
              </h3>

              <div className="space-y-2">
                <Label htmlFor="primaryContactName">Contact Name
                  <span className="text-red-500 -ml-1.5">*</span>
                </Label>
                <Input
                  id="primaryContactName"
                  value={formData.primaryContactName}
                  onChange={(e) => handleChange('primaryContactName', e.target.value)}
                  placeholder="e.g., Raj Mehta"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="primaryContactEmail">Email
                    <span className="text-red-500 -ml-1.5">*</span>
                  </Label>
                  <Input
                    id="primaryContactEmail"
                    value={formData.primaryContactEmail}
                    onChange={(e) => handleChange('primaryContactEmail', e.target.value)}
                    placeholder="e.g., raj.mehta@xyzcorp.com"
                    type="email"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="primaryContactPhone">Phone
                    <span className="text-red-500 -ml-1.5">*</span>
                  </Label>
                  <Input
                    id="primaryContactPhone"
                    value={formData.primaryContactPhone}
                    onChange={(e) => handleChange('primaryContactPhone', e.target.value)}
                    placeholder="e.g., +91 98765 43210"
                    type="tel"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="primaryContactDesignation">Designation </Label>
                <Input
                  id="primaryContactDesignation"
                  value={formData.primaryContactDesignation}
                  onChange={(e) => handleChange('primaryContactDesignation', e.target.value)}
                  placeholder="e.g., CEO, Manager"
                />
              </div>
            </div>

            {/* REFERENCE SECTION */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  Reference 
                </h3>
                
                {!showReferenceSection && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowReferenceSection(true)}
                    className="text-blue-600 border-blue-600 hover:bg-blue-50"
                  >
                    <UserPlus size={16} className="mr-1" />
                    Add Reference
                  </Button>
                )}
              </div>

              {showReferenceSection && (
                <div className="border border-gray-200 rounded-lg p-4 space-y-4 relative">
                  <button
                    type="button"
                    onClick={() => {
                      setShowReferenceSection(false);
                      setReferenceType('');
                      setFormData(prev => ({
                        ...prev,
                        internalReferenceId: '',
                        externalReferenceName: '',
                        externalReferenceEmail: '',
                        externalReferencePhone: '',
                        notes: '',
                      }));
                    }}
                    className="absolute top-2 right-2 text-red-600 hover:text-red-800"
                    title="Remove reference"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  <div className="space-y-2">
                    <Label>Reference Type</Label>
                    <Select
                      value={referenceType}
                      onValueChange={(value: 'internal' | 'external') => {
                        setReferenceType(value);
                        setFormData(prev => ({
                          ...prev,
                          internalReferenceId: '',
                          externalReferenceName: '',
                          externalReferenceEmail: '',
                          externalReferencePhone: '',
                          notes: '',
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select reference type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="internal">Internal (From our team)</SelectItem>
                        <SelectItem value="external">External (Outside contact)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {referenceType === 'internal' && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label>Select Team Member</Label>
                        <Popover open={userComboboxOpen} onOpenChange={setUserComboboxOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={userComboboxOpen}
                              className="w-full justify-between bg-white"
                            >
                              {selectedReferrer?.name || (isLoadingUsers ? "Loading..." : "Select referrer")}
                              <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0">
                            <Command>
                              <CommandInput placeholder="Search team members..." />
                              <CommandList>
                                <CommandEmpty>No team member found.</CommandEmpty>
                                <CommandGroup>
                                  {users.map((user) => (
                                    <CommandItem
                                      key={user.id}
                                      value={String(user.id)}
                                      onSelect={(value) => {
                                        handleInternalReferenceSelect(value);
                                        setUserComboboxOpen(false);
                                      }}
                                    >
                                      <CheckIcon
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          formData.internalReferenceId === user.id.toString()
                                            ? "opacity-100"
                                            : "opacity-0"
                                        )}
                                      />
                                      <div>
                                        <div className="font-medium">{user.name}</div>
                                        <div className="text-xs text-gray-500">{user.email}</div>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>

                      {selectedReferrer && (
                        <>
                          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 space-y-1">
                            <div className="text-sm">
                              <span className="font-medium text-gray-700">Email:</span>{' '}
                              <span className="text-gray-900">{selectedReferrer.email}</span>
                            </div>
                            {selectedReferrer.phone && (
                              <div className="text-sm">
                                <span className="font-medium text-gray-700">Phone:</span>{' '}
                                <span className="text-gray-900">{selectedReferrer.phone}</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="internalReferenceNotes">Notes </Label>
                            <Textarea
                              id="internalReferenceNotes"
                              value={formData.notes}
                              onChange={(e) => handleChange('notes', e.target.value)}
                              placeholder="Add any additional notes about this reference..."
                              rows={3}
                              className="resize-none"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {referenceType === 'external' && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="externalReferenceName">
                          Reference Name <span className="text-red-500 -ml-1.5">*</span>
                        </Label>
                        <Input
                          id="externalReferenceName"
                          value={formData.externalReferenceName}
                          onChange={(e) => handleChange('externalReferenceName', e.target.value)}
                          placeholder="e.g., John Doe"
                          required={referenceType === 'external'}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="externalReferenceEmail">Email </Label>
                          <Input
                            id="externalReferenceEmail"
                            type="email"
                            value={formData.externalReferenceEmail}
                            onChange={(e) => handleChange('externalReferenceEmail', e.target.value)}
                            placeholder="e.g., john@example.com"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="externalReferencePhone">Phone </Label>
                          <Input
                            id="externalReferencePhone"
                            type="tel"
                            value={formData.externalReferencePhone}
                            onChange={(e) => handleChange('externalReferencePhone', e.target.value)}
                            placeholder="e.g., +91 98765 43210"
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="externalReferenceNotes">Notes </Label>
                        <Textarea
                          id="externalReferenceNotes"
                          value={formData.notes}
                          onChange={(e) => handleChange('notes', e.target.value)}
                          placeholder="Add any additional notes about this reference..."
                          rows={3}
                          className="resize-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ADDITIONAL CONTACTS - NEW DESIGN LIKE EXPENSES */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                  Additional Contacts {savedContacts.length > 0 && `(${savedContacts.length})`}
                </h3>
              </div>

              {/* Saved/Confirmed Contacts */}
              {savedContacts.map((contact, index) => (
                <div
                  key={contact.id || contact.tempId}
                  className="border border-green-200 rounded-lg p-4 bg-green-50 space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Check size={16} className="text-green-600" />
                        <h4 className="text-sm font-medium text-gray-900">
                          Contact #{index + 1} - {contact.name}
                        </h4>
                      </div>
                      <div className="text-sm text-gray-600 ml-6">
                        <p><strong>Email:</strong> {contact.email}</p>
                        <p><strong>Phone:</strong> {contact.number}</p>
                        {contact.designation && <p><strong>Designation:</strong> {contact.designation}</p>}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveSavedContact(contact.id?.toString() || contact.tempId!)}
                      className="text-red-600 hover:text-red-800 hover:bg-red-100"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              ))}

              {/* Current Contact Form (if being added) */}
              {showContactForm && currentContact && (
                <div className="border border-blue-200 rounded-lg p-4 bg-blue-50 space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-900">
                      New Contact
                    </h4>
                  </div>

                  <div className="space-y-2">
                    <Label>
                      Name <span className="text-red-500 -ml-1.5">*</span>
                    </Label>
                    <Input
                      value={currentContact.name}
                      onChange={(e) => handleCurrentContactChange('name', e.target.value)}
                      placeholder="Contact name"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>
                        Email <span className="text-red-500 -ml-1.5">*</span>
                      </Label>
                      <Input
                        type="email"
                        value={currentContact.email}
                        onChange={(e) => handleCurrentContactChange('email', e.target.value)}
                        placeholder="Email address"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>
                        Phone <span className="text-red-500 -ml-1.5">*</span>
                      </Label>
                      <Input
                        type="tel"
                        value={currentContact.number}
                        onChange={(e) => handleCurrentContactChange('number', e.target.value)}
                        placeholder="Phone number"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Designation</Label>
                    <Input
                      value={currentContact.designation}
                      onChange={(e) => handleCurrentContactChange('designation', e.target.value)}
                      placeholder="e.g., Sales Manager"
                    />
                  </div>

                  {/* Save/Cancel Buttons for Current Contact */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSaveCurrentContact}
                      className="flex items-center gap-2"
                    >
                      <Check size={16} />
                      Save Contact
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCancelCurrentContact}
                      className="flex items-center gap-2"
                    >
                      <X size={16} />
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* Add Contact Button (only show when not editing a contact) */}
              {!showContactForm && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddContactClick}
                  className="w-full flex items-center justify-center gap-2"
                >
                  <Plus size={16} />
                  Add Additional Contact
                </Button>
              )}

              {savedContacts.length === 0 && !showContactForm && (
                <p className="text-sm text-gray-500 italic text-center py-2">
                  No additional contacts added yet.
                </p>
              )}
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
            <Button 
              type="submit" 
              disabled={isSubmitting || (showContactForm && currentContact !== null)}
            >
              {isSubmitting 
                ? (mode === 'create' ? 'Creating...' : 'Updating...') 
                : (mode === 'create' ? 'Create Client' : 'Update Client')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}