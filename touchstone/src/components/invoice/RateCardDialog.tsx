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
  PopoverContent
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ChevronsUpDown } from "lucide-react";

import { API_ENDPOINTS } from '@/lib/api';
import { formatRoleDisplay } from '@/utils/roleDisplay';
import { toast } from 'react-toastify';

interface RateCardDialogProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  mode: 'create' | 'edit';
  rateCardId?: number;
  onSuccess?: () => void;
  allowEmptyRates?: boolean; // NEW: Allow creating rate cards without min/max rates
  prefilledUserId?: number; // NEW: Pre-fill user ID and disable selection
}

interface User {
  user_id?: number;
  id?: number;
  name: string;
  email: string;
  role: string;
}

const initialFormData = {
  user_id: '',
  service_type: '',
  min_hourly_rate: '',
  max_hourly_rate: '',
  effective_date: '',
  end_date: '',
  is_active: true,
};

export default function RateCardDialog({
  open,
  onOpenChange,
  mode,
  rateCardId,
  onSuccess,
  allowEmptyRates = false,
  prefilledUserId,
}: RateCardDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [formData, setFormData] = useState(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedUserName, setSelectedUserName] = useState<string>('');
  const [hasActiveRateCard, setHasActiveRateCard] = useState(false);
  const [userComboboxOpen, setUserComboboxOpen] = useState(false);
  const [isEmptyRateCard, setIsEmptyRateCard] = useState(false);


  // Check if there's an active rate card for this user and service type
  const checkActiveRateCard = async (userId: string, serviceType: string, excludeCurrentCard: boolean = false) => {
    if (!userId || !serviceType) {
      setHasActiveRateCard(false);
      return false;
    }

    try {
      const encodedServiceType = encodeURIComponent(serviceType);
      const response = await fetch(
        `${API_ENDPOINTS.rateCards.list}?user_id=${userId}&service_type=${encodedServiceType}&is_active=true`,
        {
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to check active rate cards');
      }

      const data = await response.json();
      const activeCards = data.data || [];
      
      // If we're in edit mode and should exclude current card
      const otherActiveCards = excludeCurrentCard && rateCardId
        ? activeCards.filter((card: { ratecard_id?: number }) => card.ratecard_id !== rateCardId)
        : activeCards;
      
      const hasActive = otherActiveCards.length > 0;
      setHasActiveRateCard(hasActive);
      
      // In create mode, if there's an active card, force the new one to be inactive
      if (mode === 'create' && hasActive) {
        setFormData((prev) => ({
          ...prev,
          is_active: false,
          end_date: new Date().toISOString().split('T')[0],
        }));
      }
      
      return hasActive;
    } catch (error) {
      console.error('Error checking active rate cards:', error);
      setHasActiveRateCard(false);
      return false;
    }
  };

  // Fetch rate card data when editing
  useEffect(() => {
    const fetchRateCard = async () => {
      if (!open || mode !== 'edit' || !rateCardId) return;

      try {
        const response = await fetch(API_ENDPOINTS.rateCards.byId(rateCardId), {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to fetch rate card');
        }

        const data = await response.json();
        
        if (data.success && data.data) {
          const rateCard = data.data;
          
          // ✅ Detect if this is an empty rate card
          const isEmpty = rateCard.min_hourly_rate === null || rateCard.max_hourly_rate === null;
          setIsEmptyRateCard(isEmpty);
          
          setFormData({
            user_id: rateCard.user_id?.toString() || '',
            service_type: rateCard.service_type || '',
            min_hourly_rate: rateCard.min_hourly_rate?.toString() || '',
            max_hourly_rate: rateCard.max_hourly_rate?.toString() || '',
            effective_date: rateCard.effective_date
              ? new Date(rateCard.effective_date).toISOString().split('T')[0]
              : '',
            end_date: rateCard.end_date
              ? new Date(rateCard.end_date).toISOString().split('T')[0]
              : '',
            is_active: rateCard.is_active ?? true,
          });
          
          // Store the user name for display in edit mode
          if (rateCard.user && rateCard.user.name) {
            setSelectedUserName(rateCard.user.name);
          }
          
          // Check if there's already an active rate card for this user/service
          // Exclude the current card from the check
          await checkActiveRateCard(rateCard.user_id?.toString(), rateCard.service_type, true);
        }
      } catch (error) {
        console.error('Error fetching rate card:', error);
        // alert('Failed to load rate card data');
        toast.error('Failed to load rate card data');
      }
    };

    fetchRateCard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, rateCardId]);

  // ✅ NEW: Handle prefilled user ID
  useEffect(() => {
    if (open && mode === 'create' && prefilledUserId) {
      setFormData(prev => ({
        ...prev,
        user_id: prefilledUserId.toString(),
      }));
      
      // Fetch and set the user name
      const fetchUserName = async () => {
        try {
          const user = users.find(u => (u.user_id || u.id) === prefilledUserId);
          if (user) {
            setSelectedUserName(user.name);
          }
        } catch (error) {
          console.error('Error fetching user name:', error);
        }
      };
      
      if (users.length > 0) {
        fetchUserName();
      }
    }
  }, [open, mode, prefilledUserId, users]);

  // Fetch users when dialog opens (only in create mode)
  useEffect(() => {
    const fetchUsers = async () => {
      if (!open || mode !== 'create') return;

      try {
        const response = await fetch(API_ENDPOINTS.users.list, {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to fetch users');
        }

        const data = await response.json();
        console.log('Users data from API:', data);
        
        // Handle both data.data and data.users formats
        const usersList = data.data || data.users || [];
        console.log('Processed users list:', usersList);
        
        setUsers(usersList);
      } catch (error) {
        console.error('Error fetching users:', error);
        setUsers([]);
      }
    };

    fetchUsers();
  }, [open, mode]);


  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setFormData(initialFormData);
      setErrors({});
      setSelectedUserName('');
      setHasActiveRateCard(false);
    }
  }, [open]);

  const handleChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    
    // In create mode, check for active rate cards when both user and service type are selected
    if (mode === 'create' && (field === 'user_id' || field === 'service_type')) {
      const userId = field === 'user_id' ? value as string : formData.user_id;
      const serviceType = field === 'service_type' ? value as string : formData.service_type;
      
      if (userId && serviceType) {
        checkActiveRateCard(userId, serviceType, false);
      }
    }
    
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Handle is_active change
  const handleIsActiveChange = (checked: boolean) => {
    // If trying to activate and there's already an active rate card, prevent it
    if (checked && hasActiveRateCard) {
      // alert('Cannot activate: An active rate card already exists for this user and service type. Please deactivate the existing rate card first.');
      toast.error('Cannot activate: An active rate card already exists for this user and service type. Please deactivate the existing rate card first.');
      return;
    }
    
    setFormData((prev) => ({
      ...prev,
      is_active: checked,
      // If deactivating, set end_date to today; if reactivating, clear end_date
      end_date: checked ? '' : new Date().toISOString().split('T')[0],
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.user_id) {
      newErrors.user_id = 'Please select a user';
    }

    if (!formData.service_type) {
      newErrors.service_type = 'Please select a service type';
    }

    // ✅ Skip min/max validation if allowEmptyRates is true OR if editing an empty rate card
    const skipRateValidation = allowEmptyRates || (mode === 'edit' && isEmptyRateCard && !formData.min_hourly_rate && !formData.max_hourly_rate);
    
    if (!skipRateValidation) {
      if (!formData.min_hourly_rate) {
        newErrors.min_hourly_rate = 'Minimum hourly rate is required';
      } else if (parseFloat(formData.min_hourly_rate) <= 0) {
        newErrors.min_hourly_rate = 'Minimum hourly rate must be greater than 0';
      }

      if (!formData.max_hourly_rate) {
        newErrors.max_hourly_rate = 'Maximum hourly rate is required';
      } else if (parseFloat(formData.max_hourly_rate) <= 0) {
        newErrors.max_hourly_rate = 'Maximum hourly rate must be greater than 0';
      }

      if (formData.min_hourly_rate && formData.max_hourly_rate) {
        if (parseFloat(formData.min_hourly_rate) > parseFloat(formData.max_hourly_rate)) {
          newErrors.max_hourly_rate = 'Maximum rate must be greater than or equal to minimum rate';
        }
      }
    }

    if (!formData.effective_date) {
      newErrors.effective_date = 'Effective date is required';
    }

    if (formData.end_date && formData.effective_date) {
      const effectiveDate = new Date(formData.effective_date);
      const endDate = new Date(formData.end_date);
      if (endDate <= effectiveDate) {
        newErrors.end_date = 'End date must be after effective date';
      }
    }

    // Check if trying to activate when another active rate card exists
    if (formData.is_active && hasActiveRateCard) {
      newErrors.is_active = 'Cannot activate: An active rate card already exists for this user and service type';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Double-check before submitting if trying to activate
      if (formData.is_active) {
        const hasActive = await checkActiveRateCard(
          formData.user_id,
          formData.service_type,
          mode === 'edit' // exclude current card in edit mode
        );
        
        if (hasActive) {
          // alert('Cannot activate: An active rate card already exists for this user and service type. Please deactivate the existing rate card first.');
          toast.error('Cannot activate: An active rate card already exists for this user and service type. Please deactivate the existing rate card first.');
          setIsSubmitting(false);
          return;
        }
      }

      // ✅ Handle empty rate cards
      const isCreatingEmptyCard = allowEmptyRates || (!formData.min_hourly_rate && !formData.max_hourly_rate);
      
      const payload: {
        user_id: number;
        service_type: string;
        effective_date: string;
        end_date: string | null;
        min_hourly_rate?: number | null;
        max_hourly_rate?: number | null;
        is_active: boolean;
        matter_id?: number;
        allow_empty_rates?: boolean;
      } = {
        user_id: parseInt(formData.user_id),
        service_type: formData.service_type,
        effective_date: formData.effective_date,
        // Send end_date as provided, or null if empty (will clear it when reactivating)
        end_date: formData.end_date || null,
        is_active: formData.is_active,
      };
      
      // Add rates only if provided (not creating empty card)
      if (!isCreatingEmptyCard && formData.min_hourly_rate && formData.max_hourly_rate) {
        payload.min_hourly_rate = parseFloat(formData.min_hourly_rate);
        payload.max_hourly_rate = parseFloat(formData.max_hourly_rate);
      } else if (isCreatingEmptyCard) {
        // Explicitly set allow_empty_rates flag for backend
        payload.allow_empty_rates = true;
      }

      const url =
        mode === 'create'
          ? API_ENDPOINTS.rateCards.create
          : API_ENDPOINTS.rateCards.update(rateCardId!);

      const method = mode === 'create' ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || `Failed to ${mode} rate card`);
      }

      // alert(`Rate card ${mode === 'create' ? 'created' : 'updated'} successfully!`);
      toast.success(`Rate card ${mode === 'create' ? 'created' : 'updated'} successfully!`);
      onSuccess?.();
    } catch (error) {
      console.error(`Error ${mode}ing rate card:`, error);
      // alert(
      //   error instanceof Error
      //     ? error.message
      //     : `Failed to ${mode} rate card. Please try again.`
      // );
      toast.error(
        error instanceof Error
          ? error.message
          : `Failed to ${mode} rate card. Please try again.`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? (allowEmptyRates ? 'Create Empty Rate Card' : 'Add Rate Card') : 'Edit Rate Card'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? (allowEmptyRates 
                  ? 'Create a placeholder rate card. Rates must be set later before billing.' 
                  : 'Add a new rate card for a user and service type.')
              : 'Update the rate card details.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* User Selection */}
          <div className="space-y-2">
            <Label htmlFor="user_id">
              User <span className="text-red-500 -ml-1.5">*</span>
            </Label>
            {mode === 'edit' || prefilledUserId ? (
              <Input
                id="user_id"
                type="text"
                value={selectedUserName || `User ID: ${formData.user_id}`}
                readOnly
                disabled
                className="bg-gray-50 cursor-not-allowed"
              />
            ) : (
              <Popover open={userComboboxOpen} onOpenChange={setUserComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={userComboboxOpen}
                    className={`w-full justify-between ${errors.user_id ? 'border-red-500' : ''}`}
                    disabled={users.length === 0}
                  >
                    {formData.user_id
                      ? (() => {
                          const u = users.find(
                            user => (user.user_id || user.id)?.toString() === formData.user_id
                          );
                          if (!u) return "Select user";
                          return `${u.name} (${formatRoleDisplay(u.role)})`;
                        })()
                      : "Select user"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>

                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search user..." />

                    <CommandList>
                      <CommandEmpty>No users found.</CommandEmpty>

                      <CommandGroup>
                        {users
                          .filter(user => user && (user.user_id || user.id))
                          .map(user => {
                            const userId = user.user_id ?? user.id!;
                            if (!userId) return null; // fallback safety check

                            return (
                              <CommandItem
                                key={userId}
                                value={user.name}
                                onSelect={() => {
                                  handleChange("user_id", userId.toString());
                                  setUserComboboxOpen(false);
                                }}
                              >
                                <div className="flex flex-col">
                                  <span>{user.name}</span>
                                  <span className="text-gray-500 text-xs">
                                    {formatRoleDisplay(user.role)}
                                  </span>
                                </div>
                              </CommandItem>
                            );
                          })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

            )}
            {errors.user_id && (
              <p className="text-sm text-red-500">{errors.user_id}</p>
            )}
            {users.length === 0 && mode === 'create' && (
              <p className="text-xs text-gray-500">
                If no users appear, please check your users API endpoint
              </p>
            )}
          </div>

          {/* Service Type */}
          <div className="space-y-2">
            <Label htmlFor="service_type">
              Service Type <span className="text-red-500 -ml-1.5">*</span>
            </Label>
            {mode === 'edit' ? (
              <Input
                id="service_type"
                type="text"
                value={formData.service_type}
                readOnly
                disabled
                className="bg-gray-50 cursor-not-allowed"
              />
            ) : (
              <Input
                id="service_type"
                type="text"
                placeholder="Enter service type (e.g., Legal Consultation, Document Review)"
                value={formData.service_type}
                onChange={(e) => handleChange('service_type', e.target.value)}
                className={errors.service_type ? 'border-red-500' : ''}
              />
            )}
            {errors.service_type && (
              <p className="text-sm text-red-500">{errors.service_type}</p>
            )}
            {mode === 'create' && hasActiveRateCard && formData.user_id && formData.service_type && (
              <p className="text-sm text-amber-600">
                ⚠️ Warning: An active rate card already exists for this user and service type. Creating a new one will be marked as inactive by default.
              </p>
            )}
          </div>

          {/* ✅ Show info message for empty rate cards */}
          {allowEmptyRates && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                <strong>ℹ️ Creating Empty Rate Card</strong>
                <br />
                Rates will be disabled. You must set minimum and maximum rates later before this user can bill for this service.
              </p>
            </div>
          )}
          
          {mode === 'edit' && isEmptyRateCard && !formData.min_hourly_rate && !formData.max_hourly_rate && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                <strong>⚠️ Empty Rate Card</strong>
                <br />
                This rate card has no rates set. Enter minimum and maximum rates below to activate billing for this service.
              </p>
            </div>
          )}

          {/* Hourly Rate Range */}
          <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
              <Label htmlFor="min_hourly_rate">
                Minimum Rate (₹) {!allowEmptyRates && <span className="text-red-500 -ml-1.5">*</span>}
            </Label>
            <Input
                id="min_hourly_rate"
              type="number"
              step="0.01"
              min="0"
                placeholder={allowEmptyRates ? "Will be set later" : "e.g., 200"}
                value={formData.min_hourly_rate}
                onChange={(e) => handleChange('min_hourly_rate', e.target.value)}
                className={errors.min_hourly_rate ? 'border-red-500' : ''}
                disabled={allowEmptyRates}
              />
              {errors.min_hourly_rate && (
                <p className="text-sm text-red-500">{errors.min_hourly_rate}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="max_hourly_rate">
                Maximum Rate (₹) {!allowEmptyRates && <span className="text-red-500 -ml-1.5">*</span>}
              </Label>
              <Input
                id="max_hourly_rate"
                type="number"
                step="0.01"
                min="0"
                placeholder={allowEmptyRates ? "Will be set later" : "e.g., 500"}
                value={formData.max_hourly_rate}
                onChange={(e) => handleChange('max_hourly_rate', e.target.value)}
                className={errors.max_hourly_rate ? 'border-red-500' : ''}
                disabled={allowEmptyRates}
            />
              {errors.max_hourly_rate && (
                <p className="text-sm text-red-500">{errors.max_hourly_rate}</p>
            )}
            </div>
          </div>

          {/* Effective Date */}
          <div className="space-y-2">
            <Label htmlFor="effective_date">
              Effective Date <span className="text-red-500 -ml-1.5">*</span>
            </Label>
            <Input
              id="effective_date"
              type="date"
              value={formData.effective_date}
              onChange={(e) => handleChange('effective_date', e.target.value)}
              className={errors.effective_date ? 'border-red-500' : ''}
            />
            {errors.effective_date && (
              <p className="text-sm text-red-500">{errors.effective_date}</p>
            )}
          </div>

          {/* Active Status */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <input
                id="is_active"
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => handleIsActiveChange(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                disabled={!formData.is_active && hasActiveRateCard}
              />
              <Label htmlFor="is_active" className="font-normal cursor-pointer">
                Active
              </Label>
            </div>
            {!formData.is_active && hasActiveRateCard && (
              <p className="text-sm text-amber-600">
                ⚠️ Cannot activate: Another active rate card exists for this user and service type
              </p>
            )}
            {errors.is_active && (
              <p className="text-sm text-red-500">{errors.is_active}</p>
            )}
          </div>

          {/* End Date (Optional) - Always visible */}
          <div className="space-y-2">
            <Label htmlFor="end_date">End Date (Optional)</Label>
            <Input
              id="end_date"
              type="date"
              value={formData.end_date}
              onChange={(e) => handleChange('end_date', e.target.value)}
              className={errors.end_date ? 'border-red-500' : ''}
            />
            {errors.end_date && (
              <p className="text-sm text-red-500">{errors.end_date}</p>
            )}
            <p className="text-xs text-gray-500">
              {formData.is_active 
                ? 'Optionally set when this rate card should end'
                : 'Date when this rate card was/will be deactivated'}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange?.(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting
              ? mode === 'create'
                ? 'Creating...'
                : 'Updating...'
              : mode === 'create'
              ? 'Create Rate Card'
              : 'Update Rate Card'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}