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
} from "@/components/ui/popover";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { API_ENDPOINTS } from '@/lib/api';
import { toast } from 'react-toastify';
import RateCardDialog from '@/components/invoice/RateCardDialog';
import { convertCurrency, formatAmountWithCurrency, formatCurrency, getCurrencySymbol, type CurrencyCode } from '@/lib/currencyUtils';

interface User {
  user_id: number;
  name: string;
  email: string;
  role?: string;
}

interface Lead {
  userId: number;
  name: string;
  email: string;
  hourlyRate: string;
  isExisting?: boolean;
  serviceTypes?: string[];
  rateRange?: {min: number, max: number} | null;
}

interface ReassignLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matterId: string;
  matterTitle: string;
  currentLeadId?: string;
  billingRateType?: string;
  onSuccess?: () => void;
}

export default function ReassignLeadDialog({
  open,
  onOpenChange,
  matterId,
  matterTitle,
  billingRateType,
  onSuccess,
}: ReassignLeadDialogProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [newLeadUserId, setNewLeadUserId] = useState<string>('');
  const [newLeadServiceType, setNewLeadServiceType] = useState<string>('');
  const [newLeadServiceTypes, setNewLeadServiceTypes] = useState<string[]>([]);
  const [newLeadHourlyRate, setNewLeadHourlyRate] = useState<string>('');
  const [newLeadRateRange, setNewLeadRateRange] = useState<{min: number, max: number} | null>(null);
  const [newLeadConvertedRate, setNewLeadConvertedRate] = useState<number | null>(null);
  const [matterCurrency, setMatterCurrency] = useState<string>('INR');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isLoadingServiceTypes, setIsLoadingServiceTypes] = useState(false);
  const [isLoadingMatterData, setIsLoadingMatterData] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [showRateCardDialog, setShowRateCardDialog] = useState(false);
  const [showAddLeadForm, setShowAddLeadForm] = useState(false);

  // Fetch current matter data to load existing leads
  useEffect(() => {
    const fetchMatterData = async () => {
      if (!open || !matterId) return;

      try {
        setIsLoadingMatterData(true);
        console.log('🔍 Fetching matter data for matterId:', matterId);

        const response = await fetch(API_ENDPOINTS.matters.byId(Number(matterId)), {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch matter data');
        }

        const result = await response.json();

        if (result.success && result.data) {
          const matter = result.data;
          console.log('📦 Matter data:', matter);

          // Set matter currency
          setMatterCurrency(matter.currency || 'INR');

          // Load existing leads
          const existingLeads: Lead[] = [];
          
          if (matter.assignedLeads && Array.isArray(matter.assignedLeads)) {
            matter.assignedLeads.forEach((lead: { userId: number; name: string; email: string; serviceType: string; hourlyRate?: number }) => {
              existingLeads.push({
                userId: lead.userId,
                name: lead.name,
                email: lead.email,
                // serviceType: lead.serviceType || '',
                hourlyRate: lead.hourlyRate?.toString() || '',
                isExisting: true,
              });
            });
          } else if (matter.assignedLawyer?.id) {
            // Fallback to single assigned lawyer
            existingLeads.push({
              userId: matter.assignedLawyer.id,
              name: matter.assignedLawyer.name,
              email: matter.assignedLawyer.email,
              // serviceType: matter.assignedLawyer.serviceType || '',
              hourlyRate: matter.assignedLawyer.hourlyRate?.toString() || '',
              isExisting: true,
            });
          }
          
          setLeads(existingLeads);
          console.log('👥 Loaded leads:', existingLeads);
        }
      } catch (error) {
        console.error('Error fetching matter data:', error);
      } finally {
        setIsLoadingMatterData(false);
      }
    };

    fetchMatterData();
  }, [open, matterId, billingRateType]);

  // Fetch users when dialog opens
  useEffect(() => {
    const fetchUsers = async () => {
      if (!open) return;

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
          const transformedUsers = data.data.map((user: {
            id: number;
            name: string;
            email: string;
            role?: string;
            [key: string]: unknown;
          }) => ({
            user_id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          }));
          
          setUsers(transformedUsers);
        }
      } catch (error) {
        console.error('Error fetching users:', error);
        // alert('Failed to load users. Please try again.');
        toast.error('Failed to load users. Please try again.');
      } finally {
        setIsLoadingUsers(false);
      }
    };

    fetchUsers();
  }, [open]);

  // Fetch service types when new lead user is selected
  useEffect(() => {
    const fetchServiceTypes = async () => {
      if (!newLeadUserId) {
        setNewLeadServiceTypes([]);
        setNewLeadServiceType('');
        setNewLeadHourlyRate('');
        return;
      }

      try {
        setIsLoadingServiceTypes(true);
        console.log('🔍 Fetching service types for user:', newLeadUserId);
        
        const response = await fetch(
          API_ENDPOINTS.rateCards.userServiceTypes(Number(newLeadUserId)),
          {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
          }
        );

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            console.log('✅ Service types:', result.data);
            setNewLeadServiceTypes(result.data);
          } else {
            console.log('⚠️ No service types found');
            setNewLeadServiceTypes([]);
          }
        } else {
          console.log('⚠️ Failed to fetch service types');
          setNewLeadServiceTypes([]);
        }
      } catch (error) {
        console.error('Error fetching service types:', error);
        setNewLeadServiceTypes([]);
      } finally {
        setIsLoadingServiceTypes(false);
      }
    };

    fetchServiceTypes();
  }, [newLeadUserId]);

  // Fetch hourly rate when new lead service type is selected
  useEffect(() => {
    const fetchRate = async () => {
      if (!newLeadUserId || !newLeadServiceType) {
        return;
      }

      // Only fetch if billing type is hourly
      if (billingRateType !== 'hourly') {
        setNewLeadHourlyRate('');
        return;
      }

      try {
        console.log('🔍 Fetching rate for:', {
          user_id: newLeadUserId,
          service_type: newLeadServiceType,
        });

        const response = await fetch(
          API_ENDPOINTS.rateCards.activeByService(
            Number(newLeadUserId),
            newLeadServiceType
          ),
          {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
          }
        );

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            const fetchedRateRange = {
              min: result.data.min_hourly_rate,
              max: result.data.max_hourly_rate
            };
            console.log('✅ Rate range found:', fetchedRateRange);
            setNewLeadRateRange(fetchedRateRange);
          } else {
            console.log('⚠️ No rate found');
            setNewLeadRateRange(null);
          }
        } else {
          console.log('⚠️ Failed to fetch rate');
          setNewLeadRateRange(null);
        }
      } catch (error) {
        console.error('Error fetching rate:', error);
        setNewLeadRateRange(null);
      }
    };

    fetchRate();
  }, [newLeadUserId, newLeadServiceType, billingRateType]);

  // Convert new lead rate from INR to matter currency
  useEffect(() => {
    const convertNewLeadRate = async () => {
      if (!newLeadHourlyRate || !matterCurrency || matterCurrency === 'INR') {
        setNewLeadConvertedRate(null);
        return;
      }

      try {
        const rateInINR = parseFloat(newLeadHourlyRate);
        if (isNaN(rateInINR) || rateInINR <= 0) {
          setNewLeadConvertedRate(null);
          return;
        }

        const converted = await convertCurrency(rateInINR, 'INR', matterCurrency as CurrencyCode);
        setNewLeadConvertedRate(converted);
      } catch (error) {
        console.error('Error converting new lead rate:', error);
        setNewLeadConvertedRate(null);
      }
    };

    convertNewLeadRate();
  }, [newLeadHourlyRate, matterCurrency]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setLeads([]);
      setNewLeadUserId('');
      setNewLeadServiceType('');
      setNewLeadServiceTypes([]);
      setNewLeadHourlyRate('');
      setNewLeadRateRange(null);
      setShowAddLeadForm(false);
    }
  }, [open]);

  const handleOpenRateCardDialog = () => {
    if (!newLeadUserId) {
      toast.error('Please select a user first');
      return;
    }
    setShowRateCardDialog(true);
  };

  const handleRateCardSuccess = async () => {
    if (!newLeadUserId) return;
    
    try {
      console.log('🔄 Refreshing service types for user:', newLeadUserId);
      
      const response = await fetch(
        API_ENDPOINTS.rateCards.userServiceTypes(Number(newLeadUserId)),
        {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          console.log('✅ Refreshed service types:', result.data);
          setNewLeadServiceTypes(result.data);
        }
      }
    } catch (error) {
      console.error('Error refreshing service types:', error);
    }
  };

  const handleAddLead = () => {
    if (!newLeadUserId) {
      toast.error('Please select a user');
      return;
    }

    if (billingRateType === 'hourly' && !newLeadHourlyRate) {
      toast.error('Please enter an hourly rate');
      return;
    }

    // Check if user already exists as lead
    if (leads.some(lead => lead.userId === Number(newLeadUserId))) {
      toast.error('This user is already a lead');
      return;
    }

    const selectedUser = users.find(u => u.user_id === Number(newLeadUserId));
    if (!selectedUser) return;

    const newLead: Lead = {
  userId: Number(newLeadUserId),
  name: selectedUser.name,
  email: selectedUser.email,
  hourlyRate: newLeadHourlyRate,
  isExisting: false,
};

    setLeads([...leads, newLead]);
    
    // Reset form
    setNewLeadUserId('');
    setNewLeadServiceType('');
    setNewLeadServiceTypes([]);
    setNewLeadHourlyRate('');
    setNewLeadRateRange(null);
    setShowAddLeadForm(false);
  };

  const handleRemoveLead = (userId: number) => {
    setLeads(leads.filter(lead => lead.userId !== userId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (leads.length === 0) {
      toast.error('At least one lead is required');
      return;
    }

    setIsSubmitting(true);
    try {
      // Update the matter with assigned_lawyers array
      const assignedLawyersPayload = leads.map(lead => ({
        user_id: lead.userId,
        hourly_rate: billingRateType === 'hourly' && lead.hourlyRate 
          ? parseFloat(lead.hourlyRate) 
          : null,
      }));

      await fetch(API_ENDPOINTS.matters.update(Number(matterId)), {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assigned_lawyer: leads[0].userId,
          // assigned_lawyer_service_type: leads[0].serviceType,
          assigned_lawyer_hourly_rate: billingRateType === 'hourly' && leads[0].hourlyRate 
            ? parseFloat(leads[0].hourlyRate) 
            : null,
          assigned_lawyers: assignedLawyersPayload,
        }),
      });

      toast.success('Matter leads updated successfully!');
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating matter leads:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update matter leads. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoading = isLoadingMatterData || isLoadingUsers;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Matter Leads</DialogTitle>
          <DialogDescription>
            Add or remove leads for &quot;{matterTitle}&quot;
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="py-8 text-center text-gray-500">
            Loading matter data...
          </div>
        )}

        {!isLoading && (
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              {/* Existing Leads */}
              {leads.length > 0 && (
                <div className="space-y-2">
                  <Label>Current Leads</Label>
                  <div className="space-y-2">
                    {leads.map((lead) => (
                      <div key={lead.userId} className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{lead.name}</p>
                          <p className="text-xs text-gray-600">{lead.email}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {billingRateType === 'hourly' && lead.hourlyRate
                              ? `Hourly Rate: ${formatCurrency(Number(lead.hourlyRate), matterCurrency as CurrencyCode)}/hr`
                              : 'No hourly rate'}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveLead(lead.userId)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add Lead Button/Form */}
              {!showAddLeadForm ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddLeadForm(true)}
                  className="w-full"
                >
                  + Add Lead
                </Button>
              ) : (
                <div className="space-y-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <h3 className="font-medium text-sm mb-2">Add New Lead</h3>
                  
                  <div className="space-y-2">
                    <Label>Select User <span className="text-red-500">*</span></Label>
                    <Popover open={userDropdownOpen} onOpenChange={setUserDropdownOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="w-full justify-between"
                          disabled={isLoadingUsers}
                        >
                          {newLeadUserId
                            ? users.find(u => u.user_id === Number(newLeadUserId))?.name || "Select user"
                            : "Select user"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search users..." />
                          <CommandList>
                            <CommandEmpty>No users found.</CommandEmpty>
                            <CommandGroup>
                              {users
                                .filter(user => !leads.some(l => l.userId === user.user_id))
                                .map(user => (
                                  <CommandItem
                                    key={user.user_id}
                                    value={user.name}
                                    onSelect={() => {
                                      setNewLeadUserId(String(user.user_id));
                                      setUserDropdownOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        newLeadUserId === String(user.user_id) ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    <div className="flex flex-col">
                                      <span>{user.name}</span>
                                      {user.email && (
                                        <span className="text-gray-500 text-xs">{user.email}</span>
                                      )}
                                    </div>
                                  </CommandItem>
                                ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* {newLeadUserId && (
                    <div className="space-y-2">
                      <Label>Service Type <span className="text-red-500">*</span></Label>
                      <Select
                        value={newLeadServiceType}
                        onValueChange={setNewLeadServiceType}
                        disabled={isLoadingServiceTypes}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={isLoadingServiceTypes ? "Loading..." : "Select service type"} />
                        </SelectTrigger>
                        <SelectContent>
                          {newLeadServiceTypes.length > 0 ? (
                            newLeadServiceTypes.map((st) => (
                              <SelectItem key={st} value={st}>{st}</SelectItem>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-gray-500 text-sm">
                              {isLoadingServiceTypes ? 'Loading...' : 'No rate cards found'}
                            </div>
                          )}
                          <div className="border-t sticky bottom-0 bg-white">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                handleOpenRateCardDialog();
                              }}
                              className="w-full text-left px-2 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded flex items-center gap-2"
                            >
                              <span className="text-lg">+</span>
                              Create New Rate Card
                            </button>
                          </div>
                        </SelectContent>
                      </Select>
                    </div>
                  )} */}

                  {newLeadUserId && billingRateType === 'hourly' && (
                    <div className="space-y-2">
                      <Label>
                        Hourly Rate ({getCurrencySymbol(matterCurrency as CurrencyCode)})
                        {newLeadRateRange && (
                          <span className="text-xs text-gray-500 ml-1">
                            (Current Range: 
                              {formatCurrency(newLeadRateRange.min, matterCurrency as CurrencyCode)} - 
                              {formatCurrency(newLeadRateRange.max, matterCurrency as CurrencyCode)}
                            )
                          </span>
                        )}
                      </Label>

                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={newLeadHourlyRate}
                        onChange={(e) => setNewLeadHourlyRate(e.target.value)}
                        placeholder="Enter hourly rate"
                      />

                      {/* ✅ DYNAMIC HINT */}
                      {newLeadHourlyRate && !isNaN(Number(newLeadHourlyRate)) && (
                        <p className="text-xs text-gray-500 mt-1">
                          Min will be stored as{" "}
                          <strong>
                            {formatCurrency(Number(newLeadHourlyRate) * 0.5, matterCurrency as CurrencyCode)}
                          </strong>{" "}
                          and Max will be stored as{" "}
                          <strong>
                            {formatCurrency(Number(newLeadHourlyRate) * 1.5, matterCurrency as CurrencyCode)}
                          </strong>
                        </p>
                      )}
                    </div>
                  )}



                  <div className="flex gap-2 pt-2">
                    <Button type="button" onClick={handleAddLead} size="sm">
                      Add Lead
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowAddLeadForm(false);
                        setNewLeadUserId('');
                        setNewLeadServiceType('');
                        setNewLeadHourlyRate('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
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
                disabled={isSubmitting || leads.length === 0}
              >
                {isSubmitting ? 'Saving...' : 'Save Leads'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>

      <RateCardDialog
        open={showRateCardDialog}
        onOpenChange={setShowRateCardDialog}
        mode="create"
        onSuccess={() => {
          handleRateCardSuccess();
          setShowRateCardDialog(false);
        }}
      />
    </Dialog>
  );
}