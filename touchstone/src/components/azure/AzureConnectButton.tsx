'use client';

import { useState, useEffect } from 'react';
import { Cloud, CloudOff, Loader2 } from 'lucide-react';
import { API_ENDPOINTS, apiRequest } from '@/lib/api';

interface AzureStatusResponse {
  connected: boolean;
}

export default function AzureConnectButton() {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Check connection status on mount
  useEffect(() => {
    checkConnectionStatus();
  }, []);

  const checkConnectionStatus = async () => {
    try {
      setIsLoading(true);
      const response = await apiRequest<AzureStatusResponse>(API_ENDPOINTS.azure.status);
      
      if (response.success && response.data) {
        setIsConnected(response.data.connected);
      }
    } catch (error) {
      console.error('Failed to check Azure connection status:', error);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = () => {
    setIsConnecting(true);
    // Redirect to backend OAuth endpoint
    const connectUrl = API_ENDPOINTS.azure.connect;
    console.log('Azure connect URL:', connectUrl);
    if (!connectUrl || typeof connectUrl !== 'string') {
      console.error('Invalid Azure connect URL:', connectUrl);
      alert('Error: Invalid Azure connection URL. Please check your configuration.');
      setIsConnecting(false);
      return;
    }
    window.location.href = connectUrl;
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your Azure account? You will lose access to Calendar and Documents features.')) {
      return;
    }

    try {
      setIsDisconnecting(true);
      const response = await apiRequest(API_ENDPOINTS.azure.disconnect, {
        method: 'POST',
      });

      if (response.success) {
        setIsConnected(false);
        alert('Azure account disconnected successfully');
      } else {
        alert('Failed to disconnect Azure account. Please try again.');
      }
    } catch (error) {
      console.error('Failed to disconnect Azure account:', error);
      alert('Failed to disconnect Azure account. Please try again.');
    } finally {
      setIsDisconnecting(false);
    }
  };

  if (isLoading) {
    return (
      <button
        disabled
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-50 rounded-lg border border-gray-200 cursor-not-allowed"
      >
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Checking...</span>
      </button>
    );
  }

  if (isConnected) {
    return (
      <button
        onClick={handleDisconnect}
        disabled={isDisconnecting}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-green-700 bg-green-50 rounded-lg border border-green-200 hover:bg-green-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Azure Connected - Click to disconnect"
      >
        {isDisconnecting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Disconnecting...</span>
          </>
        ) : (
          <>
            <Cloud className="w-4 h-4" />
            <span>Azure Connected</span>
          </>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={handleConnect}
      disabled={isConnecting}
      className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      title="Connect your Azure account to access Calendar and Documents"
    >
      {isConnecting ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Connecting...</span>
        </>
      ) : (
        <>
          <CloudOff className="w-4 h-4" />
          <span>Connect to Azure</span>
        </>
      )}
    </button>
  );
}

