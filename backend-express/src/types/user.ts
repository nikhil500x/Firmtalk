// ============================================================================
// USER TYPE DEFINITIONS
// Defines the structure of user data from backend
// ============================================================================

export interface User {
  user_id: number;
  name: string;
  email: string;
  phone_number?: string;
  address?: string;
  practice_area?: string;
  last_login?: string;
  active_status: boolean;
  role: {
    role_id: number;
    name: string;
  };
}

export interface UserSession {
  success: boolean;
  data: {
    user: {
      id: number;
      name: string;
      email: string;
    };
    role: {
      id: number;
      name: string;
    };
    permissions: string[];
  };
}