/**
 * API Configuration
 * Centralized API configuration for consistent backend communication
 */

// Base API URL - can be configured via environment variable
// In development, use relative paths (empty string) to leverage Next.js rewrites for same-origin requests
// In production, use the configured backend URL
export const API_BASE_URL = process.env.NODE_ENV === 'production'
  ? (process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001')
  : ''; // Use relative path for local development with Next.js rewrites

// API Endpoints
export const API_ENDPOINTS = {
  // Auth endpoints
  auth: {
    login: `${API_BASE_URL}/api/auth/login`,
    logout: `${API_BASE_URL}/api/auth/logout`,
    session: `${API_BASE_URL}/api/auth/session`,
    profile: `${API_BASE_URL}/api/auth/profile`,
    me: `${API_BASE_URL}/api/auth/session`,
  },
  
  // User endpoints
  users: {
    list: `${API_BASE_URL}/api/users`,
    byId: (id: number) => `${API_BASE_URL}/api/users/${id}`,
    create: `${API_BASE_URL}/api/users`,
    update: (id: number) => `${API_BASE_URL}/api/users/${id}`,
    delete: (id: number) => `${API_BASE_URL}/api/users/${id}`,
    roles: `${API_BASE_URL}/api/users/roles`,
    matters: (id: number) => `${API_BASE_URL}/api/users/${id}/matters`,
    permissions: (id: number) => `${API_BASE_URL}/api/users/${id}/permissions`,
    allPermissions: `${API_BASE_URL}/api/users/permissions/all`,
  },

  // Invitation endpoints
  invitations: {
    send: `${API_BASE_URL}/api/invitations/send`,
    list: `${API_BASE_URL}/api/invitations`,
    resend: (id: number) => `${API_BASE_URL}/api/invitations/${id}/resend`,
    cancel: (id: number) => `${API_BASE_URL}/api/invitations/${id}`,
  },

  // Onboarding endpoints
  onboarding: {
    base: `${API_BASE_URL}/api/onboarding`,
    verify: (token: string) => `${API_BASE_URL}/api/onboarding/verify/${token}`,
    complete: `${API_BASE_URL}/api/onboarding/complete`,
    managers: `${API_BASE_URL}/api/onboarding/managers`,
    userTypes: (roleName: string) => `${API_BASE_URL}/api/onboarding/user-types/${roleName}`,
  },

  // Contact endpoints
  contacts: {
    list: `${API_BASE_URL}/api/contacts`,
    byId: (id: number) => `${API_BASE_URL}/api/contacts/${id}`,
    byClient: (clientId: number) => `${API_BASE_URL}/api/contacts/client/${clientId}`,
    create: `${API_BASE_URL}/api/contacts`,
    update: (id: number) => `${API_BASE_URL}/api/contacts/${id}`,
    delete: (id: number) => `${API_BASE_URL}/api/contacts/${id}`
  },

  // Client endpoints
  clients: {
    list: `${API_BASE_URL}/api/clients`,
    byId: (id: number) => `${API_BASE_URL}/api/clients/${id}`,
    create: `${API_BASE_URL}/api/clients`,
    update: (id: number) => `${API_BASE_URL}/api/clients/${id}`,
    delete: (id: number) => `${API_BASE_URL}/api/clients/${id}`,
    matters: (id: number) => `${API_BASE_URL}/api/clients/${id}/matters`,
    groups: {
      list: `${API_BASE_URL}/api/clients/groups`,
      create: `${API_BASE_URL}/api/clients/groups`,
    },
    bulkUpload: {
      template: `${API_BASE_URL}/api/clients/bulk-upload/template`,
      preview: `${API_BASE_URL}/api/clients/bulk-upload/preview`,
      confirm: `${API_BASE_URL}/api/clients/bulk-upload/confirm`,
      downloadPreview: `${API_BASE_URL}/api/clients/bulk-upload/download-preview`,
    },
  },

  // Org Chart endpoints
  orgChart: {
    byClient: (clientId: number) => `${API_BASE_URL}/api/org-chart/client/${clientId}`,
    mindmap: `${API_BASE_URL}/api/org-chart/mindmap`,
    relationship: {
      create: `${API_BASE_URL}/api/org-chart/relationship`,
      update: (id: number) => `${API_BASE_URL}/api/org-chart/relationship/${id}`,
      delete: (id: number) => `${API_BASE_URL}/api/org-chart/relationship/${id}`,
    },
    badge: {
      add: (contactId: number) => `${API_BASE_URL}/api/org-chart/contact/${contactId}/badge`,
      remove: (contactId: number, badgeType: string) => `${API_BASE_URL}/api/org-chart/contact/${contactId}/badge/${badgeType}`,
    },
  },

  // Interaction endpoints
  interactions: {
    byContact: (contactId: number) => `${API_BASE_URL}/api/interactions/contact/${contactId}`,
    timeline: (contactId: number) => `${API_BASE_URL}/api/interactions/contact/${contactId}/timeline`,
    create: `${API_BASE_URL}/api/interactions`,
  },
  // Opportunity endpoints
  opportunities: {
    list: `${API_BASE_URL}/api/opportunities`,
    byId: (id: number) => `${API_BASE_URL}/api/opportunities/${id}`,
    pipeline: `${API_BASE_URL}/api/opportunities/pipeline`,
    stats: `${API_BASE_URL}/api/opportunities/stats`,
    create: `${API_BASE_URL}/api/opportunities`,
    update: (id: number) => `${API_BASE_URL}/api/opportunities/${id}`,
    updateStage: (id: number) => `${API_BASE_URL}/api/opportunities/${id}/stage`,
    convert: (id: number) => `${API_BASE_URL}/api/opportunities/${id}/convert`,
    delete: (id: number) => `${API_BASE_URL}/api/opportunities/${id}`,
  },
  // Lead endpoints
  leads: {
    list: `${API_BASE_URL}/api/leads`,
    byId: (id: number) => `${API_BASE_URL}/api/leads/${id}`,
    stats: `${API_BASE_URL}/api/leads/stats`,
    create: `${API_BASE_URL}/api/leads`,
    update: (id: number) => `${API_BASE_URL}/api/leads/${id}`,
    updateScore: (id: number) => `${API_BASE_URL}/api/leads/${id}/score`,
    convert: (id: number) => `${API_BASE_URL}/api/leads/${id}/convert`,
    delete: (id: number) => `${API_BASE_URL}/api/leads/${id}`,
  },

  // Matter endpoints
  matters: {
    list: `${API_BASE_URL}/api/matters`,
    byId: (id: number) => `${API_BASE_URL}/api/matters/${id}`,
    byClient: (clientId: number) => `${API_BASE_URL}/api/matters/client/${clientId}`,
    create: `${API_BASE_URL}/api/matters`,
    update: (id: number) => `${API_BASE_URL}/api/matters/${id}`,
    delete: (id: number) => `${API_BASE_URL}/api/matters/${id}`,
    team: {
      add: (matterId: number) => `${API_BASE_URL}/api/matters/${matterId}/team`,
      remove: (matterId: number, userId: number, serviceType: string) => `${API_BASE_URL}/api/matters/${matterId}/team/${userId}/${encodeURIComponent(serviceType)}`,
      update: (matterId: number, userId: number) => `${API_BASE_URL}/api/matters/${matterId}/team/${userId}`,
      updateRate: (matterId: number, userId: number) => `${API_BASE_URL}/api/matters/${matterId}/users/${userId}/rate`,
      history: (matterId: number) => `${API_BASE_URL}/api/matters/${matterId}/team/history`,
    },
  },

  // Timesheet endpoints
  timesheets: {
    list: `${API_BASE_URL}/api/timesheets`,
    byId: (id: number) => `${API_BASE_URL}/api/timesheets/${id}`,
    byUser: (userId: number) => `${API_BASE_URL}/api/timesheets/user/${userId}`,
    getById: (id: number) => `${API_BASE_URL}/api/timesheets/${id}`,  // ✅ ADD THIS LINE
    assignedMatters: `${API_BASE_URL}/api/timesheets/matters/assigned`,
    create: `${API_BASE_URL}/api/timesheets`,
    update: (id: number) => `${API_BASE_URL}/api/timesheets/${id}`,
    delete: (id: number) => `${API_BASE_URL}/api/timesheets/${id}`,
    approve: (id: number) => `${API_BASE_URL}/api/timesheets/${id}/approve`,
    reject: (id: number) => `${API_BASE_URL}/api/timesheets/${id}/reject`,
    recalculateForUserMatter: (userId: number, matterId: number) => 
      `${API_BASE_URL}/api/timesheets/user/${userId}/matter/${matterId}/recalculate`,
    billedhours: {
      userBillableHours: `${API_BASE_URL}/api/analytics/user-billable-hours`,
    },
  },

  // Leave endpoints
  leaves: {
    list: `${API_BASE_URL}/api/leaves`,
    byId: (id: number) => `${API_BASE_URL}/api/leaves/${id}`,
    byUser: (userId: number) => `${API_BASE_URL}/api/leaves/user/${userId}`,
    create: `${API_BASE_URL}/api/leaves`,
    update: (id: number) => `${API_BASE_URL}/api/leaves/${id}`,
    delete: (id: number) => `${API_BASE_URL}/api/leaves/${id}`,
    approve: (id: number) => `${API_BASE_URL}/api/leaves/${id}/approve`,
    reject: (id: number) => `${API_BASE_URL}/api/leaves/${id}/reject`,
    stats: (userId: number) => `${API_BASE_URL}/api/leaves/stats/${userId}`,
    balance: (userId: number, year?: number) => `${API_BASE_URL}/api/leaves/balance/${userId}${year ? `?year=${year}` : ''}`,
    balanceSummary: (userId: number) => `${API_BASE_URL}/api/leaves/balance-summary/${userId}`,
    balancesAll: (year?: number) => `${API_BASE_URL}/api/leaves/balances/all${year ? `?year=${year}` : ''}`,
    availableTypes: `${API_BASE_URL}/api/leaves/available-types`,
    calculateWorkingDays: `${API_BASE_URL}/api/leaves/calculate-working-days`,
    calculateEndDate: `${API_BASE_URL}/api/leaves/calculate-end-date`,
    holidays: (location: string, year: number) => `${API_BASE_URL}/api/leaves/holidays/${location}/${year}`,
    allHolidays: (params?: { location?: string; year?: number }) => {
      const queryParams = new URLSearchParams();
      if (params?.location) queryParams.append('location', params.location);
      if (params?.year) queryParams.append('year', params.year.toString());
      const query = queryParams.toString();
      return `${API_BASE_URL}/api/leaves/holidays${query ? `?${query}` : ''}`;
    },
  },


 // Rate Card endpoints  // ✅ ADD THIS ENTIRE SECTION
  rateCards: {
    list: `${API_BASE_URL}/api/userRateCard`,
    byId: (rateCardId: number) => `${API_BASE_URL}/api/userRateCard/${rateCardId}`,
    create: `${API_BASE_URL}/api/userRateCard`,
    update: (rateCardId: number) => `${API_BASE_URL}/api/userRateCard/${rateCardId}`,
    deactivate: (rateCardId: number) => `${API_BASE_URL}/api/userRateCard/${rateCardId}`,
    
    // User-specific rate cards
    byUser: (userId: number) => `${API_BASE_URL}/api/userRateCard/user/${userId}`,
    activeByService: (userId: number, serviceType: string) => 
      `${API_BASE_URL}/api/userRateCard/user/${userId}/service/${serviceType}/active`,
    
    // Active rate cards
    active: `${API_BASE_URL}/api/userRateCard/active`,
    
    // Bulk operations
    bulkCreate: `${API_BASE_URL}/api/userRateCard/bulk`,

    serviceTypes: `${API_BASE_URL}/api/userRateCard/service-types`,  // ✅ ADD THIS LINE
    userServiceTypes: (userId: number) => `${API_BASE_URL}/api/userRateCard/user/${userId}/service-types`,  // ✅ ADD THIS


  },



  // Invoice endpoints
  invoices: {
    list: `${API_BASE_URL}/api/invoices`,
    byId: (id: number) => `${API_BASE_URL}/api/invoices/${id}`,
    byClient: (clientId: number) => `${API_BASE_URL}/api/invoices/client/${clientId}`,
    byMatter: (matterId: number) => `${API_BASE_URL}/api/invoices/matter/${matterId}`,
    create: `${API_BASE_URL}/api/invoices`,
    update: (id: number) => `${API_BASE_URL}/api/invoices/${id}`,
    delete: (id: number) => `${API_BASE_URL}/api/invoices/${id}`,
    timesheetSummary: (id: number) => `${API_BASE_URL}/api/invoices/${id}/timesheet-summary`,
    currencyBreakdown: (id: number) => `${API_BASE_URL}/api/invoices/${id}/currency-breakdown`,
    payments: {
      list: (invoiceId: number) => `${API_BASE_URL}/api/invoices/${invoiceId}/payments`,
      record: (invoiceId: number) => `${API_BASE_URL}/api/invoices/${invoiceId}/payments`,
    },
  },


  // Task endpoints
  tasks: {
    list: `${API_BASE_URL}/api/tasks`,
    byId: (id: number) => `${API_BASE_URL}/api/tasks/${id}`,
    byUser: (userId: number) => `${API_BASE_URL}/api/tasks/user/${userId}`,
    createdByUser: (userId: number) => `${API_BASE_URL}/api/tasks/created-by/${userId}`,
    create: `${API_BASE_URL}/api/tasks`,
    update: (id: number) => `${API_BASE_URL}/api/tasks/${id}`,
    delete: (id: number) => `${API_BASE_URL}/api/tasks/${id}`,
  },


  support: {
    // Ticket CRUD
    list: `${API_BASE_URL}/api/support/tickets`,
    byId: (id: number) => `${API_BASE_URL}/api/support/tickets/${id}`,
    create: `${API_BASE_URL}/api/support/tickets`,
    update: (id: number) => `${API_BASE_URL}/api/support/tickets/${id}`,
    delete: (id: number) => `${API_BASE_URL}/api/support/tickets/${id}`,
    
    // Ticket actions
    assign: (id: number) => `${API_BASE_URL}/api/support/tickets/${id}/assign`,
    resolve: (id: number) => `${API_BASE_URL}/api/support/tickets/${id}/resolve`,
    
    // Stats and analytics
    stats: `${API_BASE_URL}/api/support/tickets/stats`,
  },

    // Expense endpoints
  expenses: {
    oneTime: {
      list: `${API_BASE_URL}/api/expenses/onetime`,
      byId: (id: number) => `${API_BASE_URL}/api/expenses/onetime/${id}`,
      create: `${API_BASE_URL}/api/expenses/onetime`,
      update: (id: number) => `${API_BASE_URL}/api/expenses/onetime/${id}`,
      delete: (id: number) => `${API_BASE_URL}/api/expenses/onetime/${id}`,
    },

    payments: {
      listForOneTime: (id: number) =>
        `${API_BASE_URL}/api/expenses/payments?onetime_expense_id=${id}`,

      record: () => `${API_BASE_URL}/api/expenses/payments`,

      delete: (id: number) =>
        `${API_BASE_URL}/api/expenses/payments/${id}`,
    },
  },


  // Azure endpoints
  azure: {
    connect: `${API_BASE_URL}/api/azure/connect`,
    callback: `${API_BASE_URL}/api/azure/callback`,
    status: `${API_BASE_URL}/api/azure/status`,
    refreshToken: `${API_BASE_URL}/api/azure/refresh-token`,
    disconnect: `${API_BASE_URL}/api/azure/disconnect`,
    calendar: {
      events: `${API_BASE_URL}/api/azure/calendar/events`,
      calendars: `${API_BASE_URL}/api/azure/calendar/calendars`,
      createEvent: `${API_BASE_URL}/api/azure/calendar/events`,
      updateEvent: (eventId: string) => `${API_BASE_URL}/api/azure/calendar/events/${eventId}`,
      deleteEvent: (eventId: string) => `${API_BASE_URL}/api/azure/calendar/events/${eventId}`,
    },
    documents: {
      onedrive: `${API_BASE_URL}/api/azure/documents/onedrive`,
      sharepoint: `${API_BASE_URL}/api/azure/documents/sharepoint`,
      search: `${API_BASE_URL}/api/azure/documents/search`,
    },
  },



  // Notification endpoints
  notifications: {
    list: `${API_BASE_URL}/api/notifications`,
    count: `${API_BASE_URL}/api/notifications/count`,
    stats: `${API_BASE_URL}/api/notifications/stats`,
    markRead: (id: number) => `${API_BASE_URL}/api/notifications/${id}/read`,
    markAllRead: `${API_BASE_URL}/api/notifications/mark-all-read`,
    delete: (id: number) => `${API_BASE_URL}/api/notifications/${id}`,
  },

  // Approvals endpoints
  approvals: {
    pending: `${API_BASE_URL}/api/approvals/pending`,
    pendingDetails: `${API_BASE_URL}/api/approvals/pending/details`,
  },

  // Conflict endpoints
  conflicts: {
    verify: (token: string) => `${API_BASE_URL}/api/conflicts/verify/${token}`,
    raise: `${API_BASE_URL}/api/conflicts/raise`,
    byMatter: (matterId: number) => `${API_BASE_URL}/api/conflicts/matter/${matterId}`,
    resolve: (conflictId: number) => `${API_BASE_URL}/api/conflicts/${conflictId}/resolve`,
    dismiss: (conflictId: number) => `${API_BASE_URL}/api/conflicts/${conflictId}`,
    stats: `${API_BASE_URL}/api/conflicts/stats`,
  },

  // Currency endpoints
  currency: {
    supported: `${API_BASE_URL}/api/currency/supported`,
    rate: (from: string, to: string) => `${API_BASE_URL}/api/currency/rate?from=${from}&to=${to}`,
    convert: `${API_BASE_URL}/api/currency/convert`,
  },
} as const;


/**
 * Default fetch options for API requests
 */
export const defaultFetchOptions: RequestInit = {
  credentials: 'include', // Always include cookies for session management
  headers: {
    'Content-Type': 'application/json',
  },
};

/**
 * Helper function to make API requests with consistent error handling
 * @param url - API endpoint URL
 * @param options - Fetch options
 * @returns Promise with parsed JSON response
 */
export async function apiRequest<T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; message?: string }> {
  try {
    const response = await fetch(url, {
      ...defaultFetchOptions,
      ...options,
      headers: {
        ...defaultFetchOptions.headers,
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `HTTP error! status: ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}