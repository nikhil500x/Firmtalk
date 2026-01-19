'use client';

import React, { useState, useEffect } from 'react';
import { API_ENDPOINTS, apiRequest } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
}

interface User {
  user_id: number;
  name: string;
  email: string;
}

interface LeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'add' | 'edit' | 'view';
  lead?: Lead | null;
  onSuccess?: () => void;
}

const statuses = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'converted', label: 'Converted' },
  { value: 'lost', label: 'Lost' },
];

const sources = [
  'referral',
  'website',
  'social_media',
  'cold_call',
  'email_campaign',
  'event',
  'other',
];

export default function LeadDialog({
  open,
  onOpenChange,
  mode,
  lead,
  onSuccess,
}: LeadDialogProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    source: 'PLACEHOLDER_NONE',
    status: 'new',
    score: '0',
    practice_area_interest: '',
    estimated_value: '',
    assigned_to: 'PLACEHOLDER_NONE',
    notes: '',
    tags: '',
  });

  useEffect(() => {
    if (open) {
      fetchUsers();
      if (mode === 'edit' || mode === 'view') {
        if (lead) {
          // Helper to safely convert to string or placeholder
          const safeToString = (value: number | null | undefined): string => {
            if (value === null || value === undefined || value === 0) return 'PLACEHOLDER_NONE';
            const str = value.toString();
            return str === '' ? 'PLACEHOLDER_NONE' : str;
          };
          
          setFormData({
            name: lead.name || '',
            email: lead.email || '',
            phone: lead.phone || '',
            company: lead.company || '',
            source: (lead.source && lead.source.trim() !== '') ? lead.source : 'PLACEHOLDER_NONE',
            status: lead.status || 'new',
            score: lead.score?.toString() || '0',
            practice_area_interest: lead.practice_area_interest || '',
            estimated_value: lead.estimated_value?.toString() || '',
            assigned_to: safeToString(lead.assigned_to),
            notes: lead.notes || '',
            tags: Array.isArray(lead.tags) ? lead.tags.join(', ') : '',
          });
        }
      } else {
        resetForm();
      }
    }
  }, [open, mode, lead]);

  const fetchUsers = async () => {
    try {
      const response = await apiRequest<{ data: User[] }>(API_ENDPOINTS.users.list);
      if (response.success && response.data) {
        // Map API response to component format and filter out invalid users
        const mappedUsers = (Array.isArray(response.data) ? response.data : []).map((user) => ({
          user_id: user.user_id || user.id || 0,
          name: user.name || 'Unknown',
          email: user.email || 'No email',
        })).filter((user) => user.user_id > 0); // Filter out invalid users
        setUsers(mappedUsers);
      } else {
        setUsers([]);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
      setUsers([]);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      company: '',
      source: 'PLACEHOLDER_NONE',
      status: 'new',
      score: '0',
      practice_area_interest: '',
      estimated_value: '',
      assigned_to: 'PLACEHOLDER_NONE',
      notes: '',
      tags: '',
    });
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim() || !formData.email.trim()) {
      setError('Name and email are required');
      return;
    }

    setSaving(true);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload: any = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() || null,
        company: formData.company.trim() || null,
        source: formData.source && formData.source !== 'PLACEHOLDER_NONE' ? formData.source : null,
        status: formData.status,
        score: parseInt(formData.score) || 0,
        practice_area_interest: formData.practice_area_interest.trim() || null,
        estimated_value: formData.estimated_value ? parseFloat(formData.estimated_value) : null,
        assigned_to: formData.assigned_to && formData.assigned_to !== 'PLACEHOLDER_NONE' ? parseInt(formData.assigned_to) : null,
        notes: formData.notes.trim() || null,
        tags: formData.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0),
      };

      let response;
      if (mode === 'edit' && lead) {
        response = await apiRequest(API_ENDPOINTS.leads.update(lead.lead_id), {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        response = await apiRequest(API_ENDPOINTS.leads.create, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      if (response.success) {
        onSuccess?.();
        onOpenChange(false);
        resetForm();
      } else {
        setError(response.message || 'Failed to save lead');
      }
    } catch (err) {
      console.error('Error saving lead:', err);
      setError(err instanceof Error ? err.message : 'Failed to save lead');
    } finally {
      setSaving(false);
    }
  };

  const isViewMode = mode === 'view';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'add' ? 'New Lead' : mode === 'edit' ? 'Edit Lead' : 'Lead Details'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'add' ? 'Create a new lead in the CRM system' : mode === 'edit' ? 'Update lead information' : 'View lead details'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={isViewMode}
                required
              />
            </div>

            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={isViewMode}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                disabled={isViewMode}
              />
            </div>

            <div>
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                disabled={isViewMode}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
                disabled={isViewMode}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="score">Score (0-100)</Label>
              <Input
                id="score"
                type="number"
                min="0"
                max="100"
                value={formData.score}
                onChange={(e) => setFormData({ ...formData, score: e.target.value })}
                disabled={isViewMode}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="source">Source</Label>
              <Select
                value={formData.source === '' ? 'PLACEHOLDER_NONE' : formData.source}
                onValueChange={(value) => {
                  const safeValue = (value === '' || value === null || value === undefined) ? 'PLACEHOLDER_NONE' : value;
                  setFormData({ ...formData, source: safeValue });
                }}
                disabled={isViewMode}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PLACEHOLDER_NONE">None</SelectItem>
                  {sources.map((source) => (
                    <SelectItem key={source} value={source}>
                      {source.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="practice_area_interest">Practice Area Interest</Label>
              <Input
                id="practice_area_interest"
                value={formData.practice_area_interest}
                onChange={(e) => setFormData({ ...formData, practice_area_interest: e.target.value })}
                disabled={isViewMode}
                placeholder="e.g., Corporate Law, Litigation"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="estimated_value">Estimated Value</Label>
              <Input
                id="estimated_value"
                type="number"
                min="0"
                step="0.01"
                value={formData.estimated_value}
                onChange={(e) => setFormData({ ...formData, estimated_value: e.target.value })}
                disabled={isViewMode}
                placeholder="0.00"
              />
            </div>

            <div>
              <Label htmlFor="assigned_to">Assigned To</Label>
              <Select
                value={formData.assigned_to === '' ? 'PLACEHOLDER_NONE' : formData.assigned_to}
                onValueChange={(value) => {
                  const safeValue = (value === '' || value === null || value === undefined) ? 'PLACEHOLDER_NONE' : value;
                  setFormData({ ...formData, assigned_to: safeValue });
                }}
                disabled={isViewMode}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PLACEHOLDER_NONE">Unassigned</SelectItem>
                  {users
                    .filter((user) => {
                      // Filter out any users with invalid IDs
                      if (!user || !user.user_id || user.user_id <= 0) return false;
                      const userIdStr = String(user.user_id);
                      return userIdStr !== '' && userIdStr !== '0' && userIdStr !== 'null' && userIdStr !== 'undefined';
                    })
                    .map((user) => {
                      const userIdStr = String(user.user_id);
                      // Double-check before rendering
                      if (!userIdStr || userIdStr === '' || userIdStr === '0') return null;
                      return (
                        <SelectItem key={user.user_id} value={userIdStr}>
                          {user.name || 'Unknown'} ({user.email || 'No email'})
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input
              id="tags"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              disabled={isViewMode}
              placeholder="e.g., hot, follow-up, vip"
            />
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              disabled={isViewMode}
              rows={4}
              placeholder="Lead notes..."
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                resetForm();
              }}
              disabled={saving}
            >
              {isViewMode ? 'Close' : 'Cancel'}
            </Button>
            {!isViewMode && (
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : mode === 'edit' ? 'Update' : 'Create'}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

