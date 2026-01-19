'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useState } from 'react';
import { InvoicedVsNonInvoiced } from './InvoicedVsNonInvoiced';
import { BillableSplit } from './BillableSplit';

interface TimesheetWidgetsDataProviderProps {
  widgetId: string;
  days?: number;
  dateFrom?: string;  // Optional date filter from DashboardGrid
  dateTo?: string;    // Optional date filter from DashboardGrid
}

const DEFAULT_DAYS = 30;

export const TimesheetWidgetsDataProvider: React.FC<TimesheetWidgetsDataProviderProps> = ({
  widgetId,
  days = DEFAULT_DAYS,
  dateFrom,
  dateTo,
}) => {
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalytics();
  }, [days, dateFrom, dateTo]); // Re-fetch when date filters change

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
      
      // Build query parameters
      const params = new URLSearchParams();
      
      // Priority: Use date range if provided, otherwise use days parameter
      if (dateFrom && dateTo) {
        params.append('startDate', dateFrom);
        params.append('endDate', dateTo);
      } else {
        params.append('days', days.toString());
      }
      
      const url = `${backendUrl}/api/analytics/timesheet-overview?${params}`;

      const response = await fetch(url, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch analytics: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setAnalyticsData(result.data);
      } else {
        throw new Error(result.message || 'Failed to fetch analytics');
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error fetching timesheet analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 h-full flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6 h-full flex items-center justify-center">
        <div className="text-center text-red-600">
          <p className="text-sm">{error}</p>
          <button
            onClick={fetchAnalytics}
            className="mt-2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  switch (widgetId) {
    case 'timesheet-invoiced-vs-non-invoiced':
      return <InvoicedVsNonInvoiced data={analyticsData?.invoicedVsNonInvoiced} />;
    case 'timesheet-billable-split':
      return <BillableSplit data={analyticsData?.billableSplit} />;
    default:
      return <div className="bg-white rounded-lg shadow p-6">Widget not found</div>;
  }
};