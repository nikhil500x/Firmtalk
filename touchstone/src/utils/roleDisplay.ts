/**
 * Role Display Utility
 * Converts internal role names (lowercase/hyphenated) to user-friendly Title Case
 * 
 * This allows us to:
 * - Store roles as lowercase in database (e.g., "superadmin", "sr-associate")
 * - Avoid case sensitivity issues in comparisons
 * - Display roles in proper Title Case to users (e.g., "Super Admin", "Senior Associate")
 */

/**
 * Format role name for display to users
 * Converts internal role format to Title Case
 * 
 * @param role - Internal role name (lowercase/hyphenated)
 * @returns Formatted role name for display
 * 
 * @example
 * formatRoleDisplay('superadmin') // Returns: "Super Admin"
 * formatRoleDisplay('sr-associate') // Returns: "Senior Associate"
 * formatRoleDisplay('partner') // Returns: "Partner"
 */
export const formatRoleDisplay = (role: string | null | undefined): string => {
  if (!role) return 'Associate';
  
  // Normalize to lowercase for consistent matching
  const normalizedRole = role.toLowerCase().trim();
  
  // Special case mappings for better display
  const specialCases: Record<string, string> = {
    'superadmin': 'Super Admin',
    'sr-associate': 'Senior Associate',
    'it': 'IT',
    'hr': 'HR',
    'counsel': 'Counsel',
    'partner': 'Partner',
    'admin': 'Admin',
    'support': 'Support',
    'associate': 'Associate',
    'intern': 'Intern',
    'accountant': 'Accountant',
  };
  
  // Check if there's a special case mapping
  if (specialCases[normalizedRole]) {
    return specialCases[normalizedRole];
  }
  
  // Default: split by hyphen and capitalize each word
  return normalizedRole
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Get the internal role format from a display format
 * Useful for reverse mapping if needed
 * 
 * @param displayRole - Display role name (Title Case)
 * @returns Internal role name (lowercase/hyphenated)
 * 
 * @example
 * getRoleInternalFormat('Super Admin') // Returns: "superadmin"
 * getRoleInternalFormat('Senior Associate') // Returns: "sr-associate"
 */
export const getRoleInternalFormat = (displayRole: string | null | undefined): string => {
  if (!displayRole) return 'associate';
  
  const normalizedDisplay = displayRole.toLowerCase().trim();
  
  // Reverse mapping for special cases
  const reverseMapping: Record<string, string> = {
    'super admin': 'superadmin',
    'senior associate': 'sr-associate',
    'it': 'it',
    'hr': 'hr',
    'counsel': 'counsel',
    'partner': 'partner',
    'admin': 'admin',
    'support': 'support',
    'associate': 'associate',
    'intern': 'intern',
    'accountant': 'accountant',
  };
  
  if (reverseMapping[normalizedDisplay]) {
    return reverseMapping[normalizedDisplay];
  }
  
  // Default: convert spaces to hyphens and lowercase
  return normalizedDisplay.replace(/\s+/g, '-').toLowerCase();
};

