import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Shield, Check } from 'lucide-react';
import { API_ENDPOINTS } from '@/lib/api';
import { toast } from 'react-toastify';

interface User {
  id: number;
  name: string;
  role: string;
  roleId: number;
  email: string;
}

interface UserPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  onSuccess?: () => void;
}

interface Permission {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

interface PermissionCategory {
  category: string;
  permissions: Permission[];
}

interface BackendPermission {
  id: number;
  name: string;
  enabled: boolean;
}

export default function UserPermissionsDialog({ 
  open, 
  onOpenChange, 
  user,
  onSuccess 
}: UserPermissionsDialogProps) {
  const [permissions, setPermissions] = useState<PermissionCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const getPermissionsByRole = (): PermissionCategory[] => {
    // Define all possible permissions organized by category
    // All permissions start as DISABLED (false) by default
    // They will be enabled based on actual database data
    // Permission IDs match the database naming convention (um, crm, mm, ts, bi, fm, tm, dm, cal, etc.)
    const allPermissions: PermissionCategory[] = [
      {
        category: 'User Management',
        permissions: [
          { id: 'um:read', label: 'View Users', description: 'View user list and profiles', enabled: false },
          { id: 'um:create', label: 'Create Users', description: 'Add new users to the system', enabled: false },
          { id: 'um:update', label: 'Edit Users', description: 'Modify user information', enabled: false },
          // { id: 'um:delete', label: 'Deactivate Users', description: 'Deactivate user accounts', enabled: false },
        ],
      },
      {
        category: 'CRM',
        permissions: [
          { id: 'crm:read', label: 'View CRM', description: 'View clients and contacts', enabled: false },
          { id: 'crm:create', label: 'Create Clients', description: 'Add new clients and contacts', enabled: false },
          { id: 'crm:update', label: 'Edit Clients', description: 'Modify client information', enabled: false },
          { id: 'crm:delete', label: 'Delete Clients', description: 'Remove clients from system', enabled: false },
        ],
      },
      {
        category: 'Matter Management',
        permissions: [
          { id: 'mm:read', label: 'View Matters', description: 'View matter list and details', enabled: false },
          { id: 'mm:create', label: 'Create Matters', description: 'Create new matters', enabled: false },
          { id: 'mm:update', label: 'Edit Matters', description: 'Modify matter information', enabled: false },
          { id: 'mm:delete', label: 'Delete Matters', description: 'Remove matters from system', enabled: false },
        ],
      },
      {
        category: 'Timesheet Management',
        permissions: [
          { id: 'ts:read', label: 'View Timesheets', description: 'View timesheet entries', enabled: false },
          { id: 'ts:create', label: 'Create Timesheets', description: 'Log time entries', enabled: false },
          { id: 'ts:update', label: 'Edit Timesheets', description: 'Modify timesheet entries', enabled: false },
          { id: 'ts:delete', label: 'Delete Timesheets', description: 'Delete timesheet entries', enabled: false },
        ],
      },
      {
        category: 'Billing & Invoices',
        permissions: [
          { id: 'bi:read', label: 'View Invoices', description: 'View invoice list and details', enabled: false },
          { id: 'bi:create', label: 'Create Invoices', description: 'Generate new invoices', enabled: false },
          { id: 'bi:update', label: 'Edit Invoices', description: 'Modify invoice information', enabled: false },
          { id: 'bi:delete', label: 'Delete Invoices', description: 'Remove invoices', enabled: false },
        ],
      },
      {
        category: 'Finance Management',
        permissions: [
          { id: 'fm:read', label: 'View Finances', description: 'View financial reports', enabled: false },
          { id: 'fm:create', label: 'Create Transactions', description: 'Record financial transactions', enabled: false },
          { id: 'fm:update', label: 'Edit Transactions', description: 'Modify financial records', enabled: false },
          { id: 'fm:delete', label: 'Delete Transactions', description: 'Remove financial records', enabled: false },
        ],
      },
      {
        category: 'Task Management',
        permissions: [
          { id: 'tm:read', label: 'View Tasks', description: 'View assigned tasks', enabled: false },
          { id: 'tm:create', label: 'Create Tasks', description: 'Create new tasks', enabled: false },
          { id: 'tm:update', label: 'Edit Tasks', description: 'Modify task information', enabled: false },
          { id: 'tm:delete', label: 'Delete Tasks', description: 'Remove tasks', enabled: false },
        ],
      },
      {
        category: 'Document Management',
        permissions: [
          { id: 'dm:read', label: 'View Documents', description: 'View and download documents', enabled: false },
          { id: 'dm:create', label: 'Upload Documents', description: 'Upload new documents', enabled: false },
          { id: 'dm:update', label: 'Edit Documents', description: 'Modify document metadata', enabled: false },
          { id: 'dm:delete', label: 'Delete Documents', description: 'Remove documents', enabled: false },
        ],
      },
      {
        category: 'Calendar',
        permissions: [
          { id: 'cal:read', label: 'View Calendar', description: 'View calendar events', enabled: false },
          { id: 'cal:create', label: 'Create Events', description: 'Schedule new events', enabled: false },
          { id: 'cal:update', label: 'Edit Events', description: 'Modify calendar events', enabled: false },
          { id: 'cal:delete', label: 'Delete Events', description: 'Remove calendar events', enabled: false },
        ],
      },
      {
        category: 'Profile',
        permissions: [
          { id: 'prof:read', label: 'View Profile', description: 'View user profile', enabled: false },
          { id: 'prof:create', label: 'Create Profile', description: 'Create profile entries', enabled: false },
          { id: 'prof:update', label: 'Update Profile', description: 'Update profile information', enabled: false },
          { id: 'prof:delete', label: 'Delete Profile', description: 'Delete profile data', enabled: false },
        ],
      },
      {
        category: 'Support Tickets',
        permissions: [
          { id: 'st:read', label: 'View Tickets', description: 'View support tickets', enabled: false },
          { id: 'st:create', label: 'Create Tickets', description: 'Create support tickets', enabled: false },
          { id: 'st:update', label: 'Update Tickets', description: 'Update support tickets', enabled: false },
          { id: 'st:delete', label: 'Delete Tickets', description: 'Delete support tickets', enabled: false },
        ],
      },
      // {
      //   category: 'Settings',
      //   permissions: [
      //     { id: 'set:read', label: 'View Settings', description: 'View system settings', enabled: false },
      //     { id: 'set:create', label: 'Create Settings', description: 'Create settings entries', enabled: false },
      //     { id: 'set:update', label: 'Update Settings', description: 'Update system settings', enabled: false },
      //     { id: 'set:delete', label: 'Delete Settings', description: 'Delete settings', enabled: false },
      //   ],
      // },
    ];

    return allPermissions;
  };

  const fetchUserPermissions = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Fetch user's permissions from backend
      const response = await fetch(API_ENDPOINTS.users.permissions(user.id), {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.success && data.data.permissions) {
          // Get the permission structure (all disabled by default)
          const permissionData = getPermissionsByRole();
          
          // Map backend permissions to our UI structure
          const backendPermissions = data.data.permissions;
          
          // Update permissions based on backend data (ONLY backend data determines what's enabled)
          permissionData.forEach(category => {
            category.permissions.forEach(permission => {
              const backendPerm = (backendPermissions as BackendPermission[]).find((p) => p.name === permission.id);
              if (backendPerm) {
                permission.enabled = backendPerm.enabled;
              }
            });
          });
          
          setPermissions(permissionData);
        } else {
          // Fallback: all permissions disabled
          const permissionData = getPermissionsByRole();
          setPermissions(permissionData);
        }
      } else {
        // Fallback: all permissions disabled
        const permissionData = getPermissionsByRole();
        setPermissions(permissionData);
      }
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
      // Fallback: all permissions disabled
      const permissionData = getPermissionsByRole();
      setPermissions(permissionData);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open && user) {
      fetchUserPermissions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user]);

  const togglePermission = (categoryIndex: number, permissionIndex: number) => {
    const newPermissions = [...permissions];
    newPermissions[categoryIndex].permissions[permissionIndex].enabled = 
      !newPermissions[categoryIndex].permissions[permissionIndex].enabled;
    setPermissions(newPermissions);
  };

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      // Send updated permissions to the backend
      const response = await fetch(API_ENDPOINTS.users.permissions(user.id), {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: flattenPermissions() }),
      });

      const data = await response.json();

      if (data.success) {
        // alert(data.message || 'Permissions updated successfully! The user will need to log in again.');
        toast.success(data.message || 'Permissions updated successfully! The user will need to log in again.');
        onSuccess?.();
        onOpenChange(false);
      } else {
        // alert(data.message || 'Failed to update permissions. Please try again.');
        toast.error(data.message || 'Failed to update permissions. Please try again.');
      }
    } catch (error) {
      console.error('Failed to update permissions:', error);
      // alert('Failed to update permissions. Please try again.');
     toast.error('Failed to update permissions. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const flattenPermissions = () => {
    const enabled: string[] = [];
    permissions.forEach(category => {
      category.permissions.forEach(permission => {
        if (permission.enabled) {
          enabled.push(permission.id);
        }
      });
    });
    return enabled;
  };

  const handleClose = () => {
    if (!isSaving) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[700px] max-h-[85vh] bg-[#F9FAFB] border-[1.5px] border-[#F3F4F6]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Shield className="text-blue-600" size={24} />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-[#2F3C44]">
                Edit User Permissions
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-600">
                {user ? `Managing permissions for ${user.name} (${user.role})` : 'Loading...'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[calc(85vh-180px)] pr-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              {permissions.map((category, categoryIndex) => (
                <div 
                  key={category.category} 
                  className="bg-white rounded-lg border border-gray-200 p-4"
                >
                  <h3 className="text-base font-semibold text-[#2F3C44] mb-3">
                    {category.category}
                  </h3>
                  <div className="space-y-2">
                    {category.permissions.map((permission, permissionIndex) => (
                      <label
                        key={permission.id}
                        className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <div className="relative flex items-center">
                          <input
                            type="checkbox"
                            checked={permission.enabled}
                            onChange={() => togglePermission(categoryIndex, permissionIndex)}
                            disabled={isSaving}
                            className="sr-only peer"
                          />
                          <div className="w-5 h-5 border-2 border-gray-300 rounded peer-checked:border-blue-600 peer-checked:bg-blue-600 transition-all flex items-center justify-center">
                            {permission.enabled && (
                              <Check size={14} className="text-white" strokeWidth={3} />
                            )}
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">
                            {permission.label}
                          </div>
                          <div className="text-xs text-gray-500">
                            {permission.description}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-4 pt-4 border-t border-gray-200">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isSaving}
            className="flex-1 border-[1.5px] border-[#0752C2] text-[#0752C2] rounded-xl"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="flex-1 bg-[#0752C2] hover:bg-[#053F9B] text-white rounded-xl"
          >
            {isSaving ? 'Saving...' : 'Save Permissions'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

