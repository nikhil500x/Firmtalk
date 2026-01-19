/**
 * Azure API utilities with automatic token refresh
 */

import { API_ENDPOINTS, apiRequest } from './api';

/**
 * Attempts to refresh the Azure token
 * @returns Promise<boolean> - true if refresh succeeded, false otherwise
 */
export async function refreshAzureToken(): Promise<boolean> {
  try {
    console.log('[Azure API] Attempting to refresh Azure token...');
    
    const response = await apiRequest<{ refreshed: boolean }>(
      API_ENDPOINTS.azure.refreshToken,
      { method: 'POST' }
    );

    if (response.success && response.data?.refreshed) {
      console.log('[Azure API] Token refreshed successfully');
      return true;
    } else {
      console.warn('[Azure API] Token refresh failed:', response.message);
      return false;
    }
  } catch (err) {
    console.error('[Azure API] Token refresh error:', err);
    return false;
  }
}

/**
 * Makes an Azure API request with automatic token refresh on expiration
 * @param url - API endpoint URL
 * @param options - Fetch options
 * @param retryAfterRefresh - Internal flag to prevent infinite retry loops
 * @returns Promise with parsed JSON response
 */
export async function azureApiRequest<T = unknown>(
  url: string,
  options: RequestInit = {},
  retryAfterRefresh = false
): Promise<{ success: boolean; data?: T; message?: string }> {
  try {
    const response = await apiRequest<T>(url, options);

    // If request succeeded, return the response
    if (response.success) {
      return response;
    }

    // Check if error is related to token expiration
    const errorMsg = response.message || '';
    const isTokenError = errorMsg.includes('expired') || 
                        errorMsg.includes('refresh token') || 
                        errorMsg.includes('reconnect') ||
                        errorMsg.includes('not connected');

    if (isTokenError && !retryAfterRefresh) {
      // Attempt to refresh token
      const refreshed = await refreshAzureToken();
      
      if (refreshed) {
        // Retry the original request after successful refresh
        console.log('[Azure API] Token refreshed, retrying request...');
        return azureApiRequest<T>(url, options, true);
      } else {
        // Refresh failed, return error indicating reconnection needed
        return {
          success: false,
          message: 'Azure token expired and could not be refreshed. Please reconnect your Azure account.',
        };
      }
    }

    // Return the original error if not a token error or already retried
    return response;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    const isTokenError = errorMsg.includes('expired') || 
                        errorMsg.includes('refresh token') || 
                        errorMsg.includes('reconnect') ||
                        errorMsg.includes('not connected');

    if (isTokenError && !retryAfterRefresh) {
      // Attempt to refresh token
      const refreshed = await refreshAzureToken();
      
      if (refreshed) {
        // Retry the original request after successful refresh
        console.log('[Azure API] Token refreshed, retrying request...');
        return azureApiRequest<T>(url, options, true);
      } else {
        // Refresh failed, return error indicating reconnection needed
        return {
          success: false,
          message: 'Azure token expired and could not be refreshed. Please reconnect your Azure account.',
        };
      }
    }

    // Re-throw if not a token error or already retried
    throw err;
  }
}

