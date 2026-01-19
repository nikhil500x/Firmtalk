import { ConfidentialClientApplication, Configuration, AuthenticationResult } from '@azure/msal-node';
import { Client } from '@microsoft/microsoft-graph-client';
import type { AuthenticationProvider } from '@microsoft/microsoft-graph-client';
import CryptoJS from 'crypto-js';
import prisma from '../prisma-client';

/**
 * Azure Service
 * Handles Microsoft Graph API authentication and token management
 */

const ENCRYPTION_KEY = process.env.AZURE_TOKEN_ENCRYPTION_KEY || 'default-key-change-in-production';

// Encrypt token before storing in database
function encryptToken(token: string): string {
  return CryptoJS.AES.encrypt(token, ENCRYPTION_KEY).toString();
}

// Decrypt token from database
function decryptToken(encryptedToken: string): string {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedToken, ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    throw new Error('Failed to decrypt token');
  }
}

const redirectUri = process.env.AZURE_REDIRECT_URI || 'http://localhost:3001/api/azure/callback';

// Lazy initialization of MSAL instance
let pca: ConfidentialClientApplication | null = null;

function getMSALInstance(): ConfidentialClientApplication {
  if (!pca) {
    const clientId = process.env.AZURE_CLIENT_ID;
    const clientSecret = process.env.AZURE_CLIENT_SECRET;
    const tenantId = process.env.AZURE_TENANT_ID;

    if (!clientId || !clientSecret) {
      throw new Error('Azure credentials not configured. Please set AZURE_CLIENT_ID and AZURE_CLIENT_SECRET environment variables.');
    }

    if (!tenantId) {
      throw new Error('AZURE_TENANT_ID is required for single-tenant organization accounts. Please set it in your .env file.');
    }

    // Single-tenant mode: always use organization tenant
    const authority = `https://login.microsoftonline.com/${tenantId}`;

    const msalConfig: Configuration = {
      auth: {
        clientId,
        authority,
        clientSecret,
      },
    };

    pca = new ConfidentialClientApplication(msalConfig);
  }

  return pca;
}

export class AzureService {
  /**
   * Get authorization URL for OAuth flow
   * Single-tenant mode: uses organization tenant with full permissions (admin consent required)
   */
  static async getAuthUrl(userId: number): Promise<string> {
    const msalInstance = getMSALInstance();
    
    // Single-tenant organization accounts - use full permissions
    // Admin consent must be granted in Azure Portal for Files.Read.All and Sites.Read.All
    const scopes = [
      'openid',
      'profile',
      'offline_access',
      'https://graph.microsoft.com/Calendars.ReadWrite',  // Read and write calendar events
      'https://graph.microsoft.com/Files.Read.All',  // Read OneDrive files (requires admin consent)
      'https://graph.microsoft.com/Sites.Read.All',  // SharePoint access (requires admin consent)
      'https://graph.microsoft.com/User.Read',
    ];

    const authCodeUrlParameters = {
      scopes,
      redirectUri,
      state: userId.toString(), // Store userId in state for callback
      // Don't force consent prompt - admin consent should already be granted
    };

    const authUrl = await msalInstance.getAuthCodeUrl(authCodeUrlParameters);
    return authUrl;
  }

  /**
   * Exchange authorization code for tokens
   * Single-tenant mode: uses organization tenant with full permissions
   */
  static async acquireTokenByCode(code: string, state: string): Promise<AuthenticationResult> {
    const msalInstance = getMSALInstance();
    
    // Single-tenant organization accounts - use full permissions
    const scopes = [
      'https://graph.microsoft.com/Calendars.ReadWrite',  // Read and write calendar events
      'https://graph.microsoft.com/Files.Read.All',  // Read OneDrive files
      'https://graph.microsoft.com/Sites.Read.All',
      'https://graph.microsoft.com/User.Read',
    ];
    
    const tokenRequest = {
      code,
      scopes,
      redirectUri,
    };

    const response = await msalInstance.acquireTokenByCode(tokenRequest);
    
    if (!response) {
      throw new Error('Failed to acquire token');
    }

    // Log token response for debugging
    console.log('Azure acquireTokenByCode response:', {
      hasAccessToken: !!response.accessToken,
      accountId: response.account?.homeAccountId,
      tenantId: response.tenantId,
    });

    // Note: refreshToken is not directly available in AuthenticationResult
    // It's stored in MSAL cache and can be retrieved via silent token acquisition
    // If refreshToken is needed, try to get it from the account cache
    if (response.account) {
      try {
        const accounts = await msalInstance.getTokenCache().getAllAccounts();
        const account = accounts.find(acc => acc.homeAccountId === response.account?.homeAccountId);
        if (account) {
          console.log('Found account in cache, attempting to get refresh token');
        }
      } catch (error) {
        console.error('Error getting refresh token from cache:', error);
      }
    }

    return response;
  }

  /**
   * Save tokens to database (encrypted)
   */
  static async saveTokens(
    userId: number,
    accessToken: string,
    refreshToken: string | undefined,
    expiresAt: Date,
    tenantId?: string,
    accountId?: string // MSAL account ID for silent token refresh
  ): Promise<void> {
    const encryptedAccessToken = encryptToken(accessToken);
    // MSAL Node stores refresh tokens internally, but we try to save if available
    const encryptedRefreshToken = refreshToken ? encryptToken(refreshToken) : null;

    // Store tokens and account information
    // Note: MSAL Node stores refresh tokens internally in its cache
    // We store account ID in tenant_id field to use for silent token acquisition
    await prisma.users.update({
      where: { user_id: userId },
      data: {
        azure_connected: true,
        azure_access_token: encryptedAccessToken,
        azure_refresh_token: encryptedRefreshToken, // Store if available, but MSAL cache is primary
        azure_token_expires_at: expiresAt,
        azure_tenant_id: accountId || tenantId || null, // Store accountId for silent token acquisition
        azure_connected_at: new Date(),
      },
    });

    // Store account in MSAL cache for future silent token refresh
    if (accountId) {
      const msalInstance = getMSALInstance();
      try {
        // MSAL will use its internal cache for token refresh
        // We don't need to store refresh token separately if account is in cache
        console.log(`Azure saveTokens: Account ${accountId} will be used for silent token refresh`);
      } catch (error) {
        console.error('Azure saveTokens: Error storing account info:', error);
      }
    }
  }

  /**
   * Get valid access token for user (refresh if needed)
   */
  static async getValidAccessToken(userId: number): Promise<string> {
    const user = await prisma.users.findUnique({
      where: { user_id: userId },
      select: {
        azure_access_token: true,
        azure_refresh_token: true,
        azure_token_expires_at: true,
        azure_tenant_id: true,
        azure_connected: true,
      },
    });

    if (!user) {
      console.error(`Azure getValidAccessToken: User ${userId} not found`);
      throw new Error('Azure account not connected');
    }

    if (!user.azure_connected) {
      console.error(`Azure getValidAccessToken: User ${userId} azure_connected is false`);
      throw new Error('Azure account not connected');
    }

    if (!user.azure_access_token) {
      console.error(`Azure getValidAccessToken: User ${userId} has no access token`);
      throw new Error('Azure account not connected');
    }

    // MSAL stores refresh tokens internally, so azure_refresh_token might be null
    // If refresh token is missing, we'll try to use acquireTokenSilent with account from cache
    // For now, we allow null refresh_token but log a warning
    if (!user.azure_refresh_token) {
      console.warn(`Azure getValidAccessToken: User ${userId} has no refresh token stored - will attempt silent refresh if account is in MSAL cache`);
    }

    // Check if token is expired (with 5 minute buffer)
    const now = new Date();
    const expiresAt = user.azure_token_expires_at;
    const bufferTime = 5 * 60 * 1000; // 5 minutes

    if (expiresAt && new Date(expiresAt.getTime() - bufferTime) > now) {
      // Token is still valid
      return decryptToken(user.azure_access_token);
    }

    // Token expired or about to expire, refresh it
    // Try silent token acquisition first (uses MSAL internal cache)
    // This is the preferred method as MSAL stores refresh tokens in its cache
    try {
      const newAccessToken = await this.acquireTokenSilent(userId, user.azure_tenant_id);
      if (newAccessToken) {
        console.log(`Azure getValidAccessToken: Successfully refreshed token for user ${userId} using silent acquisition`);
        return newAccessToken;
      }
    } catch (silentError) {
      console.warn(`Azure getValidAccessToken: Silent token acquisition failed for user ${userId}, trying refresh token method`);
    }
    
    // Fallback: Try using stored refresh token if available
    if (user.azure_refresh_token) {
      try {
        return await this.refreshAccessToken(userId, user.azure_refresh_token);
      } catch (refreshError) {
        console.error(`Azure getValidAccessToken: Refresh token method failed for user ${userId}:`, refreshError);
      }
    }
    
    // If both methods fail, user needs to reconnect
    console.error(`Azure getValidAccessToken: Cannot refresh token for user ${userId} - both silent and refresh token methods failed`);
    throw new Error('Azure token expired and refresh token is missing. Please reconnect your Azure account.');
  }

  /**
   * Acquire token silently using MSAL cache (preferred method)
   * This uses MSAL's internal cache which stores refresh tokens automatically
   */
  static async acquireTokenSilent(userId: number, accountIdOrTenantId: string | null | undefined): Promise<string> {
    const msalInstance = getMSALInstance();
    
    // Single-tenant organization accounts - use full permissions
    const scopes = [
      'https://graph.microsoft.com/Calendars.ReadWrite',  // Read and write calendar events
      'https://graph.microsoft.com/Files.Read.All',  // Read OneDrive files
      'https://graph.microsoft.com/Sites.Read.All',
      'https://graph.microsoft.com/User.Read',
    ];

    // Try to find account in MSAL cache
    const tokenCache = msalInstance.getTokenCache();
    const accounts = await tokenCache.getAllAccounts();
    
    if (accounts.length === 0) {
      throw new Error('No accounts found in MSAL cache');
    }

    // Find account by ID if provided, otherwise use first account
    let account = accountIdOrTenantId 
      ? accounts.find(acc => acc.homeAccountId === accountIdOrTenantId || acc.localAccountId === accountIdOrTenantId)
      : accounts[0];

    if (!account) {
      // If account ID doesn't match, try using first account
      account = accounts[0];
      console.warn(`Azure acquireTokenSilent: Account ${accountIdOrTenantId} not found in cache, using first available account`);
    }

    try {
      const silentRequest = {
        scopes,
        account: account,
      };

      const response = await msalInstance.acquireTokenSilent(silentRequest);

      if (!response || !response.accessToken) {
        throw new Error('Failed to acquire token silently');
      }

      // Save new tokens
      // Note: refreshToken is not in AuthenticationResult, it's stored in MSAL cache
      // Silent token acquisition uses the cached refresh token automatically
      const expiresAt = response.expiresOn ? new Date(response.expiresOn.getTime()) : new Date(Date.now() + 3600000);
      await this.saveTokens(
        userId,
        response.accessToken,
        undefined, // refreshToken is managed by MSAL cache, not in response
        expiresAt,
        response.tenantId,
        response.account?.homeAccountId // Store account ID for future silent acquisitions
      );

      console.log(`Azure acquireTokenSilent: Successfully refreshed token for user ${userId}`);
      return response.accessToken;
    } catch (error) {
      console.error(`Azure acquireTokenSilent: Failed for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token (fallback method)
   * Single-tenant mode: uses organization tenant with full permissions
   */
  static async refreshAccessToken(userId: number, encryptedRefreshToken: string): Promise<string> {
    const msalInstance = getMSALInstance();
    const refreshToken = decryptToken(encryptedRefreshToken);

    // Single-tenant organization accounts - use full permissions
    const scopes = [
      'https://graph.microsoft.com/Calendars.ReadWrite',  // Read and write calendar events
      'https://graph.microsoft.com/Files.Read.All',  // Read OneDrive files
      'https://graph.microsoft.com/Sites.Read.All',
      'https://graph.microsoft.com/User.Read',
    ];

    const tokenRequest = {
      refreshToken,
      scopes,
    };

    const response = await msalInstance.acquireTokenByRefreshToken(tokenRequest);

    if (!response || !response.accessToken) {
      throw new Error('Failed to refresh token');
    }

    // Save new tokens
    // Note: refreshToken is not in AuthenticationResult, it's stored in MSAL cache
    const expiresAt = response.expiresOn ? new Date(response.expiresOn.getTime()) : new Date(Date.now() + 3600000);
    await this.saveTokens(
      userId,
      response.accessToken,
      undefined, // refreshToken is managed by MSAL cache, not in response
      expiresAt,
      response.tenantId,
      response.account?.homeAccountId // Store account ID for future silent acquisitions
    );

    return response.accessToken;
  }

  /**
   * Get Microsoft Graph API client for user
   */
  static async getGraphClient(userId: number): Promise<Client> {
    console.log(`[Azure] getGraphClient: Getting access token for user ${userId}`);
    const accessToken = await this.getValidAccessToken(userId);
    
    // Log token info (first 20 chars for security)
    const tokenPreview = accessToken.substring(0, 20) + '...';
    console.log(`[Azure] getGraphClient: Access token obtained (preview: ${tokenPreview})`);

    // Create a custom auth provider that implements AuthenticationProvider interface
    // Use initWithMiddleware instead of init() because init() wraps authProvider in CustomAuthenticationProvider
    // which causes binding issues. initWithMiddleware uses the provider directly.
    const authProvider: AuthenticationProvider = {
      getAccessToken: async (): Promise<string> => {
        // Always return the current access token
        // The token is already validated/refreshed by getValidAccessToken
        // If token expires during the request, we'll get a new one on the next call
        return accessToken;
      },
    };

    console.log(`[Azure] getGraphClient: Creating Graph client with initWithMiddleware`);
    
    // Use initWithMiddleware to avoid the CustomAuthenticationProvider wrapper that init() adds
    const client = Client.initWithMiddleware({
      authProvider: authProvider,
    });
    
    console.log(`[Azure] getGraphClient: Graph client created successfully`);
    
    return client;
  }

  /**
   * Disconnect Azure account for user
   */
  static async disconnectAccount(userId: number): Promise<void> {
    await prisma.users.update({
      where: { user_id: userId },
      data: {
        azure_connected: false,
        azure_access_token: null,
        azure_refresh_token: null,
        azure_token_expires_at: null,
        azure_tenant_id: null,
        azure_connected_at: null,
      },
    });
  }

  /**
   * Check if user has Azure connected
   */
  static async isConnected(userId: number): Promise<boolean> {
    const user = await prisma.users.findUnique({
      where: { user_id: userId },
      select: { azure_connected: true },
    });

    return user?.azure_connected || false;
  }

  /**
   * Get calendar events from ALL calendars (not just default)
   * This ensures we get events from personal calendars, shared calendars, etc.
   */
  static async getCalendarEvents(userId: number, startDate?: Date, endDate?: Date) {
    console.log(`[Azure] getCalendarEvents: User ${userId}, startDate: ${startDate?.toISOString() || 'now'}, endDate: ${endDate?.toISOString() || '30 days ahead'}`);
    
    const client = await this.getGraphClient(userId);
    
    // Default to 30 days in past to 90 days ahead for better coverage
    const defaultStart = new Date();
    defaultStart.setDate(defaultStart.getDate() - 30); // 30 days in past
    
    const start = startDate ? startDate.toISOString() : defaultStart.toISOString();
    const end = endDate 
      ? endDate.toISOString() 
      : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(); // 90 days ahead

    const filterQuery = `start/dateTime ge '${start}' and start/dateTime le '${end}'`;
    
    console.log(`[Azure] Date range: ${start} to ${end}`);
    console.log(`[Azure] Fetching events from ALL calendars`);

    try {
      // Step 1: Get all calendars the user has access to
      console.log(`[Azure] Step 1: Fetching all calendars...`);
      const calendarsResponse = await client.api('/me/calendars').get();
      const calendars = calendarsResponse.value || [];
      console.log(`[Azure] Found ${calendars.length} calendar(s):`, calendars.map((c: any) => c.name));

      if (calendars.length === 0) {
        console.log(`[Azure] No calendars found for user`);
        return [];
      }

      // Step 2: Fetch events from each calendar
      const allEvents: any[] = [];
      const eventIdMap = new Map<string, boolean>(); // To avoid duplicates

      for (const calendar of calendars) {
        const calendarId = calendar.id;
        const calendarName = calendar.name;
        
        try {
          console.log(`[Azure] Fetching events from calendar: "${calendarName}" (${calendarId})`);
          
          const eventsResponse = await client
            .api(`/me/calendars/${calendarId}/events`)
            .filter(filterQuery)
            .orderby('start/dateTime')
            .top(100)
            .get();

          const calendarEvents = eventsResponse.value || [];
          console.log(`[Azure] Found ${calendarEvents.length} event(s) in "${calendarName}"`);

          // Add events to the list, avoiding duplicates
          for (const event of calendarEvents) {
            if (!eventIdMap.has(event.id)) {
              // Add calendar name and ID to event for reference
              event.calendarName = calendarName;
              event.calendarId = calendarId;
              
              // Ensure calendarName is included in the response
              if (!event.calendarName) {
                console.log(`[Azure] WARNING: calendarName is missing for event ${event.id}`);
              }
              
              allEvents.push(event);
              eventIdMap.set(event.id, true);
            }
          }
        } catch (calendarError) {
          console.error(`[Azure] Error fetching events from calendar "${calendarName}":`, calendarError);
          // Continue with other calendars even if one fails
          if (calendarError instanceof Error) {
            console.error(`[Azure] Error message: ${calendarError.message}`);
          }
        }
      }

      // Step 3: Sort all events by start time
      allEvents.sort((a, b) => {
        const aStart = new Date(a.start?.dateTime || a.start || 0).getTime();
        const bStart = new Date(b.start?.dateTime || b.start || 0).getTime();
        return aStart - bStart;
      });

      console.log(`[Azure] Total events from all calendars: ${allEvents.length}`);
      
      // Log calendar distribution
      const calendarCounts = new Map<string, number>();
      allEvents.forEach(e => {
        const calName = e.calendarName || 'Unknown';
        calendarCounts.set(calName, (calendarCounts.get(calName) || 0) + 1);
      });
      console.log(`[Azure] Events per calendar:`, Array.from(calendarCounts.entries()));
      
      if (allEvents.length > 0) {
        console.log(`[Azure] Sample events with calendar info:`, 
          allEvents.slice(0, Math.min(5, allEvents.length)).map(e => ({
            subject: e.subject,
            start: e.start?.dateTime || e.start,
            calendar: e.calendarName,
            calendarId: e.calendarId?.substring(0, 20) + '...',
            organizer: e.organizer?.emailAddress?.address,
          }))
        );
      } else {
        console.log(`[Azure] No events found in date range ${start} to ${end} across all calendars`);
      }

      return allEvents;
    } catch (error) {
      console.error(`[Azure] Graph API Error for calendar events:`, error);
      if (error instanceof Error) {
        console.error(`[Azure] Error message: ${error.message}`);
        console.error(`[Azure] Error stack: ${error.stack}`);
        
        // Check if it's a permissions error
        if (error.message.includes('403') || error.message.includes('Forbidden')) {
          console.error(`[Azure] Permission denied - user may not have Calendars.Read permission`);
        } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
          console.error(`[Azure] Unauthorized - token may be invalid or expired`);
        }
      }
      throw error;
    }
  }

  /**
   * List available calendars with write permissions
   */
  static async listCalendars(userId: number) {
    console.log(`[Azure] listCalendars: User ${userId}`);
    
    const client = await this.getGraphClient(userId);

    try {
      const response = await client.api('/me/calendars').get();
      const calendars = response.value || [];
      
      console.log(`[Azure] Found ${calendars.length} calendar(s):`, calendars.map((c: any) => c.name));

      // Map calendars to include write permissions info
      const calendarsWithPermissions = calendars.map((calendar: any) => ({
        id: calendar.id,
        name: calendar.name,
        color: calendar.color,
        canEdit: calendar.canEdit !== false, // Default to true if not specified
        canShare: calendar.canShare !== false, // Default to true if not specified
        isDefaultCalendar: calendar.isDefaultCalendar || false,
      }));

      return calendarsWithPermissions;
    } catch (error) {
      console.error(`[Azure] Error listing calendars:`, error);
      if (error instanceof Error) {
        console.error(`[Azure] Error message: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Convert recurring pattern to RRULE format
   */
  private static patternToRRULE(pattern: {
    type: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    daysOfWeek?: string[]; // For weekly: ['monday', 'tuesday']
    dayOfMonth?: number; // For monthly: 15
    endDate?: string; // ISO date string
    occurrences?: number; // Number of occurrences
  }): string {
    const { type, interval, daysOfWeek, dayOfMonth, endDate, occurrences } = pattern;
    
    let rrule = '';
    
    switch (type) {
      case 'daily':
        rrule = `FREQ=DAILY;INTERVAL=${interval}`;
        break;
      case 'weekly':
        const days = daysOfWeek?.map(d => d.substring(0, 2).toUpperCase()).join(',') || '';
        rrule = `FREQ=WEEKLY;INTERVAL=${interval}${days ? `;BYDAY=${days}` : ''}`;
        break;
      case 'monthly':
        rrule = `FREQ=MONTHLY;INTERVAL=${interval}${dayOfMonth ? `;BYMONTHDAY=${dayOfMonth}` : ''}`;
        break;
      case 'yearly':
        rrule = `FREQ=YEARLY;INTERVAL=${interval}${dayOfMonth ? `;BYMONTHDAY=${dayOfMonth}` : ''}`;
        break;
    }
    
    if (endDate) {
      const end = new Date(endDate);
      const endStr = end.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      rrule += `;UNTIL=${endStr}`;
    } else if (occurrences) {
      rrule += `;COUNT=${occurrences}`;
    }
    
    return rrule;
  }

  /**
   * Create calendar event
   */
  static async createCalendarEvent(
    userId: number,
    calendarId: string,
    eventData: {
      subject: string;
      start: string; // ISO date string
      end: string; // ISO date string
      location?: string;
      body?: string;
      isAllDay?: boolean;
      recurrence?: {
        type: 'daily' | 'weekly' | 'monthly' | 'yearly';
        interval: number;
        daysOfWeek?: string[];
        dayOfMonth?: number;
        endDate?: string;
        occurrences?: number;
      };
    }
  ) {
    console.log(`[Azure] createCalendarEvent: User ${userId}, Calendar ${calendarId}, Subject: ${eventData.subject}`);
    
    const client = await this.getGraphClient(userId);

    try {
      const event: any = {
        subject: eventData.subject,
        start: {
          dateTime: eventData.start,
          timeZone: 'UTC',
        },
        end: {
          dateTime: eventData.end,
          timeZone: 'UTC',
        },
      };

      if (eventData.isAllDay) {
        event.isAllDay = true;
        event.start = { dateTime: eventData.start.split('T')[0], timeZone: 'UTC' };
        event.end = { dateTime: eventData.end.split('T')[0], timeZone: 'UTC' };
      }

      if (eventData.location) {
        event.location = {
          displayName: eventData.location,
        };
      }

      if (eventData.body) {
        event.body = {
          contentType: 'text',
          content: eventData.body,
        };
      }

      // Add recurrence if specified
      if (eventData.recurrence) {
        const pattern = eventData.recurrence;
        event.recurrence = {
          pattern: {
            type: pattern.type === 'daily' ? 'daily' : 
                  pattern.type === 'weekly' ? 'weekly' : 
                  pattern.type === 'monthly' ? 'absoluteMonthly' : 'absoluteYearly',
            interval: pattern.interval,
            daysOfWeek: pattern.daysOfWeek || [],
            dayOfMonth: pattern.dayOfMonth,
          },
          range: {
            type: eventData.recurrence.endDate ? 'endDate' : 
                  eventData.recurrence.occurrences ? 'numbered' : 'noEnd',
            endDate: eventData.recurrence.endDate,
            numberOfOccurrences: eventData.recurrence.occurrences,
          },
        };
      }

      const endpoint = calendarId === 'default' || calendarId === 'primary'
        ? '/me/calendar/events'
        : `/me/calendars/${calendarId}/events`;

      console.log(`[Azure] Creating event in calendar: ${calendarId}`);
      const response = await client.api(endpoint).post(event);

      console.log(`[Azure] Event created successfully: ${response.id}`);
      return response;
    } catch (error) {
      console.error(`[Azure] Error creating calendar event:`, error);
      if (error instanceof Error) {
        console.error(`[Azure] Error message: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Update calendar event
   */
  static async updateCalendarEvent(
    userId: number,
    calendarId: string,
    eventId: string,
    eventData: {
      subject?: string;
      start?: string;
      end?: string;
      location?: string;
      body?: string;
      isAllDay?: boolean;
      recurrence?: {
        type: 'daily' | 'weekly' | 'monthly' | 'yearly';
        interval: number;
        daysOfWeek?: string[];
        dayOfMonth?: number;
        endDate?: string;
        occurrences?: number;
      };
    },
    updateSeries: boolean = false
  ) {
    console.log(`[Azure] updateCalendarEvent: User ${userId}, Calendar ${calendarId}, Event ${eventId}, UpdateSeries: ${updateSeries}`);
    
    const client = await this.getGraphClient(userId);

    try {
      const updatePayload: any = {};

      if (eventData.subject !== undefined) {
        updatePayload.subject = eventData.subject;
      }
      if (eventData.start) {
        updatePayload.start = {
          dateTime: eventData.start,
          timeZone: 'UTC',
        };
      }
      if (eventData.end) {
        updatePayload.end = {
          dateTime: eventData.end,
          timeZone: 'UTC',
        };
      }
      if (eventData.isAllDay !== undefined) {
        updatePayload.isAllDay = eventData.isAllDay;
        if (eventData.isAllDay && eventData.start) {
          updatePayload.start = { dateTime: eventData.start.split('T')[0], timeZone: 'UTC' };
        }
        if (eventData.isAllDay && eventData.end) {
          updatePayload.end = { dateTime: eventData.end.split('T')[0], timeZone: 'UTC' };
        }
      }
      if (eventData.location !== undefined) {
        if (eventData.location) {
          updatePayload.location = {
            displayName: eventData.location,
          };
        } else {
          updatePayload.location = null;
        }
      }
      if (eventData.body !== undefined) {
        updatePayload.body = {
          contentType: 'text',
          content: eventData.body,
        };
      }

      // Handle recurrence updates
      if (eventData.recurrence) {
        const pattern = eventData.recurrence;
        updatePayload.recurrence = {
          pattern: {
            type: pattern.type === 'daily' ? 'daily' : 
                  pattern.type === 'weekly' ? 'weekly' : 
                  pattern.type === 'monthly' ? 'absoluteMonthly' : 'absoluteYearly',
            interval: pattern.interval,
            daysOfWeek: pattern.daysOfWeek || [],
            dayOfMonth: pattern.dayOfMonth,
          },
          range: {
            type: eventData.recurrence.endDate ? 'endDate' : 
                  eventData.recurrence.occurrences ? 'numbered' : 'noEnd',
            endDate: eventData.recurrence.endDate,
            numberOfOccurrences: eventData.recurrence.occurrences,
          },
        };
      }

      const endpoint = calendarId === 'default' || calendarId === 'primary'
        ? `/me/calendar/events/${eventId}`
        : `/me/calendars/${calendarId}/events/${eventId}`;

      // For single occurrence updates in a series, Microsoft Graph handles this automatically
      if (!updateSeries) {
        const existingEvent = await client.api(endpoint).get();
        if (existingEvent.recurrence) {
          console.log(`[Azure] Event is part of a series, updating single occurrence`);
        }
      }

      console.log(`[Azure] Updating event: ${eventId}`);
      const response = await client.api(endpoint).patch(updatePayload);

      console.log(`[Azure] Event updated successfully: ${response.id}`);
      return response;
    } catch (error) {
      console.error(`[Azure] Error updating calendar event:`, error);
      if (error instanceof Error) {
        console.error(`[Azure] Error message: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Delete calendar event
   */
  static async deleteCalendarEvent(
    userId: number,
    calendarId: string,
    eventId: string,
    deleteSeries: boolean = false
  ) {
    console.log(`[Azure] deleteCalendarEvent: User ${userId}, Calendar ${calendarId}, Event ${eventId}, DeleteSeries: ${deleteSeries}`);
    
    const client = await this.getGraphClient(userId);

    try {
      const endpoint = calendarId === 'default' || calendarId === 'primary'
        ? `/me/calendar/events/${eventId}`
        : `/me/calendars/${calendarId}/events/${eventId}`;

      // For single occurrence deletion in a series, Microsoft Graph handles this automatically
      if (!deleteSeries) {
        const existingEvent = await client.api(endpoint).get();
        if (existingEvent.recurrence) {
          console.log(`[Azure] Event is part of a series, deleting single occurrence`);
        }
      }

      console.log(`[Azure] Deleting event: ${eventId}`);
      await client.api(endpoint).delete();

      console.log(`[Azure] Event deleted successfully: ${eventId}`);
      return { success: true };
    } catch (error) {
      console.error(`[Azure] Error deleting calendar event:`, error);
      if (error instanceof Error) {
        console.error(`[Azure] Error message: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get OneDrive files
   */
  static async getOneDriveFiles(userId: number, folderPath: string = '/') {
    console.log(`[Azure] getOneDriveFiles: User ${userId}, folderPath: ${folderPath}`);
    
    const client = await this.getGraphClient(userId);
    
    const endpoint = folderPath === '/' || folderPath === ''
      ? '/me/drive/root/children'
      : `/me/drive/root:${folderPath}:/children`;

    console.log(`[Azure] Graph API Request: GET ${endpoint}`);
    console.log(`[Azure] Top: 100`);

    try {
      const response = await client
        .api(endpoint)
        .top(100)
        .get();

      const files = response.value || [];
      console.log(`[Azure] Graph API Response: Success`);
      console.log(`[Azure] Files count: ${files.length}`);
      
      if (files.length > 0) {
        console.log(`[Azure] First file sample:`, {
          name: files[0].name,
          size: files[0].size,
          folder: files[0].folder ? 'Yes' : 'No',
          webUrl: files[0].webUrl,
        });
      } else {
        console.log(`[Azure] No files found in folder: ${folderPath}`);
      }

      return files;
    } catch (error) {
      console.error(`[Azure] Graph API Error for OneDrive files:`, error);
      if (error instanceof Error) {
        console.error(`[Azure] Error message: ${error.message}`);
        console.error(`[Azure] Error stack: ${error.stack}`);
      }
      throw error;
    }
  }

  /**
   * Get SharePoint sites
   * Single-tenant mode: full SharePoint access after admin consent
   */
  static async getSharePointSites(userId: number) {
    console.log(`[Azure] getSharePointSites: User ${userId}`);
    
    const client = await this.getGraphClient(userId);
    
    const apiEndpoint = '/sites?search=*';
    console.log(`[Azure] Graph API Request: GET ${apiEndpoint}`);
    console.log(`[Azure] Top: 100`);

    try {
      const response = await client
        .api(apiEndpoint)
        .top(100)
        .get();

      const sites = response.value || [];
      console.log(`[Azure] Graph API Response: Success`);
      console.log(`[Azure] Sites count: ${sites.length}`);
      
      if (sites.length > 0) {
        console.log(`[Azure] First site sample:`, {
          displayName: sites[0].displayName,
          webUrl: sites[0].webUrl,
          id: sites[0].id,
        });
      } else {
        console.log(`[Azure] No SharePoint sites found`);
      }

      return sites;
    } catch (error) {
      console.error(`[Azure] Graph API Error for SharePoint sites:`, error);
      if (error instanceof Error) {
        console.error(`[Azure] Error message: ${error.message}`);
        console.error(`[Azure] Error stack: ${error.stack}`);
      }
      throw error;
    }
  }

  /**
   * Get SharePoint site files
   * Single-tenant mode: full SharePoint access after admin consent
   */
  static async getSharePointSiteFiles(userId: number, siteId: string, folderPath: string = '/') {
    console.log(`[Azure] getSharePointSiteFiles: User ${userId}, siteId: ${siteId}, folderPath: ${folderPath}`);
    
    const client = await this.getGraphClient(userId);
    
    const endpoint = folderPath === '/' || folderPath === ''
      ? `/sites/${siteId}/drive/root/children`
      : `/sites/${siteId}/drive/root:${folderPath}:/children`;

    console.log(`[Azure] Graph API Request: GET ${endpoint}`);
    console.log(`[Azure] Top: 100`);

    try {
      const response = await client
        .api(endpoint)
        .top(100)
        .get();

      const files = response.value || [];
      console.log(`[Azure] Graph API Response: Success`);
      console.log(`[Azure] Files count: ${files.length}`);
      
      if (files.length > 0) {
        console.log(`[Azure] First file sample:`, {
          name: files[0].name,
          size: files[0].size,
          folder: files[0].folder ? 'Yes' : 'No',
        });
      } else {
        console.log(`[Azure] No files found in SharePoint site ${siteId}, folder: ${folderPath}`);
      }

      return files;
    } catch (error) {
      console.error(`[Azure] Graph API Error for SharePoint site files:`, error);
      if (error instanceof Error) {
        console.error(`[Azure] Error message: ${error.message}`);
        console.error(`[Azure] Error stack: ${error.stack}`);
      }
      throw error;
    }
  }

  /**
   * Search files across OneDrive and SharePoint
   * Supports regex pattern matching for file names
   * Uses Graph API search endpoints where possible for better performance
   * @param limit - Maximum number of results to return (default: 100)
   * @param skip - Number of results to skip for pagination (default: 0)
   * @param maxDepthOneDrive - Maximum depth to search in OneDrive (default: 3)
   * @param maxDepthSharePoint - Maximum depth to search in SharePoint (default: 2)
   */
  static async searchFiles(
    userId: number,
    searchQuery: string,
    useRegex: boolean = false,
    searchOneDrive: boolean = true,
    searchSharePoint: boolean = true,
    limit: number = 100,
    skip: number = 0,
    maxDepthOneDrive: number = 3,
    maxDepthSharePoint: number = 2
  ) {
    console.log(`[Azure] searchFiles: User ${userId}, query: "${searchQuery}", useRegex: ${useRegex}, limit: ${limit}, skip: ${skip}`);
    
    const client = await this.getGraphClient(userId);
    const allResults: Array<{
      id: string;
      name: string;
      webUrl?: string;
      folder?: { childCount: number };
      file?: { mimeType: string; size: number };
      lastModifiedDateTime?: string;
      source: 'onedrive' | 'sharepoint';
      siteName?: string;
      path?: string;
    }> = [];

    // Compile regex pattern if requested
    let regexPattern: RegExp | null = null;
    if (useRegex) {
      try {
        regexPattern = new RegExp(searchQuery, 'i'); // Case-insensitive
        console.log(`[Azure] Using regex pattern: ${regexPattern}`);
      } catch (err) {
        console.error(`[Azure] Invalid regex pattern: ${searchQuery}`, err);
        throw new Error('Invalid regex pattern');
      }
    } else {
      // Convert simple search query to regex (escape special chars)
      // For simple text search, we want to match anywhere in the filename
      const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      regexPattern = new RegExp(escapedQuery, 'i'); // Case-insensitive, matches anywhere
      console.log(`[Azure] Simple search pattern: ${regexPattern} (from query: "${searchQuery}")`);
    }

    // Helper function to check if a filename matches the pattern
    const matchesPattern = (filename: string): boolean => {
      if (!regexPattern) return false;
      const matches = regexPattern.test(filename);
      // Log first few matches for debugging
      if (matches) {
        console.log(`[Azure] Pattern match: "${filename}" matches pattern ${regexPattern}`);
      }
      return matches;
    };

    // Shared skip counter across all sources
    let skippedCount = 0;
    
    // Track if we should skip OneDrive folder traversal (if Graph API search succeeded)
    let skipOneDriveFolderSearch = false;

    try {
      // Try Microsoft Graph API search endpoint first (much faster for simple text searches)
      if (!useRegex && searchOneDrive) {
        try {
          console.log(`[Azure] Attempting Graph API search endpoint for OneDrive...`);
          const searchResponse = await client
            .api(`/me/drive/search(q='${encodeURIComponent(searchQuery)}')`)
            .top(500)
            .get();
          
          if (searchResponse.value && searchResponse.value.length > 0) {
            console.log(`[Azure] Graph API search found ${searchResponse.value.length} items`);
            
            // Filter and slice results based on limit and skip
            const matched = searchResponse.value
              .filter((item: any) => item.name && matchesPattern(item.name))
              .slice(skip, skip + limit)
              .map((item: any) => ({
                ...item,
                source: 'onedrive' as const,
                path: item.parentReference?.path 
                  ? item.parentReference.path.replace('/drive/root:', '').replace('/drive/root', '')
                  : '/',
              }));
            
            // If we got enough results and not searching SharePoint, return early
            if (matched.length >= limit && !searchSharePoint) {
              console.log(`[Azure] Returning ${matched.length} results from Graph API search`);
              return matched;
            }
            
            // Add OneDrive results to allResults
            if (matched.length > 0) {
              // Skip logic: Graph API already returns results starting from skip index
              // So we add them directly without incrementing skippedCount
              allResults.push(...matched);
              
              // If we have enough, skip OneDrive folder traversal
              if (allResults.length >= limit && !searchSharePoint) {
                return allResults.slice(0, limit);
              }
              
              console.log(`[Azure] Graph API search found ${matched.length} results, continuing with SharePoint if needed`);
              // Skip folder traversal since we got results from Graph API
              skipOneDriveFolderSearch = true;
            }
          }
        } catch (searchError: any) {
          // Graph API search endpoint might not be available or might fail
          // Fall through to folder traversal method
          console.log(`[Azure] Graph API search endpoint failed or unavailable: ${searchError?.message || searchError}`);
        }
      }

      // Search OneDrive and SharePoint in parallel for better performance
      const searchPromises: Promise<void>[] = [];

      // OneDrive search function
      if (searchOneDrive && !skipOneDriveFolderSearch) {
        const searchOneDriveFiles = async (): Promise<void> => {
          console.log(`[Azure] Searching OneDrive...`);
          try {
          // Always do folder search - it's more reliable and we can limit depth
          // Limit depth to prevent hanging on large folders
          const MAX_DEPTH = maxDepthOneDrive; // Use parameter for progressive depth
          const MAX_ITEMS_PER_FOLDER = 100; // Reduced for faster search
          
          let onedriveResultsCount = 0;
          const targetResults = limit + skip;
          
          // Early exit if we have enough results
          const shouldContinueSearching = () => allResults.length < limit && skippedCount + allResults.length < targetResults;
          
          const searchFolder = async (
            endpoint: string,
            currentPath: string = '/',
            depth: number = 0
          ): Promise<void> => {
            if (depth >= MAX_DEPTH) {
              console.log(`[Azure] Reached max depth ${MAX_DEPTH} at ${currentPath}`);
              return;
            }

            try {
              const response = await client
                .api(endpoint)
                .top(MAX_ITEMS_PER_FOLDER)
                .get();

              const items = response.value || [];
              
              if (items.length > 0 && depth === 0) {
                console.log(`[Azure] OneDrive: Checking ${items.length} items in root`);
              } else if (items.length > 0) {
                console.log(`[Azure] OneDrive: Checking ${items.length} items at depth ${depth} in ${currentPath}`);
              }

              for (const item of items) {
                // Early exit if we have enough results
                if (!shouldContinueSearching()) {
                  break;
                }
                
                // Check if item name matches search pattern
                if (matchesPattern(item.name)) {
                  // Skip items before the skip offset
                  if (skippedCount < skip) {
                    skippedCount++;
                    onedriveResultsCount++;
                  } else if (allResults.length < limit) {
                    onedriveResultsCount++;
                    allResults.push({
                      ...item,
                      source: 'onedrive',
                      path: currentPath,
                    });
                    
                    console.log(`[Azure] ✓ OneDrive match: "${item.name}" at ${currentPath}`);
                  }
                }

                // If it's a folder and we haven't exceeded depth, recursively search it
                if (item.folder && item.id && depth < MAX_DEPTH - 1 && shouldContinueSearching()) {
                  try {
                    const folderEndpoint = `/me/drive/items/${item.id}/children`;
                    const newPath = currentPath === '/' 
                      ? `/${item.name}` 
                      : `${currentPath}/${item.name}`;
                    
                    await searchFolder(folderEndpoint, newPath, depth + 1);
                  } catch (folderError) {
                    // Log but continue searching other folders
                    console.warn(`[Azure] Error searching OneDrive folder ${item.name}:`, folderError);
                  }
                }
              }
              
              // Handle pagination
              if (response['@odata.nextLink']) {
                try {
                  const nextResponse = await client.api(response['@odata.nextLink']).get();
                  if (nextResponse.value && nextResponse.value.length > 0) {
                    for (const item of nextResponse.value) {
                      if (!shouldContinueSearching()) {
                        break;
                      }
                      
                      if (matchesPattern(item.name)) {
                        if (skippedCount < skip) {
                          skippedCount++;
                          onedriveResultsCount++;
                        } else if (allResults.length < limit) {
                          onedriveResultsCount++;
                          allResults.push({
                            ...item,
                            source: 'onedrive',
                            path: currentPath,
                          });
                        }
                      }
                      
                      if (item.folder && item.id && depth < MAX_DEPTH - 1 && shouldContinueSearching()) {
                        try {
                          const folderEndpoint = `/me/drive/items/${item.id}/children`;
                          const newPath = currentPath === '/' 
                            ? `/${item.name}` 
                            : `${currentPath}/${item.name}`;
                          await searchFolder(folderEndpoint, newPath, depth + 1);
                        } catch (folderError) {
                          console.warn(`[Azure] Error searching OneDrive folder ${item.name}:`, folderError);
                        }
                      }
                    }
                  }
                } catch (paginationError) {
                  console.warn(`[Azure] Error fetching next page:`, paginationError);
                }
              }
            } catch (error) {
              console.error(`[Azure] Error searching OneDrive folder at ${endpoint}:`, error);
            }
          };

            // Start folder search from root (only if we don't have enough results yet)
            if (allResults.length < limit) {
              await searchFolder('/me/drive/root/children', '/', 0);
            }
            console.log(`[Azure] OneDrive search completed: Found ${onedriveResultsCount} matching files`);
          } catch (onedriveError) {
            console.error(`[Azure] Error searching OneDrive:`, onedriveError);
          }
        };
        
        searchPromises.push(searchOneDriveFiles());
      }

      // SharePoint search function
      if (searchSharePoint) {
        const searchSharePointFiles = async (): Promise<void> => {
          console.log(`[Azure] Searching SharePoint sites...`);
          try {
          // Get all SharePoint sites
          const sitesResponse = await client
            .api('/sites?search=*')
            .top(20) // Limit to 20 sites to prevent hanging
            .get();

          const sites = sitesResponse.value || [];
          console.log(`[Azure] Found ${sites.length} SharePoint sites to search`);

          const MAX_DEPTH = maxDepthSharePoint; // Use parameter for progressive depth
          const MAX_ITEMS_PER_FOLDER = 100; // Reduced for faster search
          
          let sharepointResultsCount = 0;
          const targetResults = limit + skip;
          
          // Early exit if we have enough results
          const shouldContinueSearching = () => allResults.length < limit && skippedCount + allResults.length < targetResults;

          const searchSharePointFolder = async (
            endpoint: string,
            siteName: string,
            currentPath: string = '/',
            depth: number = 0
          ): Promise<void> => {
            if (depth >= MAX_DEPTH) {
              return;
            }

            try {
              const response = await client
                .api(endpoint)
                .top(MAX_ITEMS_PER_FOLDER)
                .get();

              const items = response.value || [];

              for (const item of items) {
                if (!shouldContinueSearching()) {
                  break;
                }
                
                if (matchesPattern(item.name)) {
                  if (skippedCount < skip) {
                    skippedCount++;
                    sharepointResultsCount++;
                  } else if (allResults.length < limit) {
                    sharepointResultsCount++;
                    allResults.push({
                      ...item,
                      source: 'sharepoint',
                      siteName,
                      path: currentPath,
                    });
                    
                    console.log(`[Azure] ✓ SharePoint match: "${item.name}" at ${siteName}${currentPath}`);
                  }
                }

                if (item.folder && item.id && depth < MAX_DEPTH - 1 && shouldContinueSearching()) {
                  try {
                    // Use siteId from parentReference or construct from endpoint
                    const siteId = item.parentReference?.siteId || endpoint.match(/sites\/([^\/]+)/)?.[1];
                    if (!siteId) {
                      console.warn(`[Azure] Cannot determine siteId for folder ${item.name}`);
                      continue;
                    }
                    
                    const folderEndpoint = `/sites/${siteId}/drive/items/${item.id}/children`;
                    const newPath = currentPath === '/' 
                      ? `/${item.name}` 
                      : `${currentPath}/${item.name}`;
                    
                    await searchSharePointFolder(folderEndpoint, siteName, newPath, depth + 1);
                  } catch (folderError: any) {
                    // Skip 404 errors (resource not found) but log others
                    if (folderError?.statusCode !== 404) {
                      console.warn(`[Azure] Error searching SharePoint folder ${item.name}:`, folderError?.message || folderError);
                    }
                  }
                }
              }
              
              // Handle pagination
              if (response['@odata.nextLink']) {
                try {
                  const nextResponse = await client.api(response['@odata.nextLink']).get();
                  if (nextResponse.value && nextResponse.value.length > 0) {
                    for (const item of nextResponse.value) {
                      if (!shouldContinueSearching()) {
                        break;
                      }
                      
                      if (matchesPattern(item.name)) {
                        if (skippedCount < skip) {
                          skippedCount++;
                          sharepointResultsCount++;
                        } else if (allResults.length < limit) {
                          sharepointResultsCount++;
                          allResults.push({
                            ...item,
                            source: 'sharepoint',
                            siteName,
                            path: currentPath,
                          });
                        }
                      }
                      
                      if (item.folder && item.id && depth < MAX_DEPTH - 1 && shouldContinueSearching()) {
                        try {
                          const siteId = item.parentReference?.siteId || endpoint.match(/sites\/([^\/]+)/)?.[1];
                          if (siteId) {
                            const folderEndpoint = `/sites/${siteId}/drive/items/${item.id}/children`;
                            const newPath = currentPath === '/' 
                              ? `/${item.name}` 
                              : `${currentPath}/${item.name}`;
                            await searchSharePointFolder(folderEndpoint, siteName, newPath, depth + 1);
                          }
                        } catch (folderError) {
                          // Continue
                        }
                      }
                    }
                  }
                } catch (paginationError) {
                  console.warn(`[Azure] Error fetching SharePoint next page:`, paginationError);
                }
              }
            } catch (error: any) {
              // Skip 404 errors but log others
              if (error?.statusCode !== 404) {
                console.error(`[Azure] Error searching SharePoint folder at ${endpoint}:`, error?.message || error);
              }
            }
          };

          // Search each site with limited depth
          for (const site of sites) {
            try {
              console.log(`[Azure] Searching SharePoint site: ${site.displayName}`);
              // Try to get the drive for this site
              let driveEndpoint = `/sites/${site.id}/drive/root/children`;
              
              // First check if site has a drive
              try {
                await searchSharePointFolder(driveEndpoint, site.displayName, '/', 0);
              } catch (siteDriveError: any) {
                // If drive not found (404), skip this site
                if (siteDriveError?.statusCode === 404 || siteDriveError?.code === 'itemNotFound') {
                  console.log(`[Azure] Site "${site.displayName}" has no drive or drive not accessible, skipping`);
                } else {
                  throw siteDriveError;
                }
              }
            } catch (siteError: any) {
              // Skip 404 errors but log others
              if (siteError?.statusCode !== 404 && siteError?.code !== 'itemNotFound') {
                console.warn(`[Azure] Error searching site ${site.displayName}:`, siteError?.message || siteError);
              }
              // Continue with other sites
            }
          }
          
            console.log(`[Azure] SharePoint search completed: Found ${sharepointResultsCount} matching files`);
          } catch (sharePointError) {
            console.error(`[Azure] Error accessing SharePoint sites:`, sharePointError);
          }
        };
        
        searchPromises.push(searchSharePointFiles());
      }

      // Run searches in parallel
      if (searchPromises.length > 0) {
        await Promise.allSettled(searchPromises);
      }

      // Results are already limited by the logic above
      const finalResults = allResults;
      
      console.log(`[Azure] Search completed: Found ${finalResults.length} results (showing ${skip} to ${skip + finalResults.length - 1})`);
      
      // Log sample results for debugging
      if (finalResults.length > 0) {
        console.log(`[Azure] Sample results (first 3):`, 
          finalResults.slice(0, 3).map(r => ({
            name: r.name,
            source: r.source,
            path: r.path,
            site: r.siteName
          }))
        );
      } else {
        console.log(`[Azure] No results found for query "${searchQuery}" (regex: ${regexPattern})`);
      }
      
      return finalResults;
    } catch (error) {
      console.error(`[Azure] Graph API Error for file search:`, error);
      if (error instanceof Error) {
        console.error(`[Azure] Error message: ${error.message}`);
        console.error(`[Azure] Error stack: ${error.stack}`);
      }
      throw error;
    }
  }
}

