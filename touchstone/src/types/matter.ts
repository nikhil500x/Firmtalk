/**
 * Matter Type Definitions
 */

export interface Matter {
  id: number;
  client_id: number;
  assigned_lawyer: number | null;
  matter_title: string;
  matter_code?: string | null;
  engagement_letter_url?: string | null;
  description?: string | null;
  matter_type?: string | null;
  practice_area?: string | null;
  start_date: string;
  estimated_deadline?: string | null;
  status: string;
  estimated_value?: number | null;
  billing_rate_type?: string | null;
  opposing_party_name?: string | null;
  active_status: boolean;
  created_at: string;
  updated_at: string;
  billing_amount_reached?: number | null;
  created_by?: number | null;
  matter_creation_requested_by?: number | null;
  has_conflict: boolean;
  conflict_status?: string | null;
  currency: string; // Currency code (INR, USD, EUR, etc.)
  
  // Relations
  client?: {
    id: number;
    name: string;
  };
  assigned_lawyer_rel?: {
    id: number;
    name: string;
    email: string;
  };
  matter_users?: MatterUser[];
}

export interface MatterUser {
  matter_id: number;
  user_id: number;
  service_type: string;
  role?: string | null;
  assigned_at: string;
  hourly_rate?: number | null; // Rate in matter currency (converted from INR)
  is_lead: boolean;
  
  user: {
    name: string;
    role?: string;
  };
}

export interface MatterFormData {
  matter_title?: string;
  client_id?: string;
  assigned_lawyer?: string;
  practice_area?: string;
  matter_type?: string;
  start_date?: string;
  estimated_deadline?: string;
  description?: string;
  opposing_party_name?: string;
  estimated_value?: string;
  billing_rate_type?: string;
  engagement_letter_url?: string;
  currency?: string; // Currency selection
  [key: string]: unknown;
}

