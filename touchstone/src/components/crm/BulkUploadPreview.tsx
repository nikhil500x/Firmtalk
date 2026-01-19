'use client';

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
import { Badge } from '@/components/ui/badge';
import { Pencil, Save, X, CheckCircle, AlertCircle, AlertTriangle, Plus, Loader2, Trash2, Download } from 'lucide-react';
import { API_ENDPOINTS } from '@/lib/api';
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
import { toast } from 'react-toastify';

interface PreviewData {
  groups: Array<{
    name: string;
    description?: string;
    exists: boolean;
    existingId?: number;
  }>;
  clients: Array<{
    name: string;
    industry?: string;
    website?: string;
    address?: string;
    code?: string;
    notes?: string;
    tspContact?: string;
    tspContactUsers?: Array<{
      id: number;
      name: string;
      email: string;
    }>;
    groupName: string;
    exists: boolean;
    existingId?: number;
  }>;
  contacts: Array<{
    name: string;
    email: string;
    phone: string;
    designation?: string;
    isPrimary: boolean;
    notes?: string;
    linkedinUrl?: string;
    twitterHandle?: string;
    clientName: string;
    groupName: string;
    rowNumber: number;
  }>;
  errors: Array<{ row: number; field: string; message: string }>;
  warnings: Array<{ row: number; message: string }>;
}

interface BulkUploadPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previewData: PreviewData;
  onConfirm: (updatedData: PreviewData) => void;
}

export default function BulkUploadPreview({
  open,
  onOpenChange,
  previewData: initialPreviewData,
  onConfirm,
}: BulkUploadPreviewProps) {
  const [previewData, setPreviewData] = useState<PreviewData>(initialPreviewData);
  const [editingContact, setEditingContact] = useState<number | null>(null);
  const [editingClient, setEditingClient] = useState<number | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [activeTab, setActiveTab] = useState<'groups' | 'clients' | 'contacts'>('groups');
  const [allUsers, setAllUsers] = useState<Array<{ id: number; name: string; email: string }>>([]);
  const [tspContactPopoverOpen, setTspContactPopoverOpen] = useState<{ [key: number]: boolean }>({});

  // Fetch all users on mount
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch(API_ENDPOINTS.users.list, {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            setAllUsers(data.data.map((u: { id: number; name: string; email: string }) => ({
              id: u.id,
              name: u.name,
              email: u.email,
            })));
          }
        }
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };
    if (open) {
      fetchUsers();
    }
  }, [open]);

  // Clean up orphaned errors (errors for rows that no longer have contacts)
  // This runs when contacts change to remove errors for deleted rows
  useEffect(() => {
    setPreviewData((prev) => {
      // Get all valid row numbers from existing contacts
      const validRowNumbers = new Set(prev.contacts.map(c => c.rowNumber));
      
      // Filter out errors for rows that don't have contacts anymore
      const cleanedErrors = prev.errors.filter(e => validRowNumbers.has(e.row));
      
      // Only update if there are orphaned errors to clean up
      if (cleanedErrors.length < prev.errors.length) {
        return {
          ...prev,
          errors: cleanedErrors,
        };
      }
      return prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewData.contacts.length]);

  // Group contacts by client for display
  const contactsByClient = new Map<string, typeof previewData.contacts>();
  previewData.contacts.forEach((contact) => {
    const key = `${contact.groupName}|||${contact.clientName}`;
    if (!contactsByClient.has(key)) {
      contactsByClient.set(key, []);
    }
    contactsByClient.get(key)!.push(contact);
  });

  // Validation helper functions (matching backend logic)
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return emailRegex.test(email) && email.length <= 255;
  };

  const isValidPhone = (phone: string): boolean => {
    if (!phone) return false;
    const phoneRegex = /^[\d\s\+\-\(\)\.]+$/;
    const cleaned = phone.replace(/\s/g, '');
    return phoneRegex.test(phone) && cleaned.length >= 7 && cleaned.length <= 20;
  };

  const isValidUrl = (url: string): boolean => {
    if (!url) return false;
    try {
      let urlToCheck = url;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        urlToCheck = `https://${url}`;
      }
      new URL(urlToCheck);
      return url.length <= 500;
    } catch {
      return false;
    }
  };

  // Get errors/warnings for a specific contact
  const getContactIssues = (rowNumber: number) => {
    const errors = previewData.errors.filter(e => e.row === rowNumber);
    const warnings = previewData.warnings.filter(w => w.row === rowNumber);
    return { errors, warnings };
  };

  // Check if a specific field has an error for a given row
  const hasFieldError = (rowNumber: number, fieldName: string): boolean => {
    return previewData.errors.some(e => e.row === rowNumber && e.field === fieldName);
  };

  const handleContactEdit = (index: number) => {
    setEditingContact(index);
  };

  const handleContactSave = (index: number) => {
    const contact = previewData.contacts[index];
    const rowNumber = contact.rowNumber;
    
    // Validate contact fields and update errors
    setPreviewData((prev) => {
      const updatedErrors = [...prev.errors];
      
      // Remove all errors for this contact's row
      const filteredErrors = updatedErrors.filter(e => e.row !== rowNumber);
      
      // Check if contact has any data (name, email, or phone)
      const hasContactData = !!(contact.name?.trim() || contact.email?.trim() || contact.phone?.trim());
      
      if (hasContactData) {
        // Contact name is required if contact data is present
        if (!contact.name || !contact.name.trim()) {
          filteredErrors.push({
            row: rowNumber,
            field: 'Contact Name',
            message: 'Contact name is required when contact data is present'
          });
        } else if (contact.name.length > 255) {
          filteredErrors.push({
            row: rowNumber,
            field: 'Contact Name',
            message: 'Contact name exceeds maximum length of 255 characters'
          });
        }
        
        // Email is optional, but validate format if provided
        if (contact.email && contact.email.trim()) {
          if (!isValidEmail(contact.email)) {
            filteredErrors.push({
              row: rowNumber,
              field: 'Contact Email',
              message: 'Invalid email format'
            });
          }
        }
        
        // Phone is optional, but validate format if provided
        if (contact.phone && contact.phone.trim()) {
          if (!isValidPhone(contact.phone)) {
            filteredErrors.push({
              row: rowNumber,
              field: 'Contact Phone',
              message: 'Invalid phone number format'
            });
          }
        }
      }
      
      return {
        ...prev,
        errors: filteredErrors,
      };
    });
    
    setEditingContact(null);
  };

  const handleContactCancel = (index: number) => {
    setEditingContact(null);
    // Reset this contact to original data
    setPreviewData((prev) => {
      const updatedContacts = [...prev.contacts];
      updatedContacts[index] = initialPreviewData.contacts[index];
      return {
        ...prev,
        contacts: updatedContacts,
      };
    });
  };

  const handleContactFieldChange = (
    contactIndex: number,
    field: keyof PreviewData['contacts'][0],
    value: string | boolean
  ) => {
    setPreviewData((prev) => {
      const updatedContacts = [...prev.contacts];
      updatedContacts[contactIndex] = {
        ...updatedContacts[contactIndex],
        [field]: value,
      };
      return {
        ...prev,
        contacts: updatedContacts,
      };
    });
  };

  const handleClientEdit = (index: number) => {
    setEditingClient(index);
  };

  const handleClientSave = (index: number) => {
    const client = previewData.clients[index];
    
    // Find all contacts for this client to get their row numbers
    const contactsForClient = previewData.contacts.filter(
      c => c.groupName === client.groupName && c.clientName === client.name
    );
    const rowNumbers = contactsForClient.map(c => c.rowNumber);
    
    // Validate client fields and update errors
    setPreviewData((prev) => {
      const updatedErrors = [...prev.errors];
      
      // Remove client-related errors for all contacts of this client
      // Client errors have field names like "Client Name", "Client Industry", "Client Website", "Client Code"
      const filteredErrors = updatedErrors.filter(e => {
        // If error is for a row that belongs to this client, check if it's a client field error
        if (rowNumbers.includes(e.row)) {
          const clientFieldNames = ['Client Name', 'Client Industry', 'Client Website', 'Client Code'];
          // Remove client field errors for this client's rows
          return !clientFieldNames.includes(e.field);
        }
        // Keep all other errors
        return true;
      });
      
      // Validate client fields and add errors to the first contact row (if any)
      const firstRowNumber = rowNumbers.length > 0 ? rowNumbers[0] : 0;
      
      // Validate client name
      if (!client.name || !client.name.trim()) {
        if (firstRowNumber > 0) {
          filteredErrors.push({
            row: firstRowNumber,
            field: 'Client Name',
            message: 'Client name is required'
          });
        }
      } else if (client.name.length > 255) {
        if (firstRowNumber > 0) {
          filteredErrors.push({
            row: firstRowNumber,
            field: 'Client Name',
            message: 'Client name exceeds maximum length of 255 characters'
          });
        }
      }
      
      // Validate client industry (required)
      if (!client.industry || !client.industry.trim()) {
        if (firstRowNumber > 0) {
          filteredErrors.push({
            row: firstRowNumber,
            field: 'Client Industry',
            message: 'Client industry is required'
          });
        }
      }
      
      // Validate website URL if provided
      if (client.website && client.website.trim()) {
        if (!isValidUrl(client.website)) {
          if (firstRowNumber > 0) {
            filteredErrors.push({
              row: firstRowNumber,
              field: 'Client Website',
              message: 'Invalid website URL format'
            });
          }
        }
      }
      
      return {
        ...prev,
        errors: filteredErrors,
      };
    });
    
    setEditingClient(null);
  };

  const handleClientFieldChange = (
    clientIndex: number,
    field: keyof PreviewData['clients'][0],
    value: string
  ) => {
    setPreviewData((prev) => {
      const updatedClients = [...prev.clients];
      updatedClients[clientIndex] = {
        ...updatedClients[clientIndex],
        [field]: value,
      };
      return {
        ...prev,
        clients: updatedClients,
      };
    });
  };

  const handleAddTSPContact = (clientIndex: number, userId: number) => {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;

    setPreviewData((prev) => {
      const updatedClients = [...prev.clients];
      const client = updatedClients[clientIndex];
      const existingUsers = client.tspContactUsers || [];
      
      // Check if user already exists
      if (existingUsers.some(u => u.id === userId)) {
        return prev;
      }

      // Add new user
      const newUsers = [...existingUsers, user];
      const tspContactIds = newUsers.map(u => u.id).join('/');
      
      updatedClients[clientIndex] = {
        ...client,
        tspContactUsers: newUsers,
        tspContact: tspContactIds,
      };
      
      return {
        ...prev,
        clients: updatedClients,
      };
    });
    
    setTspContactPopoverOpen({ ...tspContactPopoverOpen, [clientIndex]: false });
  };

  const handleRemoveTSPContact = (clientIndex: number, userId: number) => {
    setPreviewData((prev) => {
      const updatedClients = [...prev.clients];
      const client = updatedClients[clientIndex];
      const existingUsers = client.tspContactUsers || [];
      
      const newUsers = existingUsers.filter(u => u.id !== userId);
      const tspContactIds = newUsers.length > 0 ? newUsers.map(u => u.id).join('/') : undefined;
      
      updatedClients[clientIndex] = {
        ...client,
        tspContactUsers: newUsers.length > 0 ? newUsers : undefined,
        tspContact: tspContactIds,
      };
      
      return {
        ...prev,
        clients: updatedClients,
      };
    });
  };

  const handleRemoveContact = (index: number) => {
    const contact = previewData.contacts[index];
    const rowNumber = contact.rowNumber;
    
    setPreviewData((prev) => {
      // Remove the contact
      const updatedContacts = prev.contacts.filter((_, idx) => idx !== index);
      
      // Remove all errors and warnings for this row
      const updatedErrors = prev.errors.filter(e => e.row !== rowNumber);
      const updatedWarnings = prev.warnings.filter(w => w.row !== rowNumber);
      
      return {
        ...prev,
        contacts: updatedContacts,
        errors: updatedErrors,
        warnings: updatedWarnings,
      };
    });
  };

  const handleRemoveClient = (index: number) => {
    const client = previewData.clients[index];
    
    setPreviewData((prev) => {
      // Remove the client
      const updatedClients = prev.clients.filter((_, idx) => idx !== index);
      
      // Find all contacts for this client and remove them
      const contactsToRemove = prev.contacts.filter(
        c => c.groupName === client.groupName && c.clientName === client.name
      );
      const rowNumbersToRemove = contactsToRemove.map(c => c.rowNumber);
      const updatedContacts = prev.contacts.filter(
        c => !(c.groupName === client.groupName && c.clientName === client.name)
      );
      
      // Remove all errors and warnings for these rows
      const updatedErrors = prev.errors.filter(e => !rowNumbersToRemove.includes(e.row));
      const updatedWarnings = prev.warnings.filter(w => !rowNumbersToRemove.includes(w.row));
      
      return {
        ...prev,
        clients: updatedClients,
        contacts: updatedContacts,
        errors: updatedErrors,
        warnings: updatedWarnings,
      };
    });
  };

  const handleDownloadCorrected = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.clients.bulkUpload.downloadPreview, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(previewData),
      });

      if (!response.ok) {
        throw new Error('Failed to download corrected file');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bulk_upload_corrected_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: unknown) {
      console.error('Download error:', error);
      toast.error('Failed to download corrected file. Please try again.');
    }
  };

  const handleConfirm = async () => {
    // Clean up any orphaned errors before checking
    const validRowNumbers = new Set(previewData.contacts.map(c => c.rowNumber));
    const activeErrors = previewData.errors.filter(e => validRowNumbers.has(e.row));
    
    if (activeErrors.length > 0) {
      console.warn('Cannot proceed - errors still present:', activeErrors);
      // Update state to remove orphaned errors
      setPreviewData(prev => ({
        ...prev,
        errors: activeErrors,
      }));
      return; // Should be disabled, but double-check
    }

    setIsConfirming(true);

    try {
      // Call the parent's confirm handler with cleaned data
      const cleanedData = {
        ...previewData,
        errors: activeErrors,
      };
      onConfirm(cleanedData);
    } catch (error) {
      setIsConfirming(false);
    }
  };

  const hasErrors = previewData.errors.length > 0;
  const summary = {
    groups: previewData.groups.length,
    groupsNew: previewData.groups.filter(g => !g.exists).length,
    groupsExisting: previewData.groups.filter(g => g.exists).length,
    clients: previewData.clients.length,
    clientsNew: previewData.clients.filter(c => !c.exists).length,
    clientsExisting: previewData.clients.filter(c => c.exists).length,
    contacts: previewData.contacts.length,
    errors: previewData.errors.length,
    warnings: previewData.warnings.length,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[90vw] max-w-[1400px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Preview Bulk Upload</DialogTitle>
          <DialogDescription>
            Review the data before creating records. You can edit fields inline. Errors must be fixed before confirming.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Summary Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm text-gray-600">Groups</p>
              <p className="text-2xl font-bold">{summary.groups}</p>
              <p className="text-xs text-gray-500">
                {summary.groupsNew} new, {summary.groupsExisting} existing
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Clients</p>
              <p className="text-2xl font-bold">{summary.clients}</p>
              <p className="text-xs text-gray-500">
                {summary.clientsNew} new, {summary.clientsExisting} existing
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Contacts</p>
              <p className="text-2xl font-bold">{summary.contacts}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Issues</p>
              <p className="text-2xl font-bold text-red-600">{summary.errors}</p>
              <p className="text-xs text-gray-500">{summary.warnings} warnings</p>
            </div>
          </div>

          {/* Errors Section */}
          {previewData.errors.length > 0 && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <h3 className="text-sm font-semibold text-red-900 mb-2 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Validation Errors ({previewData.errors.length})
              </h3>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {previewData.errors.map((error, idx) => (
                  <p key={idx} className="text-xs text-red-800">
                    Row {error.row}: {error.field} - {error.message}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Warnings Section */}
          {previewData.warnings.length > 0 && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h3 className="text-sm font-semibold text-yellow-900 mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Warnings ({previewData.warnings.length})
              </h3>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {previewData.warnings.map((warning, idx) => (
                  <p key={idx} className="text-xs text-yellow-800">
                    {warning.row > 0 ? `Row ${warning.row}: ` : ''}{warning.message}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Tabs Navigation */}
          <div className="flex items-center gap-0 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('groups')}
              className={`px-4 py-2.5 text-sm font-semibold transition-colors ${
                activeTab === 'groups'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Groups ({summary.groups})
            </button>
            <button
              onClick={() => setActiveTab('clients')}
              className={`px-4 py-2.5 text-sm font-semibold transition-colors ${
                activeTab === 'clients'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Clients ({summary.clients})
            </button>
            <button
              onClick={() => setActiveTab('contacts')}
              className={`px-4 py-2.5 text-sm font-semibold transition-colors ${
                activeTab === 'contacts'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Contacts ({summary.contacts})
            </button>
          </div>

          {/* Tab Content */}
          <div className="min-h-[400px] max-h-[60vh] overflow-y-auto">
            {activeTab === 'groups' && (
              <div>
                <div className="space-y-2">
                  {previewData.groups.map((group, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-white border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{group.name}</span>
                        {group.exists ? (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700">
                            Exists
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-green-50 text-green-700">
                            New
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'clients' && (
              <div>
                <div className="space-y-2">
                  {previewData.clients.map((client, idx) => {
                const isEditing = editingClient === idx;
                // Find all contacts for this client to get row numbers for error checking
                const contactsForClient = previewData.contacts.filter(
                  c => c.groupName === client.groupName && c.clientName === client.name
                );
                const rowNumbers = contactsForClient.map(c => c.rowNumber);
                const firstRowNumber = rowNumbers.length > 0 ? rowNumbers[0] : 0;
                const clientNameHasError = hasFieldError(firstRowNumber, 'Client Name');
                const clientIndustryHasError = hasFieldError(firstRowNumber, 'Client Industry');
                const clientWebsiteHasError = hasFieldError(firstRowNumber, 'Client Website');
                // Check if client has any errors
                const clientErrors = previewData.errors.filter(e => 
                  rowNumbers.includes(e.row) && 
                  ['Client Name', 'Client Industry', 'Client Website', 'Client Code'].includes(e.field)
                );
                return (
                  <div
                    key={idx}
                    className="p-3 bg-white border rounded-lg"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-sm">Group: {client.groupName}</span>
                          {client.exists ? (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 text-xs">
                              Exists
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-green-50 text-green-700 text-xs">
                              New
                            </Badge>
                          )}
                        </div>
                        {isEditing ? (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs text-gray-600">Client Name</label>
                              <Input
                                value={client.name}
                                onChange={(e) => handleClientFieldChange(idx, 'name', e.target.value)}
                                className={`h-8 text-sm ${clientNameHasError ? 'border-red-500 bg-red-50' : ''}`}
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-600">Industry</label>
                              <Input
                                value={client.industry || ''}
                                onChange={(e) => handleClientFieldChange(idx, 'industry', e.target.value)}
                                className={`h-8 text-sm ${clientIndustryHasError ? 'border-red-500 bg-red-50' : ''}`}
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-600">Website</label>
                              <Input
                                value={client.website || ''}
                                onChange={(e) => handleClientFieldChange(idx, 'website', e.target.value)}
                                className={`h-8 text-sm ${clientWebsiteHasError ? 'border-red-500 bg-red-50' : ''}`}
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-600">Address</label>
                              <Input
                                value={client.address || ''}
                                onChange={(e) => handleClientFieldChange(idx, 'address', e.target.value)}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-600">Client Code</label>
                              <Input
                                value={client.code || ''}
                                onChange={(e) => handleClientFieldChange(idx, 'code', e.target.value)}
                                className="h-8 text-sm"
                              />
                            </div>
                            {/* TSP Contact Section in Edit Mode */}
                            <div className="col-span-2 mt-2 pt-2 border-t border-gray-200">
                              <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-semibold text-gray-600">TSP Contact:</label>
                                <Popover
                                  open={tspContactPopoverOpen[idx] || false}
                                  onOpenChange={(open) => setTspContactPopoverOpen({ ...tspContactPopoverOpen, [idx]: open })}
                                >
                                  <PopoverTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 text-xs"
                                    >
                                      <Plus className="h-3 w-3 mr-1" />
                                      Add Partner
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-64 p-0" align="end">
                                    <Command>
                                      <CommandInput placeholder="Search users..." />
                                      <CommandList>
                                        <CommandEmpty>No users found.</CommandEmpty>
                                        <CommandGroup>
                                          {allUsers
                                            .filter(u => !client.tspContactUsers?.some(tu => tu.id === u.id))
                                            .map((user) => (
                                              <CommandItem
                                                key={user.id}
                                                onSelect={() => handleAddTSPContact(idx, user.id)}
                                                className="cursor-pointer"
                                              >
                                                <div className="flex flex-col">
                                                  <span className="text-sm font-medium">{user.name}</span>
                                                  <span className="text-xs text-gray-500">ID: {user.id} • {user.email}</span>
                                                </div>
                                              </CommandItem>
                                            ))}
                                        </CommandGroup>
                                      </CommandList>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                              </div>
                              {client.tspContactUsers && client.tspContactUsers.length > 0 ? (
                                <div className="space-y-1">
                                  {client.tspContactUsers.map((user) => (
                                    <div
                                      key={user.id}
                                      className="flex items-center justify-between bg-blue-50 px-2 py-1 rounded text-xs"
                                    >
                                      <div>
                                        <span className="font-medium text-gray-900">{user.name}</span>
                                        <span className="text-gray-500 ml-2">(ID: {user.id})</span>
                                        <span className="text-gray-500 ml-2">• {user.email}</span>
                                      </div>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-5 w-5 p-0 hover:bg-red-100"
                                        onClick={() => handleRemoveTSPContact(idx, user.id)}
                                      >
                                        <X className="h-3 w-3 text-red-600" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-gray-500 italic">No TSP Contacts added</p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-700 space-y-1">
                            <p><strong>Client:</strong> {client.name}</p>
                            {client.industry && <p><strong>Industry:</strong> {client.industry}</p>}
                            {client.website && <p><strong>Website:</strong> {client.website}</p>}
                            {client.address && <p><strong>Address:</strong> {client.address}</p>}
                            {client.code && <p><strong>Code:</strong> {client.code}</p>}
                            {/* TSP Contact Section */}
                            <div className="mt-2 pt-2 border-t border-gray-200">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-xs font-semibold text-gray-600">TSP Contact:</p>
                                <Popover
                                  open={tspContactPopoverOpen[idx] || false}
                                  onOpenChange={(open) => setTspContactPopoverOpen({ ...tspContactPopoverOpen, [idx]: open })}
                                >
                                  <PopoverTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 text-xs"
                                    >
                                      <Plus className="h-3 w-3 mr-1" />
                                      Add
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-64 p-0" align="end">
                                    <Command>
                                      <CommandInput placeholder="Search users..." />
                                      <CommandList>
                                        <CommandEmpty>No users found.</CommandEmpty>
                                        <CommandGroup>
                                          {allUsers
                                            .filter(u => !client.tspContactUsers?.some(tu => tu.id === u.id))
                                            .map((user) => (
                                              <CommandItem
                                                key={user.id}
                                                onSelect={() => handleAddTSPContact(idx, user.id)}
                                                className="cursor-pointer"
                                              >
                                                <div className="flex flex-col">
                                                  <span className="text-sm font-medium">{user.name}</span>
                                                  <span className="text-xs text-gray-500">ID: {user.id} • {user.email}</span>
                                                </div>
                                              </CommandItem>
                                            ))}
                                        </CommandGroup>
                                      </CommandList>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                              </div>
                              {client.tspContactUsers && client.tspContactUsers.length > 0 ? (
                                <div className="space-y-1">
                                  {client.tspContactUsers.map((user) => (
                                    <div
                                      key={user.id}
                                      className="flex items-center justify-between bg-blue-50 px-2 py-1 rounded text-xs"
                                    >
                                      <div>
                                        <span className="font-medium text-gray-900">{user.name}</span>
                                        <span className="text-gray-500 ml-2">(ID: {user.id})</span>
                                        <span className="text-gray-500 ml-2">• {user.email}</span>
                                      </div>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-5 w-5 p-0 hover:bg-red-100"
                                        onClick={() => handleRemoveTSPContact(idx, user.id)}
                                      >
                                        <X className="h-3 w-3 text-red-600" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-gray-500 italic">No TSP Contacts added</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      {!isEditing ? (
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleClientEdit(idx)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveClient(idx)}
                            className="hover:bg-red-100"
                            title="Remove this client and all its contacts"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleClientSave(idx)}
                          >
                            <Save className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingClient(null);
                              // Reset this client to original data
                              setPreviewData((prev) => {
                                const updatedClients = [...prev.clients];
                                updatedClients[idx] = initialPreviewData.clients[idx];
                                return {
                                  ...prev,
                                  clients: updatedClients,
                                };
                              });
                            }}
                          >
                            <X className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
                </div>
              </div>
            )}

            {activeTab === 'contacts' && (
              <div>
                <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Row</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Group</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Client</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Name</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Email</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Phone</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Designation</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Primary</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.contacts.map((contact, idx) => {
                    const isEditing = editingContact === idx;
                    const { errors: contactErrors } = getContactIssues(contact.rowNumber);
                    const nameHasError = hasFieldError(contact.rowNumber, 'Contact Name');
                    const emailHasError = hasFieldError(contact.rowNumber, 'Contact Email');
                    const phoneHasError = hasFieldError(contact.rowNumber, 'Contact Phone');
                    return (
                      <tr
                        key={idx}
                        className="border-b"
                      >
                        <td className="px-3 py-2 text-xs text-gray-600">{contact.rowNumber}</td>
                        <td className="px-3 py-2 text-xs text-gray-600">{contact.groupName}</td>
                        <td className="px-3 py-2 text-xs text-gray-600">{contact.clientName}</td>
                        <td className={`px-3 py-2 ${nameHasError ? 'bg-red-100' : ''}`}>
                          {isEditing ? (
                            <Input
                              value={contact.name}
                              onChange={(e) => handleContactFieldChange(idx, 'name', e.target.value)}
                              className={`h-7 text-xs ${nameHasError ? 'border-red-500' : ''}`}
                            />
                          ) : (
                            <span className="text-xs">{contact.name}</span>
                          )}
                        </td>
                        <td className={`px-3 py-2 ${emailHasError ? 'bg-red-100' : ''}`}>
                          {isEditing ? (
                            <Input
                              value={contact.email}
                              onChange={(e) => handleContactFieldChange(idx, 'email', e.target.value)}
                              className={`h-7 text-xs ${emailHasError ? 'border-red-500' : ''}`}
                            />
                          ) : (
                            <span className="text-xs">{contact.email}</span>
                          )}
                        </td>
                        <td className={`px-3 py-2 ${phoneHasError ? 'bg-red-100' : ''}`}>
                          {isEditing ? (
                            <Input
                              value={contact.phone}
                              onChange={(e) => handleContactFieldChange(idx, 'phone', e.target.value)}
                              className={`h-7 text-xs ${phoneHasError ? 'border-red-500' : ''}`}
                            />
                          ) : (
                            <span className="text-xs">{contact.phone}</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {isEditing ? (
                            <Input
                              value={contact.designation || ''}
                              onChange={(e) => handleContactFieldChange(idx, 'designation', e.target.value)}
                              className="h-7 text-xs"
                            />
                          ) : (
                            <span className="text-xs">{contact.designation || '-'}</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {isEditing ? (
                            <select
                              value={contact.isPrimary ? 'Y' : 'N'}
                              onChange={(e) => handleContactFieldChange(idx, 'isPrimary', e.target.value === 'Y')}
                              className="h-7 text-xs border rounded px-2"
                            >
                              <option value="Y">Y</option>
                              <option value="N">N</option>
                            </select>
                          ) : (
                            <Badge
                              variant={contact.isPrimary ? 'default' : 'outline'}
                              className={contact.isPrimary ? 'bg-blue-600' : ''}
                            >
                              {contact.isPrimary ? 'Primary' : 'Secondary'}
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {isEditing ? (
                            <div className="flex gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleContactSave(idx)}
                                className="h-7 w-7 p-0"
                              >
                                <Save className="h-3 w-3 text-green-600" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleContactCancel(idx)}
                                className="h-7 w-7 p-0"
                              >
                                <X className="h-3 w-3 text-red-600" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleContactEdit(idx)}
                                className="h-7 w-7 p-0"
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveContact(idx)}
                                className="h-7 w-7 p-0 hover:bg-red-100"
                                title="Remove this contact"
                              >
                                <Trash2 className="h-3 w-3 text-red-600" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex flex-col gap-3">
          <div className="flex gap-2 w-full justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={handleDownloadCorrected}
              className="flex items-center gap-2"
              title="Download corrected Excel file with all your changes"
            >
              <Download className="h-4 w-4" />
              Download Corrected File
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isConfirming}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleConfirm}
                disabled={hasErrors || isConfirming}
                title={hasErrors ? `Cannot proceed: ${previewData.errors.length} error(s) remaining. Please fix all errors before uploading.` : 'Confirm and create all records'}
              >
                {isConfirming ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating records...
                  </>
                ) : hasErrors ? (
                  `Fix ${previewData.errors.length} Error${previewData.errors.length > 1 ? 's' : ''} First`
                ) : (
                  'Confirm & Create Records'
                )}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

