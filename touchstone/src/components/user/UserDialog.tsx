import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../ui/dialog';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "../ui/popover";

import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "../ui/command";

import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

import { Field, FieldLabel, FieldError } from '../ui/field';
import { API_ENDPOINTS } from '@/lib/api';
import { formatRoleDisplay } from '@/utils/roleDisplay';
import { toast } from 'react-toastify';
import { useConfig } from '@/hooks/useConfig';


interface User {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: string;
  roleId: number;
  practiceArea?: string;
  reportingManager?: {
    user_id: number;
    name: string;
  };
  active: boolean;
  gender?: string;
  location?: string;
  userType?: string;
  userCode?: string;
  dateOfJoining?: string;
}

interface UserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  mode: 'create' | 'edit';
  userData?: User;
}

interface FormData {
  name: string;
  email: string;
  phone: string;
  password: string;
  roleId: string;
  practiceArea: string;
  reportingManagerId: string;
  active_status?: boolean;
  gender: string;
  location: string;
  // userType: string;
  // userCode: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  roleId?: string;
  gender?: string;
  location?: string;
  userType?: string;
}

interface Role {
  role_id: number;
  name: string;
}

interface Manager {
  id: number;
  name: string;
  role: string;
}

const initialFormData: FormData = {
  name: '',
  email: '',
  phone: '',
  password: '',
  roleId: '',
  practiceArea: '',
  reportingManagerId: '',
  gender: '',
  location: '',
  // userType: '',
  // userCode: '',
};

// Fallback values if config not loaded
const FALLBACK_PRACTICE_AREAS = [
  'Corporate M&A',
  'Competition & Antitrust',
  'PE,VC & Alternative Investment',
  'Employement, Pensions & Benefits',
  'Data Privacy & Security',
  'Dispute Resolutions & Investigations'
];
const FALLBACK_LOCATIONS = ['delhi', 'mumbai', 'bangalore', 'delhi (lt)'];

export default function UserDialog({ open, onOpenChange, onSuccess, mode, userData }: UserDialogProps) {
  const { practiceAreas: configPracticeAreas, locations: configLocations } = useConfig();
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [reportingManagerComboboxOpen, setReportingManagerComboboxOpen] = useState(false);

  // Use config values if available, otherwise use fallbacks
  const practiceAreas = configPracticeAreas.length > 0
    ? configPracticeAreas.filter(pa => pa.is_active).map(pa => pa.name)
    : FALLBACK_PRACTICE_AREAS;

  const locations = configLocations.length > 0
    ? configLocations.filter(l => l.active_status).map(l => l.location_code.toLowerCase())
    : FALLBACK_LOCATIONS;

  const genders = ['male', 'female'];
  
  // Pre-populate form when in edit mode
  useEffect(() => {
    if (open && mode === 'edit' && userData) {
      setFormData({
        name: userData.name || '',
        email: userData.email || '',
        phone: userData.phone || '',
        password: '', // Password field not shown in edit mode
        roleId: userData.roleId?.toString() || '',
        practiceArea: userData.practiceArea || '',
        reportingManagerId: userData.reportingManager?.user_id?.toString() || '',
        active_status: userData.active,
        gender: userData.gender || '',
        location: userData.location || '', // Keep as lowercase from database
        // userType: normalizeUserType(userData.userType), // CHANGED: Normalize user type
        // userCode: userData.userCode || '',
      });
    } else if (open && mode === 'create') {
      setFormData(initialFormData);
    }
  }, [open, mode, userData]);

  // Fetch user types when role changes
  // useEffect(() => {
  //   if (formData.roleId) {
  //     const selectedRole = roles.find(r => r.role_id.toString() === formData.roleId);
  //     if (selectedRole) {
  //       const types = getUserTypesByRole(selectedRole.name);
  //       setUserTypes(types);
  //       // Reset user type and code when role changes
  //       setFormData(prev => ({ ...prev, userType: '', userCode: '' }));
  //     }
  //   }
  // }, [formData.roleId, roles]);

  // Fetch roles and managers when dialog opens
  useEffect(() => {
    if (open) {
      fetchRoles();
    }
  }, [open]);
  useEffect(() => {
    if (open) {

      fetchManagers();
    }
  }, [open]);

  const fetchRoles = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.users.roles, {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Format the role names for display
          const formattedRoles = data.data.map((role: Role) => ({
            ...role,
            name: formatRoleDisplay(role.name)
          }));
          console.log(formattedRoles);
          setRoles(formattedRoles);
        }
      }
    } catch (error) {
      console.error('Failed to fetch roles:', error);
    }
  };

  // Helper function to get user types based on role name
  // const getUserTypesByRole = (roleName: string): string[] => {
  //   const lowerRoleName = roleName.toLowerCase();

  //   if (lowerRoleName.includes('lawyer') || ['sr_associate', 'associate', 'counsel', 'intern'].includes(lowerRoleName)) {
  //     return ['Lawyer']; // CHANGED: Single type instead of array of specific types
  //   }

  //   if (lowerRoleName === 'partner') {
  //     return ['Partner'];
  //   }

  //   if (['admin', 'hr', 'it', 'support'].includes(lowerRoleName)) {
  //     return ['Staff']; // CHANGED: Single type instead of role name
  //   }

  //   return [];
  // };

  // Generate user code based on user type and name
  // const generateUserCode = (userType: string, name: string): string => {
  //   const initials = name
  //     .split(' ')
  //     .map(word => word.charAt(0).toUpperCase())
  //     .join('')
  //     .substring(0, 2);

  //   const lowerUserType = userType.toLowerCase();

  //   if (lowerUserType === 'lawyer') {
  //     return `L${initials}`;
  //   }

  //   if (lowerUserType === 'partner') {
  //     return `P${initials}`;
  //   }

  //   if (lowerUserType === 'staff') {
  //     return `S${initials}`;
  //   }

  //   return initials;
  // };

  // Normalize user type from database (lowercase) to display format
  // const normalizeUserType = (userType: string | undefined): string => {
  //   if (!userType) return '';
  //   const lower = userType.toLowerCase();
  //   if (lower === 'lawyer') return 'Lawyer';
  //   if (lower === 'partner') return 'Partner';
  //   if (lower === 'staff') return 'Staff';
  //   return userType;
  // };

  const fetchManagers = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.users.list, {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Filter out the current user being edited from manager list
          const managerList = mode === 'edit' && userData 
            ? data.data.filter((user: Manager) => user.id !== userData.id)
            : data.data;
          setManagers(managerList);
        }
      }
    } catch (error) {
      console.error('Failed to fetch managers:', error);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone is required';
    }

    // Password is required only for create mode
    if (mode === 'create') {
      if (!formData.password.trim()) {
        newErrors.password = 'Password is required';
      } else if (formData.password.length < 6) {
        newErrors.password = 'Password must be at least 6 characters';
      }
    }

    if (!formData.roleId) {
      newErrors.roleId = 'Role is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const url = mode === 'create' 
        ? API_ENDPOINTS.users.create 
        : API_ENDPOINTS.users.update(userData!.id);
      
      const method = mode === 'create' ? 'POST' : 'PUT';

    const payload: {
      name: string;
      email: string;
      phone: string;
      role_id: number;
      practice_area: string | null;
      reporting_manager_id: number | null;
      gender?: string | null;
      location?: string | null;
      // user_type?: string | null;
      // user_code?: string | null;
      password?: string;
      active_status?: boolean;
    } = {
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      role_id: parseInt(formData.roleId),
      practice_area: formData.practiceArea || null,
      reporting_manager_id: formData.reportingManagerId ? parseInt(formData.reportingManagerId) : null,
      gender: formData.gender || null,
      location: formData.location || null,
      // user_type: formData.userType ? formData.userType.toLowerCase() : null, // CHANGED: Convert to lowercase for DB
      // user_code: formData.userCode || null,
    };

      // Only include password for create mode
      if (mode === 'create' && formData.password.trim()) {
        payload.password = formData.password;
      }

      // Include active_status for edit mode
      if (mode === 'edit') {
        payload.active_status = formData.active_status;
      }

      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        // Reset form
        setFormData(initialFormData);
        setErrors({});
        
        // Close dialog and trigger refresh
        onOpenChange(false);
        onSuccess?.();

        // alert(`User ${mode === 'create' ? 'created' : 'updated'} successfully!`);
        toast.success(`User ${mode === 'create' ? 'created' : 'updated'} successfully!`);
      } else {
        // alert(data.message || `Failed to ${mode} user`);
        toast.error(data.message || `Failed to ${mode} user`);
      }
    } catch (error) {
      console.error(`${mode} user error:`, error);
      // alert(`Failed to ${mode} user. Please try again.`);
      toast.error(`Failed to ${mode} user. Please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setFormData(initialFormData);
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
              {mode === 'create' ? 'Add New User' : 'Edit User'}
            </DialogTitle>
            <DialogDescription>
              {mode === 'create' 
                ? "Fill in the user details below. Click save when you're done."
                : "Update the user details below. Click save when you're done."
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-6">
            {/* Row 1: Name and Email */}
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

            {/* Row 2: Phone */}
            <Field>
              <FieldLabel className="text-base font-medium text-[#2F3C44]">
                Phone
              </FieldLabel>
              <Input
                type="tel"
                placeholder="Enter phone number"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                disabled={isSubmitting}
                className="bg-white border-[1.5px] border-[#E8E8E8] rounded-lg"
              />
              {errors.phone && <FieldError>{errors.phone}</FieldError>}
            </Field>

            {/* Row 3: Password - Only show in create mode */}
            {mode === 'create' && (
              <Field>
                <FieldLabel className="text-base font-medium text-[#2F3C44]">
                  Password
                </FieldLabel>
                <Input
                  type="password"
                  placeholder="Enter password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  disabled={isSubmitting}
                  className="bg-white border-[1.5px] border-[#E8E8E8] rounded-lg"
                />
                {errors.password && <FieldError>{errors.password}</FieldError>}
              </Field>
            )}

            {/* Row 4: Role and Practice Area */}
            <div className="flex gap-6">
              <Field className="flex-1">
                <FieldLabel className="text-base font-medium text-[#2F3C44]">
                  Role
                </FieldLabel>
                <Select
                  value={formData.roleId}
                  onValueChange={(value) => setFormData({ ...formData, roleId: value })}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="bg-white border-[1.5px] border-[#E8E8E8] rounded-lg">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.role_id} value={role.role_id.toString()}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.roleId && <FieldError>{errors.roleId}</FieldError>}
              </Field>

              <Field className="flex-1">
                <FieldLabel className="text-base font-medium text-[#2F3C44]">
                  Practice Area
                </FieldLabel>
                <Select
                  value={formData.practiceArea}
                  onValueChange={(value) => setFormData({ ...formData, practiceArea: value })}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="bg-white border-[1.5px] border-[#E8E8E8] rounded-lg">
                    <SelectValue placeholder="Select practice area" />
                  </SelectTrigger>
                  <SelectContent>
                    {practiceAreas.map((area) => (
                      <SelectItem key={area} value={area}>
                        {area}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {/* Row 5: Reporting Manager */}
            <Field>
              <FieldLabel className="text-base font-medium text-[#2F3C44]">
                Reporting Manager
              </FieldLabel>

              <Popover
                open={reportingManagerComboboxOpen}
                onOpenChange={setReportingManagerComboboxOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={reportingManagerComboboxOpen}
                    className="w-full justify-between bg-white border-[1.5px] border-[#E8E8E8] rounded-lg"
                    disabled={isSubmitting}
                  >
                    {formData.reportingManagerId ? (
                      (() => {
                        const selected = managers.find(
                          (m) => m.id.toString() === formData.reportingManagerId
                        );
                        return selected ? (
                          <>
                            {selected.name}
                            {selected.role && (
                              <span className="text-gray-500 text-xs ml-2">
                                ({selected.role})
                              </span>
                            )}
                          </>
                        ) : (
                          "Select reporting manager"
                        );
                      })()
                    ) : (
                      "Select reporting manager"
                    )}

                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>

                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search managers..." />

                    <CommandList>
                      <CommandEmpty>No managers found.</CommandEmpty>

                      <CommandGroup>
                        {managers.map((manager) => (
                          <CommandItem
                            key={manager.id}
                            value={`${manager.name} ${manager.role}`}
                            onSelect={() => {
                              setFormData({
                                ...formData,
                                reportingManagerId: manager.id.toString(),
                              });
                              setReportingManagerComboboxOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.reportingManagerId === manager.id.toString()
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />

                            <div className="flex flex-col">
                              <span>{manager.name}</span>
                              {manager.role && (
                                <span className="text-gray-500 text-xs">
                                  {manager.role}
                                </span>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>

                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </Field>

            {/* Row 6: Gender, Location, User Type */}
            <div className="flex gap-6">
              <Field className="flex-1">
                <FieldLabel className="text-base font-medium text-[#2F3C44]">
                  Gender
                </FieldLabel>
                <Select
                  value={formData.gender}
                  onValueChange={(value) => setFormData({ ...formData, gender: value })}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="bg-white border-[1.5px] border-[#E8E8E8] rounded-lg">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    {genders.map((gender) => (
                      <SelectItem key={gender} value={gender}>
                        {gender.charAt(0).toUpperCase() + gender.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field className="flex-1">
                <FieldLabel className="text-base font-medium text-[#2F3C44]">
                  Location
                </FieldLabel>
                <Select
                  value={formData.location}
                  onValueChange={(value) => setFormData({ ...formData, location: value })}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="bg-white border-[1.5px] border-[#E8E8E8] rounded-lg">
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((location) => (
                      <SelectItem key={location} value={location}>
                        {location === 'delhi (lt)' 
                          ? 'Delhi (Lt)'  // ✅ Display with capital L
                          : location.charAt(0).toUpperCase() + location.slice(1)
                        }
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {/* Row 7: User Type and User Code */}
            <div className="flex gap-6">
              {/* <Field className="flex-1">
                <FieldLabel className="text-base font-medium text-[#2F3C44]">
                  User Type
                </FieldLabel>
                <Select
                  value={formData.userType}
                  onValueChange={(value) => {
                    const newUserCode = generateUserCode(value, formData.name);
                    setFormData({ ...formData, userType: value, userCode: newUserCode });
                  }}
                  disabled={isSubmitting || userTypes.length === 0}
                >
                  <SelectTrigger className="bg-white border-[1.5px] border-[#E8E8E8] rounded-lg">
                    <SelectValue placeholder={userTypes.length === 0 ? "Select role first" : "Select user type"} />
                  </SelectTrigger>
                  <SelectContent>
                    {userTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field> */}

              {/* <Field className="flex-1">
                <FieldLabel className="text-base font-medium text-[#2F3C44]">
                  User Code (Auto-generated)
                </FieldLabel>
                <Input
                  placeholder="Auto-generated"
                  value={formData.userCode}
                  disabled={true}
                  className="bg-gray-100 border-[1.5px] border-[#E8E8E8] rounded-lg cursor-not-allowed"
                />
              </Field> */}
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
              className="flex-1 bg-[#d6162f] hover:bg-[#941022] text-white rounded-xl"
            >
              {isSubmitting 
                ? (mode === 'create' ? 'Adding...' : 'Updating...') 
                : (mode === 'create' ? 'Add User' : 'Update User')
              }
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}