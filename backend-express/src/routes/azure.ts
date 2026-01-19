import express, { Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { sendSuccess, sendError, sendUnauthorized } from '../utils/response';
import { AzureService } from '../services/azure.service';
import { InteractionService } from '../services/interaction.service';

const router = express.Router();

/**
 * GET /api/azure/connect
 * Initiate OAuth flow - redirects to Microsoft login
 */
router.get('/connect', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;

    if (!userId) {
      return sendUnauthorized(res, 'Authentication required');
    }

    const authUrl = await AzureService.getAuthUrl(userId);
    res.redirect(authUrl);
  } catch (error) {
    console.error('Azure connect error:', error);
    sendError(res, 'Failed to initiate Azure connection', 500);
  }
});

/**
 * GET /api/azure/callback
 * OAuth callback handler - receives authorization code from Microsoft
 */
router.get('/callback', async (req: Request, res: Response) => {
  try {
    const code = req.query.code as string;
    const state = req.query.state as string;
    const error = req.query.error as string;

    if (error) {
      console.error('Azure OAuth error:', error);
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3001'}/profile?azure_error=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3001'}/profile?azure_error=missing_code`);
    }

    const userId = parseInt(state, 10);

    if (isNaN(userId)) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3001'}/profile?azure_error=invalid_state`);
    }

    // Exchange code for tokens
    const tokenResponse = await AzureService.acquireTokenByCode(code, state);

    if (!tokenResponse.accessToken) {
      console.error('Azure callback: No access token in response');
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3001'}/profile?azure_error=no_token`);
    }

    // MSAL stores refresh tokens internally in the cache
    // We need to get it from the account or use acquireTokenSilent later
    // For now, we'll store the account info and access token
    const refreshToken = (tokenResponse as any).refreshToken || undefined;
    
    if (!refreshToken) {
      console.warn('Azure callback: No refresh token in response - MSAL may store it in cache');
    }

    console.log(`Azure callback: Saving tokens for user ${userId}, has refreshToken: ${!!refreshToken}, accountId: ${tokenResponse.account?.homeAccountId}`);

    // Save tokens to database
    const expiresAt = tokenResponse.expiresOn 
      ? new Date(tokenResponse.expiresOn.getTime()) 
      : new Date(Date.now() + 3600000); // 1 hour default

    try {
      await AzureService.saveTokens(
        userId,
        tokenResponse.accessToken,
        refreshToken,
        expiresAt,
        tokenResponse.tenantId,
        tokenResponse.account?.homeAccountId // Store account ID for silent token refresh
      );
      
      // Log account ID for debugging (used by MSAL cache for silent refresh)
      if (tokenResponse.account?.homeAccountId) {
        console.log(`Azure callback: Account ID ${tokenResponse.account.homeAccountId} stored for future silent token refresh`);
      }
      console.log(`Azure callback: Successfully saved tokens for user ${userId}`);
    } catch (saveError) {
      console.error('Azure callback: Error saving tokens:', saveError);
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3001'}/profile?azure_error=save_failed`);
    }

    // Redirect to frontend with success
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3001'}/profile?azure_connected=true`);
  } catch (error) {
    console.error('Azure callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3001'}/profile?azure_error=callback_failed`);
  }
});

/**
 * GET /api/azure/status
 * Check if user has Azure connected
 */
router.get('/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;

    if (!userId) {
      return sendUnauthorized(res, 'Authentication required');
    }

    const isConnected = await AzureService.isConnected(userId);

    return sendSuccess(res, { connected: isConnected }, 'Azure connection status retrieved');
  } catch (error) {
    console.error('Azure status error:', error);
    sendError(res, 'Failed to check Azure connection status', 500);
  }
});

/**
 * POST /api/azure/refresh-token
 * Attempt to refresh Azure access token
 */
router.post('/refresh-token', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;

    if (!userId) {
      return sendUnauthorized(res, 'Authentication required');
    }

    // Attempt to refresh the token
    const newToken = await AzureService.getValidAccessToken(userId);
    
    return sendSuccess(res, { refreshed: true }, 'Azure token refreshed successfully');
  } catch (error) {
    console.error('Azure refresh token error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to refresh token';
    
    // Check if it's a token expiration/refresh failure
    if (errorMessage.includes('expired') || errorMessage.includes('refresh') || errorMessage.includes('reconnect')) {
      return sendError(res, 'Token refresh failed. Please reconnect your Azure account.', 401);
    }
    
    return sendError(res, errorMessage, 500);
  }
});

/**
 * POST /api/azure/disconnect
 * Disconnect Azure account
 */
router.post('/disconnect', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;

    if (!userId) {
      return sendUnauthorized(res, 'Authentication required');
    }

    await AzureService.disconnectAccount(userId);

    return sendSuccess(res, null, 'Azure account disconnected successfully');
  } catch (error) {
    console.error('Azure disconnect error:', error);
    sendError(res, 'Failed to disconnect Azure account', 500);
  }
});

/**
 * GET /api/azure/calendar/events
 * Get calendar events from Outlook
 */
router.get('/calendar/events', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;

    if (!userId) {
      console.log(`[Azure API] /calendar/events: Unauthorized - no userId in session`);
      return sendUnauthorized(res, 'Authentication required');
    }

    const startDate = req.query.startDate 
      ? new Date(req.query.startDate as string) 
      : undefined;
    const endDate = req.query.endDate 
      ? new Date(req.query.endDate as string) 
      : undefined;

    console.log(`[Azure API] GET /calendar/events: User ${userId}, startDate: ${startDate?.toISOString() || 'undefined'}, endDate: ${endDate?.toISOString() || 'undefined'}`);

    const events = await AzureService.getCalendarEvents(userId, startDate, endDate);

    console.log(`[Azure API] /calendar/events: Returning ${events.length} events to user ${userId}`);
    
    return sendSuccess(res, { events }, 'Calendar events retrieved successfully');
  } catch (error) {
    console.error('[Azure API] Get calendar events error:', error);
    
      if (error instanceof Error) {
        console.error('[Azure API] Error message:', error.message);
        console.error('[Azure API] Error stack:', error.stack);
        
        if (error.message.includes('not connected')) {
          return sendError(res, 'Azure account not connected. Please connect your Azure account.', 400);
        }
        
        if (error.message.includes('refresh token') || error.message.includes('expired')) {
          return sendError(res, 'Azure token expired. Please reconnect your Azure account.', 401);
        }
      }

      sendError(res, 'Failed to retrieve calendar events', 500);
  }
});

/**
 * GET /api/azure/calendar/calendars
 * List available calendars with write permissions
 */
router.get('/calendar/calendars', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;

    if (!userId) {
      console.log(`[Azure API] /calendar/calendars: Unauthorized - no userId in session`);
      return sendUnauthorized(res, 'Authentication required');
    }

    console.log(`[Azure API] GET /calendar/calendars: User ${userId}`);

    const calendars = await AzureService.listCalendars(userId);

    console.log(`[Azure API] /calendar/calendars: Returning ${calendars.length} calendars to user ${userId}`);
    
    return sendSuccess(res, { calendars }, 'Calendars retrieved successfully');
  } catch (error) {
    console.error('[Azure API] Get calendars error:', error);
    
    if (error instanceof Error) {
      console.error('[Azure API] Error message:', error.message);
      console.error('[Azure API] Error stack:', error.stack);
      
      if (error.message.includes('not connected')) {
        return sendError(res, 'Azure account not connected. Please connect your Azure account.', 400);
      }
      
      if (error.message.includes('refresh token') || error.message.includes('expired')) {
        return sendError(res, 'Azure token expired. Please reconnect your Azure account.', 401);
      }
    }

    sendError(res, 'Failed to retrieve calendars', 500);
  }
});

/**
 * POST /api/azure/calendar/events
 * Create a new calendar event
 */
router.post('/calendar/events', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;

    if (!userId) {
      console.log(`[Azure API] /calendar/events POST: Unauthorized - no userId in session`);
      return sendUnauthorized(res, 'Authentication required');
    }

    const { calendarId, subject, start, end, location, body, isAllDay, recurrence } = req.body;

    if (!calendarId || !subject || !start || !end) {
      return sendError(res, 'Missing required fields: calendarId, subject, start, end', 400);
    }

    console.log(`[Azure API] POST /calendar/events: User ${userId}, Calendar ${calendarId}, Subject: ${subject}`);

    const event = await AzureService.createCalendarEvent(userId, calendarId, {
      subject,
      start,
      end,
      location,
      body,
      isAllDay,
      recurrence,
    });

    console.log(`[Azure API] /calendar/events: Event created successfully: ${event.id}`);
    
    // Auto-link calendar event to contacts (background, non-blocking)
    // Note: Attendees will be available once EventDialog is enhanced in Phase 2
    if (userId && event.attendees) {
      InteractionService.linkCalendarEvent(userId, event).catch(error => {
        console.error('Failed to auto-link calendar event to contacts:', error);
      });
    }
    
    return sendSuccess(res, { event }, 'Calendar event created successfully');
  } catch (error) {
    console.error('[Azure API] Create calendar event error:', error);
    
    if (error instanceof Error) {
      console.error('[Azure API] Error message:', error.message);
      console.error('[Azure API] Error stack:', error.stack);
      
      if (error.message.includes('not connected')) {
        return sendError(res, 'Azure account not connected. Please connect your Azure account.', 400);
      }
      
      if (error.message.includes('refresh token') || error.message.includes('expired')) {
        return sendError(res, 'Azure token expired. Please reconnect your Azure account.', 401);
      }
    }

    sendError(res, 'Failed to create calendar event', 500);
  }
});

/**
 * PUT /api/azure/calendar/events/:eventId
 * Update a calendar event
 */
router.put('/calendar/events/:eventId', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;

    if (!userId) {
      console.log(`[Azure API] /calendar/events PUT: Unauthorized - no userId in session`);
      return sendUnauthorized(res, 'Authentication required');
    }

    const { eventId } = req.params;
    const { calendarId, subject, start, end, location, body, isAllDay, recurrence, updateSeries } = req.body;

    if (!calendarId) {
      return sendError(res, 'Missing required field: calendarId', 400);
    }

    console.log(`[Azure API] PUT /calendar/events/${eventId}: User ${userId}, Calendar ${calendarId}, UpdateSeries: ${updateSeries || false}`);

    const event = await AzureService.updateCalendarEvent(
      userId,
      calendarId,
      eventId,
      {
        subject,
        start,
        end,
        location,
        body,
        isAllDay,
        recurrence,
      },
      updateSeries || false
    );

    console.log(`[Azure API] /calendar/events/${eventId}: Event updated successfully`);
    
    // Auto-link updated calendar event to contacts (background, non-blocking)
    if (userId && event.attendees) {
      InteractionService.linkCalendarEvent(userId, event).catch(error => {
        console.error('Failed to auto-link updated calendar event to contacts:', error);
      });
    }
    
    return sendSuccess(res, { event }, 'Calendar event updated successfully');
  } catch (error) {
    console.error('[Azure API] Update calendar event error:', error);
    
    if (error instanceof Error) {
      console.error('[Azure API] Error message:', error.message);
      console.error('[Azure API] Error stack:', error.stack);
      
      if (error.message.includes('not connected')) {
        return sendError(res, 'Azure account not connected. Please connect your Azure account.', 400);
      }
      
      if (error.message.includes('refresh token') || error.message.includes('expired')) {
        return sendError(res, 'Azure token expired. Please reconnect your Azure account.', 401);
      }
    }

    sendError(res, 'Failed to update calendar event', 500);
  }
});

/**
 * DELETE /api/azure/calendar/events/:eventId
 * Delete a calendar event
 */
router.delete('/calendar/events/:eventId', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;

    if (!userId) {
      console.log(`[Azure API] /calendar/events DELETE: Unauthorized - no userId in session`);
      return sendUnauthorized(res, 'Authentication required');
    }

    const { eventId } = req.params;
    const { calendarId, deleteSeries } = req.query;

    if (!calendarId) {
      return sendError(res, 'Missing required field: calendarId', 400);
    }

    console.log(`[Azure API] DELETE /calendar/events/${eventId}: User ${userId}, Calendar ${calendarId}, DeleteSeries: ${deleteSeries || false}`);

    await AzureService.deleteCalendarEvent(
      userId,
      calendarId as string,
      eventId,
      deleteSeries === 'true'
    );

    console.log(`[Azure API] /calendar/events/${eventId}: Event deleted successfully`);
    
    return sendSuccess(res, null, 'Calendar event deleted successfully');
  } catch (error) {
    console.error('[Azure API] Delete calendar event error:', error);
    
    if (error instanceof Error) {
      console.error('[Azure API] Error message:', error.message);
      console.error('[Azure API] Error stack:', error.stack);
      
      if (error.message.includes('not connected')) {
        return sendError(res, 'Azure account not connected. Please connect your Azure account.', 400);
      }
      
      if (error.message.includes('refresh token') || error.message.includes('expired')) {
        return sendError(res, 'Azure token expired. Please reconnect your Azure account.', 401);
      }
    }

    sendError(res, 'Failed to delete calendar event', 500);
  }
});

/**
 * GET /api/azure/documents/onedrive
 * Get OneDrive files
 */
router.get('/documents/onedrive', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;

    if (!userId) {
      console.log(`[Azure API] /documents/onedrive: Unauthorized - no userId in session`);
      return sendUnauthorized(res, 'Authentication required');
    }

    const folderPath = (req.query.folderPath as string) || '/';

    console.log(`[Azure API] GET /documents/onedrive: User ${userId}, folderPath: ${folderPath}`);

    const files = await AzureService.getOneDriveFiles(userId, folderPath);

    console.log(`[Azure API] /documents/onedrive: Returning ${files.length} files to user ${userId}`);

    return sendSuccess(res, { files }, 'OneDrive files retrieved successfully');
  } catch (error) {
    console.error('[Azure API] Get OneDrive files error:', error);
    
    if (error instanceof Error) {
      console.error('[Azure API] Error message:', error.message);
      console.error('[Azure API] Error stack:', error.stack);
      
      if (error.message.includes('not connected')) {
        return sendError(res, 'Azure account not connected', 400);
      }
    }

    sendError(res, 'Failed to retrieve OneDrive files', 500);
  }
});

/**
 * GET /api/azure/documents/sharepoint
 * Get SharePoint sites
 */
router.get('/documents/sharepoint', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;

    if (!userId) {
      return sendUnauthorized(res, 'Authentication required');
    }

    const siteId = req.query.siteId as string | undefined;
    const folderPath = (req.query.folderPath as string) || '/';

    let data;

    if (siteId) {
      // Get files from specific SharePoint site
      const files = await AzureService.getSharePointSiteFiles(userId, siteId, folderPath);
      data = { files };
    } else {
      // Get list of SharePoint sites
      const sites = await AzureService.getSharePointSites(userId);
      data = { sites };
    }

    return sendSuccess(res, data, 'SharePoint data retrieved successfully');
  } catch (error) {
    console.error('Get SharePoint data error:', error);
    
    if (error instanceof Error && error.message.includes('not connected')) {
      return sendError(res, 'Azure account not connected', 400);
    }

    sendError(res, 'Failed to retrieve SharePoint data', 500);
  }
});

/**
 * POST /api/azure/documents/search
 * Search files across OneDrive and SharePoint
 * Supports regex pattern matching
 */
router.post('/documents/search', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;

    if (!userId) {
      return sendUnauthorized(res, 'Authentication required');
    }

    const { 
      query, 
      useRegex = false, 
      searchOneDrive = true, 
      searchSharePoint = true,
      limit = 100,
      skip = 0
    } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return sendError(res, 'Search query is required', 400);
    }

    const limitNum = Math.min(parseInt(limit as string) || 100, 100); // Max 100 per request
    const skipNum = Math.max(parseInt(skip as string) || 0, 0);

    console.log(`[Azure API] POST /documents/search: User ${userId}, query: "${query}", useRegex: ${useRegex}, limit: ${limitNum}, skip: ${skipNum}`);

    // Progressive depth search: start with initial depth, increase if no results found
    const INITIAL_DEPTH_ONEDRIVE = 3;
    const INITIAL_DEPTH_SHAREPOINT = 2;
    const MAX_DEPTH_ONEDRIVE = 7; // Maximum safe depth for OneDrive
    const MAX_DEPTH_SHAREPOINT = 5; // Maximum safe depth for SharePoint
    const DEPTH_INCREMENT = 2; // Increase depth by 2 each retry

    let results: any[] = [];
    let currentDepthOneDrive = INITIAL_DEPTH_ONEDRIVE;
    let currentDepthSharePoint = INITIAL_DEPTH_SHAREPOINT;
    let attempt = 0;
    const MAX_ATTEMPTS = 3; // Maximum retry attempts

    while (results.length === 0 && attempt < MAX_ATTEMPTS) {
      attempt++;
      console.log(`[Azure API] Search attempt ${attempt}: OneDrive depth=${currentDepthOneDrive}, SharePoint depth=${currentDepthSharePoint}`);

      results = await AzureService.searchFiles(
        userId,
        query.trim(),
        useRegex === true,
        searchOneDrive === true,
        searchSharePoint === true,
        limitNum,
        skipNum,
        currentDepthOneDrive,
        currentDepthSharePoint
      );

      // If results found, break out of loop
      if (results.length > 0) {
        console.log(`[Azure API] Found ${results.length} results at attempt ${attempt}, stopping depth increase`);
        break;
      }

      // If no results and we haven't reached max attempts, increase depth and retry
      if (results.length === 0 && attempt < MAX_ATTEMPTS) {
        if (searchOneDrive && currentDepthOneDrive < MAX_DEPTH_ONEDRIVE) {
          currentDepthOneDrive = Math.min(currentDepthOneDrive + DEPTH_INCREMENT, MAX_DEPTH_ONEDRIVE);
          console.log(`[Azure API] No results found, increasing OneDrive depth to ${currentDepthOneDrive}`);
        }
        if (searchSharePoint && currentDepthSharePoint < MAX_DEPTH_SHAREPOINT) {
          currentDepthSharePoint = Math.min(currentDepthSharePoint + DEPTH_INCREMENT, MAX_DEPTH_SHAREPOINT);
          console.log(`[Azure API] No results found, increasing SharePoint depth to ${currentDepthSharePoint}`);
        }
        
        // If both depths are already at max, no point in retrying
        const oneDriveAtMax = !searchOneDrive || currentDepthOneDrive >= MAX_DEPTH_ONEDRIVE;
        const sharePointAtMax = !searchSharePoint || currentDepthSharePoint >= MAX_DEPTH_SHAREPOINT;
        if (oneDriveAtMax && sharePointAtMax) {
          console.log(`[Azure API] Both sources at max depth, stopping retries`);
          break;
        }
      }
    }

    console.log(`[Azure API] /documents/search: Found ${results.length} results for user ${userId} after ${attempt} attempt(s) (limit: ${limitNum}, skip: ${skipNum})`);
    
    if (results.length === 0 && attempt === MAX_ATTEMPTS) {
      console.log(`[Azure API] /documents/search: Exhausted all depth attempts. Final depths: OneDrive=${currentDepthOneDrive}, SharePoint=${currentDepthSharePoint}`);
    }

    // Return results with pagination info
    return sendSuccess(res, { 
      files: results,
      limit: limitNum,
      skip: skipNum,
      hasMore: results.length === limitNum, // Indicates more results might be available
      searchDepth: {
        oneDrive: currentDepthOneDrive,
        sharePoint: currentDepthSharePoint,
        attempts: attempt
      }
    }, 'Search completed successfully');
  } catch (error) {
    console.error('[Azure API] Search files error:', error);
    
    if (error instanceof Error) {
      console.error('[Azure API] Error message:', error.message);
      
      if (error.message.includes('not connected')) {
        return sendError(res, 'Azure account not connected', 400);
      }
      
      if (error.message.includes('Invalid regex')) {
        return sendError(res, error.message, 400);
      }
    }

    sendError(res, 'Failed to search files', 500);
  }
});

export default router;

