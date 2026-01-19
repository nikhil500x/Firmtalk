'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../ui/dialog';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Field, FieldLabel, FieldError } from '../ui/field';
import { API_ENDPOINTS } from '@/lib/api';
import { formatRoleDisplay } from '@/utils/roleDisplay';
import { toast } from 'react-toastify';

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface FormData {
  email: string;
  roleId: string;
}

interface FormErrors {
  email?: string;
  roleId?: string;
}

interface Role {
  role_id: number;
  name: string;
}

const initialFormData: FormData = {
  email: '',
  roleId: '',
};

export default function InviteUserDialog({ open, onOpenChange, onSuccess }: InviteUserDialogProps) {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);

  // Fetch roles when dialog opens
  useEffect(() => {
    if (open) {
      fetchRoles();
      // Reset form when opening
      setFormData(initialFormData);
      setErrors({});
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
          setRoles(formattedRoles);
        }
      }
    } catch (error) {
      console.error('Failed to fetch roles:', error);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
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
      const response = await fetch(API_ENDPOINTS.invitations.send, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email.toLowerCase().trim(),
          role_id: parseInt(formData.roleId),
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Reset form
        setFormData(initialFormData);
        setErrors({});
        
        // Close dialog and trigger refresh
        onOpenChange(false);
        onSuccess?.();

        // alert('Invitation sent successfully!');
        toast.success('Invitation sent successfully!');
      } else {
        console.error('Invitation error:', data);
        // alert(data.message || 'Failed to send invitation');
        toast.error(data.message || 'Failed to send invitation');
      }
    } catch (error) {
      console.error('Send invitation error:', error);
      // alert('Failed to send invitation. Please try again.');
      toast.error('Failed to send invitation. Please try again.');
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
              Invite New User
            </DialogTitle>
            <DialogDescription>
              Send an invitation email to a new user. They will receive a link to complete their registration.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-6">
            {/* Email Field */}
            <Field>
              <FieldLabel className="text-base font-medium text-[#2F3C44]">
                Email Address
              </FieldLabel>
              <Input
                type="email"
                placeholder="Enter email address"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={isSubmitting}
                className="bg-white border-[1.5px] border-[#E8E8E8] rounded-lg"
                autoFocus
              />
              {errors.email && <FieldError>{errors.email}</FieldError>}
            </Field>

            {/* Role Field */}
            <Field>
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

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
              <p className="text-sm text-blue-800">
                💡 The user will receive an email with a secure link to complete their profile setup.
                The invitation will expire in 48 hours.
              </p>
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
              {isSubmitting ? 'Sending...' : 'Send Invitation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


