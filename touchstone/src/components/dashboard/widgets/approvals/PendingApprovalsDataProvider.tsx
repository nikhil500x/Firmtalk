'use client';

import React, { useEffect, useState } from 'react';
import PendingApprovalsWidget from '../PendingApprovalsWidget';
import { API_ENDPOINTS } from '@/lib/api';

interface PendingApprovalsData {
  timesheets: {
    count: number;
    canApprove: boolean;
  };
  leaves: {
    count: number;
    canApprove: boolean;
  };
  total: number;
}

interface PendingApprovalsDataProviderProps {
  widgetId: string;
  onDataLoad?: (data: PendingApprovalsData) => void;
}

export const PendingApprovalsDataProvider: React.FC<PendingApprovalsDataProviderProps> = ({
  widgetId,
  onDataLoad,
}) => {
  const [data, setData] = useState<PendingApprovalsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingApprovals();
    // Set up refresh interval (every 2 minutes)
    const interval = setInterval(fetchPendingApprovals, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchPendingApprovals = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(API_ENDPOINTS.approvals.pending, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch pending approvals: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setData(result.data);
        if (onDataLoad) {
          onDataLoad(result.data);
        }
      } else {
        throw new Error(result.message || 'Failed to fetch pending approvals');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error fetching pending approvals:', err);
    } finally {
      setLoading(false);
    }
  };

  // Only render the pending-approvals widget
  if (widgetId !== 'pending-approvals') {
    return <div className="bg-white rounded-lg shadow p-6">Widget not found</div>;
  }

  return (
    <PendingApprovalsWidget
      data={data}
      isLoading={loading}
      error={error}
    />
  );
};

export default PendingApprovalsDataProvider;

