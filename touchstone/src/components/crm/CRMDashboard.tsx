'use client';

import React, { useCallback } from 'react';
import { Users, Building2, Network, TrendingUp, DollarSign, Target, Phone, Mail, Calendar, Briefcase } from 'lucide-react';
import { useWidgetData } from '@/hooks/useWidgetData';
import WidgetContainer from '@/components/dashboard/widgets/WidgetContainer';
import { apiRequest } from '@/lib/api';
import { API_ENDPOINTS } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

interface ContactsSummary {
  total: number;
  recent: Array<{
    id: number;
    name: string;
    email: string;
    clientName: string;
    createdAt: string;
  }>;
  byClient: Record<string, number>;
  withInteractions: number;
}

interface ClientsSummary {
  total: number;
  active: number;
  byIndustry: Record<string, number>;
  recent: Array<{
    id: number;
    companyName: string;
    industry: string;
    contactsCount: number;
    createdAt: string;
  }>;
}

interface OrganizationsSummary {
  total: number;
  withOrgCharts: number;
  totalRelationships: number;
  totalBadges: number;
}

interface OpportunitiesSummary {
  total: number;
  pipelineValue: number;
  active: number;
  byStage: Record<string, number>;
}

interface LeadsSummary {
  total: number;
  new: number;
  converted: number;
  conversionRate: number;
}

export default function CRMDashboard() {
  // ============================================================================
  // MAIN TABS DATA (Priority 1)
  // ============================================================================

  // Memoize fetch functions to prevent infinite loops
  const fetchContactsData = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await apiRequest<{ success: boolean; data: any[] }>(API_ENDPOINTS.contacts.list);
    if (!response.success || !response.data || !Array.isArray(response.data)) {
      return { total: 0, recent: [], byClient: {}, withInteractions: 0 };
    }

    const contacts = response.data;
    const recent = contacts
      .slice(0, 5)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((c: any) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        clientName: c.clientName || 'Unknown',
        createdAt: c.createdAt || new Date().toISOString(),
      }));

    const byClient: Record<string, number> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contacts.forEach((c: any) => {
      const clientName = c.clientName || 'Unknown';
      byClient[clientName] = (byClient[clientName] || 0) + 1;
    });

    return {
      total: contacts.length,
      recent,
      byClient,
      withInteractions: 0, // TODO: Calculate from interactions API
    };
  }, []);

  // Contacts Hub Widgets
  const contactsData = useWidgetData<ContactsSummary>({
    cacheKey: 'crm_contacts_summary',
    fetchFn: fetchContactsData,
  });

  const fetchClientsData = useCallback(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await apiRequest<{ success: boolean; data: any[]; message?: string }>(API_ENDPOINTS.clients.list);
      // If migration is required, return empty data instead of error
      if (!response.success || response.message?.includes('migration')) {
        return { total: 0, active: 0, byIndustry: {}, recent: [] };
      }
      if (!response.data || !Array.isArray(response.data)) {
        return { total: 0, active: 0, byIndustry: {}, recent: [] };
      }

      const clients = response.data;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const active = clients.filter((c: any) => c.status === 'Active').length;
      
      const byIndustry: Record<string, number> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      clients.forEach((c: any) => {
        const industry = c.industry || 'Other';
        byIndustry[industry] = (byIndustry[industry] || 0) + 1;
      });

      const recent = clients
        .slice(0, 5)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((c: any) => ({
          id: c.id,
          companyName: c.companyName,
          industry: c.industry || 'Other',
          contactsCount: c.contactsCount || 0,
          createdAt: c.createdAt || new Date().toISOString(),
        }));

      return {
        total: clients.length,
        active,
        byIndustry,
        recent,
      };
    } catch (error) {
      // Return empty data on any error
      return { total: 0, active: 0, byIndustry: {}, recent: [] };
    }
  }, []);

  // Clients Hub Widgets
  const clientsData = useWidgetData<ClientsSummary>({
    cacheKey: 'crm_clients_summary',
    fetchFn: fetchClientsData,
  });

  const fetchOrganizationsData = useCallback(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await apiRequest<{ success: boolean; data: any[] }>(API_ENDPOINTS.orgChart.mindmap);
      if (!response.success || !response.data || !Array.isArray(response.data)) {
        return { total: 0, withOrgCharts: 0, totalRelationships: 0, totalBadges: 0 };
      }

      const orgs = response.data;
      // Simplified: Just return the count, don't fetch individual org charts to avoid too many requests
      // Individual org chart details can be fetched on-demand when viewing a specific org
      return {
        total: orgs.length,
        withOrgCharts: 0, // Will be calculated on-demand when needed
        totalRelationships: 0, // Will be calculated on-demand when needed
        totalBadges: 0, // Will be calculated on-demand when needed
      };
    } catch {
      return { total: 0, withOrgCharts: 0, totalRelationships: 0, totalBadges: 0 };
    }
  }, []);

  // Organizations Widgets
  const organizationsData = useWidgetData<OrganizationsSummary>({
    cacheKey: 'crm_organizations_summary',
    fetchFn: fetchOrganizationsData,
    autoRefresh: false, // Disable auto-refresh since this makes many API calls
  });

  // ============================================================================
  // SECONDARY TABS DATA (Priority 2)
  // ============================================================================

  const fetchOpportunitiesData = useCallback(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await apiRequest<{ success: boolean; data: any }>(API_ENDPOINTS.opportunities.stats);
      if (!response.success || !response.data) {
        return { total: 0, pipelineValue: 0, active: 0, byStage: {} };
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stats = response.data as any;
      return {
        total: stats?.total || 0,
        pipelineValue: stats?.pipelineValue || 0,
        active: stats?.active || 0,
        byStage: stats?.byStage || {},
      };
    } catch {
      return { total: 0, pipelineValue: 0, active: 0, byStage: {} };
    }
  }, []);

  // Opportunities Widgets
  const opportunitiesData = useWidgetData<OpportunitiesSummary>({
    cacheKey: 'crm_opportunities_summary',
    fetchFn: fetchOpportunitiesData,
  });

  const fetchLeadsData = useCallback(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await apiRequest<{ success: boolean; data: any }>(API_ENDPOINTS.leads.stats);
      if (!response.success || !response.data) {
        return { total: 0, new: 0, converted: 0, conversionRate: 0 };
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stats = response.data as any;
      return {
        total: stats?.total || 0,
        new: stats?.byStatus?.new?._count || 0,
        converted: stats?.converted || 0,
        conversionRate: stats?.conversionRate || 0,
      };
    } catch {
      return { total: 0, new: 0, converted: 0, conversionRate: 0 };
    }
  }, []);

  // Leads Widgets
  const leadsData = useWidgetData<LeadsSummary>({
    cacheKey: 'crm_leads_summary',
    fetchFn: fetchLeadsData,
  });

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">CRM Overview</h2>
        <p className="text-sm text-gray-600 mt-1">Comprehensive view of your CRM metrics and performance</p>
      </div>

      {/* MAIN TABS WIDGETS (Priority 1) */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Core CRM</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Contacts Hub Widgets */}
          <WidgetContainer
            title="Total Contacts"
            icon={<Users className="h-5 w-5" />}
            loading={contactsData.loading}
            error={contactsData.error}
            onRefresh={contactsData.refresh}
            lastUpdated={contactsData.lastUpdated}
          >
            <div className="text-3xl font-bold text-gray-900">{contactsData.data?.total || 0}</div>
            <p className="text-sm text-gray-600 mt-1">All contacts across clients</p>
          </WidgetContainer>

          <WidgetContainer
            title="Recent Contacts"
            icon={<Users className="h-5 w-5" />}
            loading={contactsData.loading}
            error={contactsData.error}
            onRefresh={contactsData.refresh}
            lastUpdated={contactsData.lastUpdated}
          >
            <div className="space-y-2">
              {contactsData.data?.recent.length ? (
                contactsData.data.recent.slice(0, 3).map((contact) => (
                  <div key={contact.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium text-gray-900">{contact.name}</p>
                      <p className="text-gray-500 text-xs">{contact.clientName}</p>
                    </div>
                    <span className="text-xs text-gray-400">
                      {formatDistanceToNow(new Date(contact.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No recent contacts</p>
              )}
            </div>
          </WidgetContainer>

          <WidgetContainer
            title="Contacts by Client"
            icon={<Building2 className="h-5 w-5" />}
            loading={contactsData.loading}
            error={contactsData.error}
            onRefresh={contactsData.refresh}
            lastUpdated={contactsData.lastUpdated}
          >
            <div className="space-y-2">
              {Object.entries(contactsData.data?.byClient || {}).slice(0, 5).map(([client, count]) => (
                <div key={client} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 truncate">{client}</span>
                  <Badge variant="secondary">{count}</Badge>
                </div>
              ))}
              {Object.keys(contactsData.data?.byClient || {}).length === 0 && (
                <p className="text-sm text-gray-500">No data available</p>
              )}
            </div>
          </WidgetContainer>

          {/* Clients Hub Widgets */}
          <WidgetContainer
            title="Total Clients"
            icon={<Building2 className="h-5 w-5" />}
            loading={clientsData.loading}
            error={clientsData.error && !clientsData.error.includes('migration') ? clientsData.error : null}
            onRefresh={clientsData.refresh}
            lastUpdated={clientsData.lastUpdated}
          >
            <div className="text-3xl font-bold text-gray-900">{clientsData.data?.total || 0}</div>
            <p className="text-sm text-gray-600 mt-1">
              {clientsData.data?.active || 0} active
            </p>
          </WidgetContainer>

          <WidgetContainer
            title="Clients by Industry"
            icon={<Briefcase className="h-5 w-5" />}
            loading={clientsData.loading}
            error={clientsData.error && !clientsData.error.includes('migration') ? clientsData.error : null}
            onRefresh={clientsData.refresh}
            lastUpdated={clientsData.lastUpdated}
          >
            <div className="space-y-2">
              {Object.entries(clientsData.data?.byIndustry || {})
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .slice(0, 5)
                .map(([industry, count]) => (
                  <div key={industry} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 truncate">{industry}</span>
                    <Badge variant="secondary">{count as number}</Badge>
                  </div>
                ))}
              {Object.keys(clientsData.data?.byIndustry || {}).length === 0 && (
                <p className="text-sm text-gray-500">No data available</p>
              )}
            </div>
          </WidgetContainer>

          <WidgetContainer
            title="Recent Clients"
            icon={<Building2 className="h-5 w-5" />}
            loading={clientsData.loading}
            error={clientsData.error && !clientsData.error.includes('migration') ? clientsData.error : null}
            onRefresh={clientsData.refresh}
            lastUpdated={clientsData.lastUpdated}
          >
            <div className="space-y-2">
              {clientsData.data?.recent.length ? (
                clientsData.data.recent.slice(0, 3).map((client) => (
                  <div key={client.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium text-gray-900">{client.companyName}</p>
                      <p className="text-gray-500 text-xs">{client.contactsCount} contacts</p>
                    </div>
                    <span className="text-xs text-gray-400">
                      {formatDistanceToNow(new Date(client.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No recent clients</p>
              )}
            </div>
          </WidgetContainer>

          {/* Organizations Widgets */}
          <WidgetContainer
            title="Total Organizations"
            icon={<Network className="h-5 w-5" />}
            loading={organizationsData.loading}
            error={organizationsData.error}
            onRefresh={organizationsData.refresh}
            lastUpdated={organizationsData.lastUpdated}
          >
            <div className="text-3xl font-bold text-gray-900">{organizationsData.data?.total || 0}</div>
            <p className="text-sm text-gray-600 mt-1">
              {organizationsData.data?.withOrgCharts || 0} with org charts
            </p>
          </WidgetContainer>

          <WidgetContainer
            title="Org Chart Metrics"
            icon={<Network className="h-5 w-5" />}
            loading={organizationsData.loading}
            error={organizationsData.error}
            onRefresh={organizationsData.refresh}
            lastUpdated={organizationsData.lastUpdated}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Relationships</span>
                <span className="text-lg font-semibold text-gray-900">
                  {organizationsData.data?.totalRelationships || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Badges</span>
                <span className="text-lg font-semibold text-gray-900">
                  {organizationsData.data?.totalBadges || 0}
                </span>
              </div>
            </div>
          </WidgetContainer>
        </div>
      </div>

      {/* SECONDARY TABS WIDGETS (Priority 2) */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Pipeline & Leads</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <WidgetContainer
            title="Pipeline Value"
            icon={<DollarSign className="h-5 w-5" />}
            loading={opportunitiesData.loading}
            error={opportunitiesData.error}
            onRefresh={opportunitiesData.refresh}
            lastUpdated={opportunitiesData.lastUpdated}
          >
            <div className="text-3xl font-bold text-gray-900">
              ${((opportunitiesData.data?.pipelineValue || 0) / 1000).toFixed(1)}K
            </div>
            <p className="text-sm text-gray-600 mt-1">Total opportunity value</p>
          </WidgetContainer>

          <WidgetContainer
            title="Active Opportunities"
            icon={<Target className="h-5 w-5" />}
            loading={opportunitiesData.loading}
            error={opportunitiesData.error}
            onRefresh={opportunitiesData.refresh}
            lastUpdated={opportunitiesData.lastUpdated}
          >
            <div className="text-3xl font-bold text-gray-900">{opportunitiesData.data?.active || 0}</div>
            <p className="text-sm text-gray-600 mt-1">In pipeline</p>
          </WidgetContainer>

          <WidgetContainer
            title="Total Leads"
            icon={<Users className="h-5 w-5" />}
            loading={leadsData.loading}
            error={leadsData.error}
            onRefresh={leadsData.refresh}
            lastUpdated={leadsData.lastUpdated}
          >
            <div className="text-3xl font-bold text-gray-900">{leadsData.data?.total || 0}</div>
            <p className="text-sm text-gray-600 mt-1">{leadsData.data?.new || 0} new</p>
          </WidgetContainer>

          <WidgetContainer
            title="Conversion Rate"
            icon={<TrendingUp className="h-5 w-5" />}
            loading={leadsData.loading}
            error={leadsData.error}
            onRefresh={leadsData.refresh}
            lastUpdated={leadsData.lastUpdated}
          >
            <div className="text-3xl font-bold text-gray-900">
              {leadsData.data?.conversionRate?.toFixed(1) || '0.0'}%
            </div>
            <p className="text-sm text-gray-600 mt-1">
              {leadsData.data?.converted || 0} converted
            </p>
          </WidgetContainer>
        </div>
      </div>
    </div>
  );
}
