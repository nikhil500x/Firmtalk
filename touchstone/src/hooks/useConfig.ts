'use client';

import { useState, useEffect, useCallback } from 'react';

// Types for configuration data
export interface PracticeArea {
  id: number;
  name: string;
  description?: string;
  display_order: number;
  is_active: boolean;
}

export interface MatterType {
  id: number;
  name: string;
  description?: string;
  display_order: number;
  is_active: boolean;
}

export interface MatterStatus {
  id: number;
  name: string;
  code: string;
  color?: string;
  display_order: number;
  is_final: boolean;
  is_active: boolean;
}

export interface ActivityType {
  id: number;
  name: string;
  category?: string;
  description?: string;
  is_billable: boolean;
  display_order: number;
  is_active: boolean;
}

export interface ExpenseCategory {
  id: number;
  name: string;
  code: string;
  description?: string;
  parent_id?: number;
  is_billable: boolean;
  display_order: number;
  is_active: boolean;
}

export interface LeaveType {
  id: number;
  name: string;
  code: string;
  description?: string;
  days_per_year: number;
  carry_forward: boolean;
  max_carry_days: number;
  requires_doc: boolean;
  min_notice_days: number;
  display_order: number;
  is_active: boolean;
}

export interface Industry {
  id: number;
  name: string;
  description?: string;
  display_order: number;
  is_active: boolean;
}

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  decimal_places: number;
  is_default: boolean;
  is_active: boolean;
}

export interface BillingType {
  id: number;
  name: string;
  code: string;
  description?: string;
  display_order: number;
  is_active: boolean;
}

export interface Location {
  location_id: number;
  location_code: string;
  location_name: string;
  display_name: string;
  office_code?: string;
  invoice_prefix?: string;
  default_currency?: string;
  is_billing_location: boolean;
  active_status: boolean;
}

export interface FirmSetting {
  id: number;
  setting_key: string;
  setting_value: string;
  setting_type: string;
  category: string;
  label?: string;
  description?: string;
  is_public: boolean;
}

export interface AppConfig {
  practiceAreas: PracticeArea[];
  matterTypes: MatterType[];
  matterStatuses: MatterStatus[];
  activityTypes: ActivityType[];
  expenseCategories: ExpenseCategory[];
  leaveTypes: LeaveType[];
  industries: Industry[];
  currencies: Currency[];
  billingTypes: BillingType[];
  locations: Location[];
  firmSettings: FirmSetting[];
}

// Default empty config
const defaultConfig: AppConfig = {
  practiceAreas: [],
  matterTypes: [],
  matterStatuses: [],
  activityTypes: [],
  expenseCategories: [],
  leaveTypes: [],
  industries: [],
  currencies: [],
  billingTypes: [],
  locations: [],
  firmSettings: [],
};

// Cache for config data
let configCache: AppConfig | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function useConfig() {
  const [config, setConfig] = useState<AppConfig>(configCache || defaultConfig);
  const [loading, setLoading] = useState(!configCache);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async (force: boolean = false) => {
    // Use cache if available and not expired
    if (!force && configCache && Date.now() - cacheTimestamp < CACHE_DURATION) {
      setConfig(configCache);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/config/all', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch configuration');
      }

      const data = await response.json();
      configCache = data;
      cacheTimestamp = Date.now();
      setConfig(data);
    } catch (err) {
      console.error('Error fetching config:', err);
      setError(err instanceof Error ? err.message : 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // Helper to get firm setting value
  const getSetting = useCallback((key: string, defaultValue?: string): string | number | boolean => {
    const setting = config.firmSettings.find(s => s.setting_key === key);
    if (!setting) return defaultValue ?? '';

    switch (setting.setting_type) {
      case 'number':
        return parseFloat(setting.setting_value);
      case 'boolean':
        return setting.setting_value === 'true';
      default:
        return setting.setting_value;
    }
  }, [config.firmSettings]);

  // Helper to get default currency
  const defaultCurrency = config.currencies.find(c => c.is_default) || config.currencies[0];

  // Helper to get location by code
  const getLocationByCode = useCallback((code: string) => {
    return config.locations.find(l => l.location_code === code);
  }, [config.locations]);

  // Helper to get matter status by code
  const getStatusByCode = useCallback((code: string) => {
    return config.matterStatuses.find(s => s.code === code);
  }, [config.matterStatuses]);

  // Helper to get leave type by code
  const getLeaveTypeByCode = useCallback((code: string) => {
    return config.leaveTypes.find(l => l.code === code);
  }, [config.leaveTypes]);

  // Refresh config manually
  const refreshConfig = useCallback(() => {
    return fetchConfig(true);
  }, [fetchConfig]);

  return {
    config,
    loading,
    error,
    refreshConfig,
    getSetting,
    defaultCurrency,
    getLocationByCode,
    getStatusByCode,
    getLeaveTypeByCode,
    // Direct access to arrays for dropdowns
    practiceAreas: config.practiceAreas,
    matterTypes: config.matterTypes,
    matterStatuses: config.matterStatuses,
    activityTypes: config.activityTypes,
    expenseCategories: config.expenseCategories,
    leaveTypes: config.leaveTypes,
    industries: config.industries,
    currencies: config.currencies,
    billingTypes: config.billingTypes,
    locations: config.locations,
  };
}

// Clear the cache (useful for testing or after config updates)
export function clearConfigCache() {
  configCache = null;
  cacheTimestamp = 0;
}
