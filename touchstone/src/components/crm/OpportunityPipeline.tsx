'use client';

import React, { useState, useEffect } from 'react';
import { Plus, MoreVertical, TrendingUp, DollarSign, Calendar, User } from 'lucide-react';
import { API_ENDPOINTS, apiRequest } from '@/lib/api';
import { format } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import OpportunityDialog from './OpportunityDialog';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-toastify';

interface Opportunity {
  opportunity_id: number;
  opportunity_name: string;
  description: string | null;
  practice_area: string | null;
  stage: string;
  probability: number;
  estimated_value: number | null;
  expected_close_date: string | null;
  source: string | null;
  client_id: number | null;
  contact_id: number | null;
  assigned_to: number | null;
  client: {
    client_id: number;
    client_name: string;
  } | null;
  contact: {
    contact_id: number;
    name: string;
    email: string;
  } | null;
  assignee: {
    user_id: number;
    name: string;
    email: string;
  } | null;
  created_at: string;
  updated_at: string;
}

interface PipelineData {
  pipeline: Record<string, Opportunity[]>;
  totalOpportunities: number;
  pipelineValue: number;
  stages: string[];
}

const stageColors: Record<string, { bg: string; text: string; border: string }> = {
  prospect: { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' },
  consultation: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  proposal: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
  negotiation: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  won: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  lost: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
};

const stageLabels: Record<string, string> = {
  prospect: 'Prospect',
  consultation: 'Consultation',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
};

export default function OpportunityPipeline() {
  const { user } = useAuth();
  const [pipelineData, setPipelineData] = useState<PipelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [dialogMode, setDialogMode] = useState<'add' | 'edit' | 'view'>('add');

  useEffect(() => {
    fetchPipeline();
  }, []);

  const fetchPipeline = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiRequest<PipelineData>(API_ENDPOINTS.opportunities.pipeline);
      if (response.success && response.data) {
        setPipelineData(response.data);
      } else {
        setError('Failed to load pipeline');
      }
    } catch (err) {
      console.error('Error fetching pipeline:', err);
      setError(err instanceof Error ? err.message : 'Failed to load pipeline');
    } finally {
      setLoading(false);
    }
  };

  const handleAddOpportunity = () => {
    setSelectedOpportunity(null);
    setDialogMode('add');
    setShowDialog(true);
  };

  const handleEditOpportunity = (opportunity: Opportunity) => {
    setSelectedOpportunity(opportunity);
    setDialogMode('edit');
    setShowDialog(true);
  };

  const handleViewOpportunity = (opportunity: Opportunity) => {
    setSelectedOpportunity(opportunity);
    setDialogMode('view');
    setShowDialog(true);
  };

  const handleStageChange = async (opportunityId: number, newStage: string) => {
    try {
      const response = await apiRequest(API_ENDPOINTS.opportunities.updateStage(opportunityId), {
        method: 'PUT',
        body: JSON.stringify({ stage: newStage }),
      });

      if (response.success) {
        fetchPipeline(); // Refresh pipeline
      } else {
        // alert('Failed to update stage');
        toast.error('Failed to update stage');
      }
    } catch (err) {
      console.error('Error updating stage:', err);
      // alert('Failed to update stage');
      toast.error('Failed to update stage');
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

  if (loading) {
    return (
      <div className="p-6">
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <div className="grid grid-cols-6 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} className="h-96 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !pipelineData) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-red-600 mb-4">{error || 'Failed to load pipeline'}</p>
          <Button onClick={fetchPipeline} variant="outline">
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
          <h2 className="text-2xl font-bold text-gray-900">Opportunity Pipeline</h2>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <TrendingUp className="w-4 h-4" />
              <span>Pipeline Value: <strong>{formatCurrency(pipelineData.pipelineValue)}</strong></span>
            </div>
            <div className="text-sm text-gray-600">
              Total Opportunities: <strong>{pipelineData.totalOpportunities}</strong>
            </div>
          </div>
        </div>
        <Button onClick={handleAddOpportunity}>
          <Plus className="w-4 h-4 mr-2" />
          Add Opportunity
        </Button>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {pipelineData.stages.map((stage) => {
          const opportunities = pipelineData.pipeline[stage] || [];
          const stageConfig = stageColors[stage] || stageColors.prospect;
          const stageValue = opportunities.reduce((sum, opp) => {
            const value = opp.estimated_value || 0;
            const probability = opp.probability / 100;
            return sum + (value * probability);
          }, 0);

          return (
            <div
              key={stage}
              className={`flex-shrink-0 w-80 ${stageConfig.bg} rounded-lg border-2 ${stageConfig.border} p-4`}
            >
              {/* Stage Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className={`font-semibold ${stageConfig.text}`}>
                    {stageLabels[stage]}
                  </h3>
                  <p className="text-xs text-gray-600 mt-1">
                    {opportunities.length} {opportunities.length === 1 ? 'opportunity' : 'opportunities'}
                  </p>
                  {stageValue > 0 && (
                    <p className="text-xs font-medium text-gray-700 mt-1">
                      {formatCurrency(stageValue)}
                    </p>
                  )}
                </div>
              </div>

              {/* Opportunities in this stage */}
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {opportunities.map((opportunity) => (
                  <Card
                    key={opportunity.opportunity_id}
                    className="p-4 bg-white cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => handleViewOpportunity(opportunity)}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <h4 className="font-semibold text-gray-900 text-sm">
                          {opportunity.opportunity_name}
                        </h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditOpportunity(opportunity);
                          }}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </div>

                      {opportunity.client && (
                        <p className="text-xs text-gray-600">
                          {opportunity.client.client_name}
                        </p>
                      )}

                      {opportunity.contact && (
                        <p className="text-xs text-gray-600">
                          Contact: {opportunity.contact.name}
                        </p>
                      )}

                      <div className="flex items-center gap-2 flex-wrap">
                        {opportunity.estimated_value && (
                          <Badge variant="outline" className="text-xs">
                            <DollarSign className="w-3 h-3 mr-1" />
                            {formatCurrency(opportunity.estimated_value)}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {opportunity.probability}%
                        </Badge>
                        {opportunity.practice_area && (
                          <Badge variant="outline" className="text-xs">
                            {opportunity.practice_area}
                          </Badge>
                        )}
                      </div>

                      {opportunity.expected_close_date && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(opportunity.expected_close_date), 'MMM d, yyyy')}
                        </div>
                      )}

                      {opportunity.assignee && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <User className="w-3 h-3" />
                          {opportunity.assignee.name}
                        </div>
                      )}

                      {/* Stage selector */}
                      <select
                        value={opportunity.stage}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleStageChange(opportunity.opportunity_id, e.target.value);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full mt-2 text-xs border rounded px-2 py-1"
                      >
                        {pipelineData.stages.map(s => (
                          <option key={s} value={s}>{stageLabels[s]}</option>
                        ))}
                      </select>
                    </div>
                  </Card>
                ))}

                {opportunities.length === 0 && (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    No opportunities
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Opportunity Dialog */}
      <OpportunityDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        mode={dialogMode}
        opportunity={selectedOpportunity}
        onSuccess={fetchPipeline}
      />
    </div>
  );
}

