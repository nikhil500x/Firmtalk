import type { NextConfig } from "next";

// ============================================================================
// NEXT.JS CONFIGURATION
// ============================================================================

/**
 * Next.js Application Configuration
 * 
 * This file configures various aspects of the Next.js application including:
 * - Build behavior
 * - Development tools
 * - Image optimization
 * - Environment variables
 * - Compiler options
 * 
 * @see https://nextjs.org/docs/app/api-reference/next-config-js
 */
const nextConfig: NextConfig = {
  // ==========================================================================
  // OUTPUT MODE
  // Enable standalone output for minimal server footprint and reduced RAM usage
  // ==========================================================================
  output: 'standalone',

  // ==========================================================================
  // DEVELOPMENT INDICATORS
  // Controls the position of the build activity indicator during development
  // Note: In Next.js 15+, you cannot disable the indicator, only position it
  // ==========================================================================
  devIndicators: {
    /**
     * position: Position of the build indicator on screen
     * (Renamed from buildActivityPosition in Next.js 15+)
     * 
     * @default 'bottom-right'
     * @options 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
     */
    position: 'bottom-right',
  },

  // ==========================================================================
  // OUTPUT FILE TRACING
  // Silences workspace root detection warning
  // ==========================================================================
  /**
   * outputFileTracingRoot: Explicitly set the workspace root directory
   * This helps Next.js correctly trace dependencies in monorepos
   * 
   * Set to your project root directory (where the main package.json is)
   */
  outputFileTracingRoot: process.cwd(),

  // ==========================================================================
  // REWRITES
  // Proxy API requests to backend for same-origin cookie handling
  // ==========================================================================
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
