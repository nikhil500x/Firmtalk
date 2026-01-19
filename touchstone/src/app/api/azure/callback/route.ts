import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/azure/callback
 * Azure OAuth callback proxy - redirects to backend with all query parameters
 * 
 * This route receives the OAuth callback from Microsoft and proxies it to the backend.
 * It preserves all query parameters (code, state, error) for the OAuth flow.
 */
export async function GET(request: NextRequest) {
  try {
    // Get the backend URL from environment variables
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    
    // Get all query parameters from the request
    const searchParams = request.nextUrl.searchParams;
    const queryString = searchParams.toString();
    
    // Construct the backend callback URL with all query parameters
    const backendCallbackUrl = `${backendUrl}/api/azure/callback${queryString ? `?${queryString}` : ''}`;
    
    // Redirect to backend with all query parameters preserved
    return NextResponse.redirect(backendCallbackUrl);
  } catch (error) {
    console.error('Azure callback proxy error:', error);
    
    // Redirect to profile page with error on failure
    const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';
    return NextResponse.redirect(`${frontendUrl}/profile?azure_error=proxy_failed`);
  }
}

