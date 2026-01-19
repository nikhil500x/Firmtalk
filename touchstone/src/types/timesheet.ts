/**
 * Timesheet Type Definitions
 */

export interface Timesheet {
  id: number;
  timesheet_id: number;
  user_id: number;
  matter_id: number;
  date: string;
  hours_worked: number; // In minutes
  billable_hours: number; // In minutes
  non_billable_hours: number; // In minutes
  activity_type: string;
  description?: string | null;
  hourly_rate?: number | null; // Rate in matter currency
  calculated_amount?: number | null; // Amount in matter currency
  status: string;
  notes?: string | null;
  last_update?: string | null;
  approved_by?: number | null;
  created_at: string;
  updated_at: string;
  
  // Currency fields
  hourly_rate_currency?: string; // Original currency (always 'INR')
  hourly_rate_conversion_rate?: number | null; // Conversion rate used
  calculated_amount_currency?: string; // Currency of calculated amount (matter currency)
  
  // Relations
  user?: {
    name: string;
    email: string;
    role?: {
      name: string;
    };
  };
  matter?: {
    id: number;
    matter_title: string;
    currency?: string; // Matter currency
    billing_rate_type?: string;
    client?: {
      client_name: string;
    };
  };
  expenses?: Expense[];
  approver?: {
    name: string;
  };
}

export interface Expense {
  expense_id: number;
  category: string;
  sub_category?: string | null;
  description: string;
  vendor_id?: number | null;
  amount: number; // Always in INR
  due_date?: string | null;
  matter_id?: number | null;
  status: string;
  receipt_url?: string | null;
  approved_by?: number | null;
  approved_at?: string | null;
  notes?: string | null;
  recorded_by: number;
  created_at: string;
  updated_at: string;
  expense_included: boolean;
  timesheet_id?: number | null;
  amount_currency: string; // Always 'INR'
  
  // Relations
  vendor?: {
    vendor_name: string;
  };
}

export interface TimesheetFormData {
  matterId?: string;
  date?: string;
  billableHours?: string;
  nonBillableHours?: string;
  hoursWorked?: string;
  activityType?: string;
  description?: string;
  notes?: string;
  expenseIds?: number[];
  [key: string]: unknown;
}

