'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, MoreVertical, User, Mail, Phone, Building, TrendingUp, CheckCircle, XCircle } from 'lucide-react';
import { API_ENDPOINTS, apiRequest } from '@/lib/api';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import LeadDialog from './LeadDialog';
import { toast } from 'react-toastify';

interface Lead {
  lead_id: number;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  source: string | null;
  status: string;
  score: number;
  practice_area_interest: string | null;
  estimated_value: number | null;
  assigned_to: number | null;
  notes: string | null;
  tags: string[];
  converted_to_client_id: number | null;
  converted_to_contact_id: number | null;
  created_at: string;
  updated_at: string;
  assignee: {
    user_id: number;
    name: string;
    email: string;
  } | null;
  converted_client: {
    client_id: number;
    client_name: string;
  } | null;
  converted_contact: {
    contact_id: number;
    name: string;
    email: string;
  } | null;
}

const statusColors: Record<string, { bg: string; text: string }> = {
  new: { bg: 'bg-blue-100', text: 'text-blue-700' },
  contacted: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  qualified: { bg: 'bg-green-100', text: 'text-green-700' },
  converted: { bg: 'bg-purple-100', text: 'text-purple-700' },
  lost: { bg: 'bg-red-100', text: 'text-red-700' },
};

const statusLabels: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  converted: 'Converted',
  lost: 'Lost',
};

export default function LeadsHub() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [showDialog, setShowDialog] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [dialogMode, setDialogMode] = useState<'add' | 'edit' | 'view'>('add');

  useEffect(() => {
    fetchLeads();
  }, [statusFilter, sourceFilter]);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (sourceFilter !== 'all') params.append('source', sourceFilter);
      if (searchTerm) params.append('search', searchTerm);

      const url = `${API_ENDPOINTS.leads.list}${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await apiRequest<{ data: Lead[] }>(url);
      
      if (response.success && response.data) {
        setLeads(Array.isArray(response.data) ? response.data : []);
      } else {
        setError('Failed to load leads');
      }
    } catch (err) {
      console.error('Error fetching leads:', err);
      setError(err instanceof Error ? err.message : 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchLeads();
  };

  const handleAddLead = () => {
    setSelectedLead(null);
    setDialogMode('add');
    setShowDialog(true);
  };

  const handleEditLead = (lead: Lead) => {
    setSelectedLead(lead);
    setDialogMode('edit');
    setShowDialog(true);
  };

  const handleViewLead = (lead: Lead) => {
    setSelectedLead(lead);
    setDialogMode('view');
    setShowDialog(true);
  };

  const handleConvertLead = async (leadId: number) => {
    if (!confirm('Convert this lead to a client and contact?')) {
      return;
    }

    try {
      const response = await apiRequest(API_ENDPOINTS.leads.convert(leadId), {
        method: 'POST',
        body: JSON.stringify({ create_contact: true }),
      });

      if (response.success) {
        // alert('Lead converted successfully!');
        toast.success('Lead converted successfully!');
        fetchLeads();
      } else {
        // alert(response.message || 'Failed to convert lead');
        toast.error(response.message || 'Failed to convert lead');
      }
    } catch (err) {
      console.error('Error converting lead:', err);
      // alert('Failed to convert lead');
      toast.error('Failed to convert lead');
    }
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading && leads.length === 0) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error && leads.length === 0) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={fetchLeads} variant="outline">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Leads Management</h2>
          <p className="text-sm text-gray-600 mt-1">Manage and convert leads into clients</p>
        </div>
        <Button onClick={handleAddLead}>
          <Plus className="w-4 h-4 mr-2" />
          Add Lead
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search leads by name, email, or company..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(statusLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="referral">Referral</SelectItem>
            <SelectItem value="website">Website</SelectItem>
            <SelectItem value="social_media">Social Media</SelectItem>
            <SelectItem value="cold_call">Cold Call</SelectItem>
            <SelectItem value="email_campaign">Email Campaign</SelectItem>
            <SelectItem value="event">Event</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={handleSearch} variant="outline">
          <Filter className="w-4 h-4 mr-2" />
          Filter
        </Button>
      </div>

      {/* Leads Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-gray-500">
                  No leads found
                </TableCell>
              </TableRow>
            ) : (
              leads.map((lead) => {
                const statusConfig = statusColors[lead.status] || statusColors.new;
                return (
                  <TableRow key={lead.lead_id} className="hover:bg-gray-50">
                    <TableCell>
                      <div className="font-medium">{lead.name}</div>
                      {lead.practice_area_interest && (
                        <div className="text-xs text-gray-500">{lead.practice_area_interest}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-sm">
                          <Mail className="w-3 h-3 text-gray-400" />
                          {lead.email}
                        </div>
                        {lead.phone && (
                          <div className="flex items-center gap-1 text-sm text-gray-500">
                            <Phone className="w-3 h-3" />
                            {lead.phone}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {lead.company ? (
                        <div className="flex items-center gap-1">
                          <Building className="w-3 h-3 text-gray-400" />
                          {lead.company}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {lead.source ? (
                        <Badge variant="outline">{lead.source.replace('_', ' ')}</Badge>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={`${statusConfig.bg} ${statusConfig.text}`}>
                        {statusLabels[lead.status] || lead.status}
                      </Badge>
                      {lead.converted_to_client_id && (
                        <div className="mt-1">
                          <Badge variant="outline" className="text-xs">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Converted
                          </Badge>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className={`font-semibold ${getScoreColor(lead.score)}`}>
                        {lead.score}
                      </div>
                    </TableCell>
                    <TableCell>
                      {lead.estimated_value ? formatCurrency(lead.estimated_value) : '—'}
                    </TableCell>
                    <TableCell>
                      {lead.assignee ? (
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3 text-gray-400" />
                          {lead.assignee.name}
                        </div>
                      ) : (
                        <span className="text-gray-400">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {!lead.converted_to_client_id && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleConvertLead(lead.lead_id)}
                          >
                            Convert
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditLead(lead)}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Lead Dialog */}
      <LeadDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        mode={dialogMode}
        lead={selectedLead}
        onSuccess={fetchLeads}
      />
    </div>
  );
}

