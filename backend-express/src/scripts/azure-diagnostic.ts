/**
 * Azure AD Configuration Diagnostic Tool
 * 
 * This script checks your Azure AD app registration configuration
 * and identifies issues that might be causing "Need admin approval" errors.
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../../.env') });

interface DiagnosticResult {
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: string;
}

class AzureDiagnostic {
  private clientId: string | undefined;
  private clientSecret: string | undefined;
  private tenantId: string | undefined;
  private redirectUri: string | undefined;

  constructor() {
    this.clientId = process.env.AZURE_CLIENT_ID;
    this.clientSecret = process.env.AZURE_CLIENT_SECRET;
    this.tenantId = process.env.AZURE_TENANT_ID;
    this.redirectUri = process.env.AZURE_REDIRECT_URI || 'http://localhost:3001/api/azure/callback';
  }

  async runDiagnostics(): Promise<void> {
    console.log('🔍 Azure AD Configuration Diagnostic Tool\n');
    console.log('=' .repeat(60));
    console.log('');

    const results: DiagnosticResult[] = [];

    // 1. Check environment variables
    results.push(...this.checkEnvironmentVariables());

    // 2. Check Azure AD app registration (if we have credentials)
    if (this.clientId && this.clientSecret && this.tenantId) {
      try {
        const appResults = await this.checkAppRegistration();
        results.push(...appResults);
      } catch (error) {
        results.push({
          status: 'warning',
          message: 'Could not check app registration via API',
          details: `Error: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    }

    // 3. Check required permissions
    results.push(...this.checkRequiredPermissions());

    // 4. Display results
    this.displayResults(results);

    // 5. Provide recommendations
    this.provideRecommendations(results);
  }

  private checkEnvironmentVariables(): DiagnosticResult[] {
    const results: DiagnosticResult[] = [];

    console.log('📋 Checking Environment Variables...\n');

    // Check AZURE_CLIENT_ID
    if (!this.clientId || this.clientId.includes('<') || this.clientId.includes('your-')) {
      results.push({
        status: 'fail',
        message: 'AZURE_CLIENT_ID is not set or contains placeholder value',
        details: `Current value: ${this.clientId || 'undefined'}`
      });
      console.log('  ❌ AZURE_CLIENT_ID: Missing or invalid');
    } else {
      results.push({
        status: 'pass',
        message: 'AZURE_CLIENT_ID is configured',
        details: `Value: ${this.clientId.substring(0, 8)}...`
      });
      console.log('  ✅ AZURE_CLIENT_ID: Configured');
    }

    // Check AZURE_CLIENT_SECRET
    if (!this.clientSecret || this.clientSecret.includes('<') || this.clientSecret.includes('your-')) {
      results.push({
        status: 'fail',
        message: 'AZURE_CLIENT_SECRET is not set or contains placeholder value',
        details: `Current value: ${this.clientSecret || 'undefined'}`
      });
      console.log('  ❌ AZURE_CLIENT_SECRET: Missing or invalid');
    } else {
      results.push({
        status: 'pass',
        message: 'AZURE_CLIENT_SECRET is configured',
        details: 'Value: [Hidden]'
      });
      console.log('  ✅ AZURE_CLIENT_SECRET: Configured');
    }

    // Check AZURE_TENANT_ID
    if (!this.tenantId) {
      results.push({
        status: 'warning',
        message: 'AZURE_TENANT_ID is not set (will use "common")',
        details: 'This is acceptable for multi-tenant scenarios'
      });
      console.log('  ⚠️  AZURE_TENANT_ID: Not set (will use "common")');
    } else {
      results.push({
        status: 'pass',
        message: 'AZURE_TENANT_ID is configured',
        details: `Value: ${this.tenantId}`
      });
      console.log('  ✅ AZURE_TENANT_ID: Configured');
    }

    // Check AZURE_REDIRECT_URI
    results.push({
      status: 'pass',
      message: 'AZURE_REDIRECT_URI is configured',
      details: `Value: ${this.redirectUri}`
    });
    console.log(`  ✅ AZURE_REDIRECT_URI: ${this.redirectUri}`);
    console.log('');

    return results;
  }

  private async checkAppRegistration(): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = [];

    console.log('📱 Checking Azure AD App Registration...\n');

    try {
      // Get access token for Microsoft Graph API
      const token = await this.getGraphApiToken();
      if (!token) {
        results.push({
          status: 'warning',
          message: 'Could not authenticate to check app registration',
          details: 'Check your CLIENT_ID and CLIENT_SECRET'
        });
        return results;
      }

      // Get app registration details
      const appUrl = `https://graph.microsoft.com/v1.0/applications(appId='${this.clientId}')`;
      const response = await fetch(appUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        results.push({
          status: 'fail',
          message: 'App registration not found or inaccessible',
          details: `HTTP ${response.status}: ${await response.text()}`
        });
        console.log('  ❌ App registration: Not found or inaccessible');
        return results;
      }

      const app = await response.json() as any;
      results.push({
        status: 'pass',
        message: 'App registration found',
        details: `App Name: ${app.displayName || 'N/A'}`
      });
      console.log(`  ✅ App registration found: ${app.displayName || 'N/A'}`);

      // Check redirect URIs
      const redirectUris = app.web?.redirectUris || [];
      const hasCorrectRedirect = redirectUris.some((uri: string) => 
        uri.includes(this.redirectUri || '')
      );

      if (!hasCorrectRedirect) {
        results.push({
          status: 'fail',
          message: 'Redirect URI not configured in Azure Portal',
          details: `Expected: ${this.redirectUri}, Found: ${redirectUris.join(', ')}`
        });
        console.log(`  ❌ Redirect URI: Not configured correctly`);
        console.log(`     Expected: ${this.redirectUri}`);
        console.log(`     Configured: ${redirectUris.join(', ') || 'None'}`);
      } else {
        results.push({
          status: 'pass',
          message: 'Redirect URI is configured correctly',
          details: `Found: ${this.redirectUri}`
        });
        console.log(`  ✅ Redirect URI: Configured correctly`);
      }

      // Get required resource access (permissions)
      const requiredResourceAccess = app.requiredResourceAccess || [];
      const graphResource = requiredResourceAccess.find((r: any) => 
        r.resourceAppId === '00000003-0000-0000-c000-000000000000' // Microsoft Graph
      );

      if (!graphResource) {
        results.push({
          status: 'fail',
          message: 'Microsoft Graph API permissions not configured',
          details: 'You need to add Microsoft Graph API permissions'
        });
        console.log('  ❌ Microsoft Graph permissions: Not configured');
      } else {
        const requiredScopes = [
          'Calendars.Read',
          'Files.Read.All',
          'Sites.Read.All',
          'User.Read'
        ];

        const configuredScopes = graphResource.resourceAccess
          .filter((ra: any) => ra.type === 'Scope')
          .map((ra: any) => ra.id)
          .map((id: string) => this.scopeIdToName(id));

        const missingScopes = requiredScopes.filter(scope => 
          !configuredScopes.includes(scope)
        );

        if (missingScopes.length > 0) {
          results.push({
            status: 'fail',
            message: 'Missing required API permissions',
            details: `Missing: ${missingScopes.join(', ')}`
          });
          console.log('  ❌ Required permissions: Missing');
          console.log(`     Missing: ${missingScopes.join(', ')}`);
          console.log(`     Configured: ${configuredScopes.join(', ') || 'None'}`);
        } else {
          results.push({
            status: 'pass',
            message: 'All required API permissions are configured',
            details: `Scopes: ${configuredScopes.join(', ')}`
          });
          console.log('  ✅ Required permissions: All configured');
          console.log(`     Permissions: ${configuredScopes.join(', ')}`);
        }
      }

      console.log('');

    } catch (error) {
      results.push({
        status: 'fail',
        message: 'Error checking app registration',
        details: error instanceof Error ? error.message : String(error)
      });
      console.log(`  ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      console.log('');
    }

    return results;
  }

  private async getGraphApiToken(): Promise<string | null> {
    if (!this.clientId || !this.clientSecret || !this.tenantId) {
      return null;
    }

    try {
      const tokenUrl = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;
      const params = new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials'
      });

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json() as any;
      return data.access_token || null;
    } catch (error) {
      return null;
    }
  }

  private scopeIdToName(id: string): string {
    // Microsoft Graph scope IDs to names mapping
    const scopeMap: Record<string, string> = {
      'e1fe6dd8-ba31-4d61-89e7-88639da4683d': 'User.Read',
      '465a38f9-76ea-45b9-9f6f-9db2fe5f28a9': 'Calendars.Read',
      'f430294d-f427-4e91-9e93-05818c258114': 'Files.Read.All',
      'd13f72ca-a275-4b96-b789-48ebcc4da984': 'Sites.Read.All',
    };

    return scopeMap[id] || id;
  }

  private checkRequiredPermissions(): DiagnosticResult[] {
    const results: DiagnosticResult[] = [];

    console.log('🔐 Checking Required Permissions...\n');

    const requiredPermissions = [
      { name: 'Calendars.Read', adminConsent: false, description: 'Read calendar events' },
      { name: 'Files.Read.All', adminConsent: true, description: 'Read OneDrive files (REQUIRES ADMIN CONSENT)' },
      { name: 'Sites.Read.All', adminConsent: true, description: 'Read SharePoint sites (REQUIRES ADMIN CONSENT)' },
      { name: 'User.Read', adminConsent: false, description: 'Read user profile' }
    ];

    requiredPermissions.forEach(perm => {
      if (perm.adminConsent) {
        results.push({
          status: 'warning',
          message: `${perm.name} requires admin consent`,
          details: perm.description
        });
        console.log(`  ⚠️  ${perm.name}: ${perm.description}`);
      } else {
        results.push({
          status: 'pass',
          message: `${perm.name} allows user consent`,
          details: perm.description
        });
        console.log(`  ✅ ${perm.name}: ${perm.description}`);
      }
    });

    console.log('');

    return results;
  }

  private displayResults(results: DiagnosticResult[]): void {
    console.log('📊 Diagnostic Results Summary\n');
    console.log('=' .repeat(60));
    console.log('');

    const passes = results.filter(r => r.status === 'pass').length;
    const warnings = results.filter(r => r.status === 'warning').length;
    const failures = results.filter(r => r.status === 'fail').length;

    console.log(`✅ Passed: ${passes}`);
    console.log(`⚠️  Warnings: ${warnings}`);
    console.log(`❌ Failed: ${failures}`);
    console.log('');

    if (failures > 0) {
      console.log('❌ FAILED CHECKS:\n');
      results.filter(r => r.status === 'fail').forEach(result => {
        console.log(`   • ${result.message}`);
        if (result.details) {
          console.log(`     ${result.details}`);
        }
        console.log('');
      });
    }

    if (warnings > 0) {
      console.log('⚠️  WARNINGS:\n');
      results.filter(r => r.status === 'warning').forEach(result => {
        console.log(`   • ${result.message}`);
        if (result.details) {
          console.log(`     ${result.details}`);
        }
        console.log('');
      });
    }
  }

  private provideRecommendations(results: DiagnosticResult[]): void {
    const failures = results.filter(r => r.status === 'fail');
    const warnings = results.filter(r => r.status === 'warning');

    if (failures.length === 0 && warnings.length === 0) {
      console.log('✅ All checks passed! Your configuration looks good.\n');
      return;
    }

    console.log('💡 Recommendations:\n');
    console.log('=' .repeat(60));
    console.log('');

    // Check for missing environment variables
    const missingEnvVars = failures.filter(r => 
      r.message.includes('AZURE_CLIENT_ID') || 
      r.message.includes('AZURE_CLIENT_SECRET')
    );

    if (missingEnvVars.length > 0) {
      console.log('1. Configure Environment Variables:');
      console.log('   - Add AZURE_CLIENT_ID to backend-express/.env');
      console.log('   - Add AZURE_CLIENT_SECRET to backend-express/.env');
      console.log('   - Get these values from Azure Portal > App registrations > TestApp > Overview');
      console.log('');
    }

    // Check for missing redirect URI
    const missingRedirect = failures.filter(r => r.message.includes('Redirect URI'));
    if (missingRedirect.length > 0) {
      console.log('2. Configure Redirect URI in Azure Portal:');
      console.log('   - Go to Azure Portal > App registrations > TestApp > Authentication');
      console.log(`   - Add redirect URI: ${this.redirectUri}`);
      console.log('   - Type: Web');
      console.log('');
    }

    // Check for missing permissions
    const missingPermissions = failures.filter(r => r.message.includes('permissions'));
    if (missingPermissions.length > 0) {
      console.log('3. Add API Permissions in Azure Portal:');
      console.log('   - Go to Azure Portal > App registrations > TestApp > API permissions');
      console.log('   - Click "+ Add a permission"');
      console.log('   - Select "Microsoft APIs" > "Microsoft Graph"');
      console.log('   - Select "Delegated permissions"');
      console.log('   - Add these permissions:');
      console.log('     • Calendars.Read');
      console.log('     • Files.Read.All');
      console.log('     • Sites.Read.All');
      console.log('     • User.Read');
      console.log('   - Click "Add permissions"');
      console.log('');
    }

    // Admin consent warnings
    const adminConsentWarnings = warnings.filter(r => 
      r.message.includes('requires admin consent')
    );

    if (adminConsentWarnings.length > 0) {
      console.log('4. Grant Admin Consent (REQUIRED to fix "Need admin approval" error):');
      console.log('');
      console.log('   Option A - Via Azure Portal:');
      console.log('   - Go to Azure Portal > App registrations > TestApp > API permissions');
      console.log('   - Click "Grant admin consent for [Your Organization]" button at the top');
      console.log('   - Click "Yes" to confirm');
      console.log('');
      console.log('   Option B - Via Admin Consent URL:');
      console.log(`   - Visit: https://login.microsoftonline.com/${this.tenantId || 'YOUR_TENANT_ID'}/adminconsent?client_id=${this.clientId || 'YOUR_CLIENT_ID'}`);
      console.log('   - Sign in with an admin account');
      console.log('   - Click "Accept" to grant consent');
      console.log('');
      console.log('   ⚠️  IMPORTANT: Admin consent is required for:');
      console.log('      • Files.Read.All (OneDrive access)');
      console.log('      • Sites.Read.All (SharePoint access)');
      console.log('      Without admin consent, users will see "Need admin approval" screen');
      console.log('');
    }

    console.log('=' .repeat(60));
    console.log('');
    console.log('📚 For detailed setup instructions, see:');
    console.log('   - AZURE_SETUP.md');
    console.log('   - AZURE_ADMIN_CONSENT.md');
    console.log('');
  }
}

// Run diagnostics
const diagnostic = new AzureDiagnostic();
diagnostic.runDiagnostics().catch(error => {
  console.error('Error running diagnostics:', error);
  process.exit(1);
});

