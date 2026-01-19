import 'dotenv/config'; // Load environment variables from .env file
import session from 'express-session';
import { RedisStore }from 'connect-redis';
import redisClient from './redis';


const redisStore = new RedisStore({
  client: redisClient,
  prefix: 'touchstone:sess:',
});

// Helper function to check if we're in production/staging (not localhost)
const isProduction = (): boolean => {
  // Check NODE_ENV first
  if (process.env.NODE_ENV === 'production') {
    return true;
  }
  
  // If NODE_ENV is not set, check FRONTEND_URL to determine if it's production/staging
  const frontendUrl = process.env.FRONTEND_URL;
  if (!frontendUrl) {
    return false;
  }
  
  try {
    const url = new URL(frontendUrl);
    const hostname = url.hostname;
    // If it's not localhost or an IP, assume it's production/staging
    return hostname !== 'localhost' && 
           hostname !== '127.0.0.1' && 
           !/^\d+\.\d+\.\d+\.\d+$/.test(hostname);
  } catch (error) {
    return false;
  }
};

// Helper function to extract cookie domain from FRONTEND_URL
const getCookieDomain = (): string | undefined => {
  const frontendUrl = process.env.FRONTEND_URL;
  if (!frontendUrl) {
    // For local development, return undefined (no domain restriction)
    // This ensures cookies work across different ports
    return undefined;
  }
  
  try {
    const url = new URL(frontendUrl);
    const hostname = url.hostname;
    
    // If it's an IP address or localhost, return undefined (no domain restriction for local dev)
    // This ensures cookies work across different ports (frontend on 3000, backend on 3001)
    if (hostname === 'localhost' || hostname === '127.0.0.1' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      return undefined;
    }
    
    // Extract base domain (e.g., touchstonepartners.com from staging.touchstonepartners.com)
    const parts = hostname.split('.');
    if (parts.length >= 2) {
      // Get the last two parts (e.g., ['touchstonepartners', 'com'])
      const baseDomain = parts.slice(-2).join('.');
      // Use leading dot for explicit subdomain support
      // This ensures cookies work across all subdomains (staging, www, etc.)
      const cookieDomain = `.${baseDomain}`;
      console.log(`[Session Config] Setting cookie domain to: ${cookieDomain} (from FRONTEND_URL: ${frontendUrl})`);
      return cookieDomain;
    }
    
    return undefined;
  } catch (error) {
    console.error('Error parsing FRONTEND_URL for cookie domain:', error);
    return undefined;
  }
};

const production = isProduction();
const cookieDomain = getCookieDomain();

console.log(`[Session Config] Production mode: ${production}, Cookie domain: ${cookieDomain || 'undefined'}, Secure: ${production}, SameSite: lax`);

// Session configuration
const sessionConfig: session.SessionOptions = {
  store: redisStore,
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-this-in-production',
  resave: false,
  saveUninitialized: true, // Create session even if nothing is stored (needed for cookie to be set)
  name: 'touchstone.sid',
  rolling: false, // Don't reset expiration on every request
  cookie: {
    secure: production, // true for HTTPS in production/staging
    httpOnly: true, // Prevent XSS attacks
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    sameSite: production ? 'lax' : 'lax', // 'lax' allows cookies to be sent in same-site and top-level navigations
    domain: cookieDomain,
    path: '/', // Explicitly set path to root so cookie is sent with all requests
  },
  // Trust proxy (nginx) for secure cookies - CRITICAL for HTTPS behind reverse proxy
  proxy: true,
};

export default session(sessionConfig);

