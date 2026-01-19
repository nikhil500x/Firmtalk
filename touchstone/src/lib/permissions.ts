/**
 * Permission helper functions for matter operations
 */

interface Matter {
  assignedLawyerId?: number | null;
  assigned_lawyer?: number | null;
}

interface User {
  id?: number;
  role?: {
    name: string;
  } | null;
}

interface Role {
  id?: number;
  name?: string;
}

/**
 * Check if user can close or reopen a matter
 * Permissions: Partners, Admins, and assigned lead lawyer can close/reopen
 */
export const canCloseMatter = (matter: Matter, currentUser: User | null, currentRole?: Role | null): boolean => {
  if (!currentUser) return false;
  
  // Check role from either nested user.role or separate role parameter
  const roleName = ((currentUser.role?.name) || currentRole?.name || '').toLowerCase();
  const isPartnerOrAdmin = ['partner', 'admin', 'superadmin', 'super admin'].includes(roleName);
  const assignedLawyerId = matter.assignedLawyerId ?? matter.assigned_lawyer;
  const isLeadLawyer = assignedLawyerId === currentUser.id;
  
  return isPartnerOrAdmin || isLeadLawyer;
};

