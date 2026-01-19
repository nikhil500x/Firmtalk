'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
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
}

interface Client {
  id: number;
  companyName: string;
  client_id?: number; // For backward compatibility
  client_name?: string; // For backward compatibility
}

interface Contact {
  id: number;
  name: string;
  email: string;
  contact_id?: number; // For backward compatibility
}

interface User {
  user_id?: number;
  id?: number; // API returns 'id' but we need 'user_id' for the component
  name: string | null;
  email: string;
}

interface OpportunityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'add' | 'edit' | 'view';
  opportunity?: Opportunity | null;
  onSuccess?: () => void;
}

const stages = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'consultation', label: 'Consultation' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'won', label: 'Won' },
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

export default function OpportunityDialog({
  open,
  onOpenChange,
  mode,
  opportunity,
  onSuccess,
}: OpportunityDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [formData, setFormData] = useState({
    opportunity_name: '',
    description: '',
    practice_area: '',
    stage: 'prospect',
    probability: '0',
    estimated_value: '',
    expected_close_date: '',
    source: 'PLACEHOLDER_NONE',
    client_id: 'PLACEHOLDER_NONE',
    contact_id: 'PLACEHOLDER_NONE',
    assigned_to: 'PLACEHOLDER_NONE',
  });

  useEffect(() => {
    if (open) {
      // Always fetch clients and users when dialog opens
      fetchClients();
      fetchUsers();
      
      if (mode === 'edit' || mode === 'view') {
        if (opportunity) {
          // Helper to safely convert to string or placeholder
          const safeToString = (value: number | null | undefined): string => {
            if (value === null || value === undefined || value === 0) return 'PLACEHOLDER_NONE';
            const str = value.toString();
            return str === '' ? 'PLACEHOLDER_NONE' : str;
          };
          
          setFormData({
            opportunity_name: opportunity.opportunity_name || '',
            description: opportunity.description || '',
            practice_area: opportunity.practice_area || '',
            stage: opportunity.stage || 'prospect',
            probability: opportunity.probability?.toString() || '0',
            estimated_value: opportunity.estimated_value?.toString() || '',
            expected_close_date: opportunity.expected_close_date
              ? new Date(opportunity.expected_close_date).toISOString().split('T')[0]
              : '',
            source: (opportunity.source && opportunity.source.trim() !== '') ? opportunity.source : 'PLACEHOLDER_NONE',
            client_id: safeToString(opportunity.client_id),
            contact_id: safeToString(opportunity.contact_id),
            assigned_to: safeToString(opportunity.assigned_to),
          });
          if (opportunity.client_id) {
            fetchContacts(opportunity.client_id);
          } else {
            setContacts([]);
          }
        }
      } else {
        resetForm();
      }
    } else {
      // Reset when dialog closes
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, opportunity]);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const response = await apiRequest<{ success: boolean; data: Client[] }>(API_ENDPOINTS.clients.list);
      if (response.success && response.data) {
        // Map API response to component format
        const mappedClients = (Array.isArray(response.data) ? response.data : []).map((client) => ({
          id: client.id || client.client_id || 0,
          companyName: client.companyName || client.client_name || 'Unknown Client',
          client_id: client.id || client.client_id,
          client_name: client.companyName || client.client_name,
        })).filter((client) => client.id > 0); // Filter out invalid clients
        setClients(mappedClients);
      }
    } catch (err) {
      console.error('Error fetching clients:', err);
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchContacts = async (clientId: number) => {
    try {
      if (!clientId || clientId <= 0) {
        setContacts([]);
        return;
      }
      const response = await apiRequest<{ success: boolean; data: Contact[] }>(
        API_ENDPOINTS.contacts.byClient(clientId)
      );
      if (response.success && response.data) {
        // Map API response to component format
        const mappedContacts = (Array.isArray(response.data) ? response.data : []).map((contact) => ({
          id: contact.id || contact.contact_id || 0,
          name: contact.name || 'Unknown',
          email: contact.email || 'No email',
          contact_id: contact.id || contact.contact_id,
        })).filter((contact) => contact.id > 0); // Filter out invalid contacts
        setContacts(mappedContacts);
      } else {
        setContacts([]);
      }
    } catch (err) {
      console.error('Error fetching contacts:', err);
      setContacts([]);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await apiRequest<{ success: boolean; data: User[] }>(API_ENDPOINTS.users.list);
      if (response.success && response.data) {
        // Map API response to component format
        // API returns 'id' but we need 'user_id' for consistency
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
      opportunity_name: '',
      description: '',
      practice_area: '',
      stage: 'prospect',
      probability: '0',
      estimated_value: '',
      expected_close_date: '',
      source: 'PLACEHOLDER_NONE',
      client_id: 'PLACEHOLDER_NONE',
      contact_id: 'PLACEHOLDER_NONE',
      assigned_to: 'PLACEHOLDER_NONE',
    });
    setContacts([]);
    setError(null);
  };

  const handleClientChange = (clientId: string) => {
    // Ensure we never set an empty string
    const safeClientId = (clientId === '' || clientId === null || clientId === undefined) ? 'PLACEHOLDER_NONE' : clientId;
    const actualClientId = safeClientId === 'PLACEHOLDER_NONE' ? '' : safeClientId;
    setFormData({ ...formData, client_id: safeClientId, contact_id: 'PLACEHOLDER_NONE' });
    if (actualClientId) {
      fetchContacts(parseInt(actualClientId));
    } else {
      setContacts([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.opportunity_name.trim()) {
      setError('Opportunity name is required');
      return;
    }

    setSaving(true);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload: any = {
        opportunity_name: formData.opportunity_name.trim(),
        description: formData.description.trim() || null,
        practice_area: formData.practice_area || null,
        stage: formData.stage,
        probability: parseInt(formData.probability) || 0,
        estimated_value: formData.estimated_value ? parseFloat(formData.estimated_value) : null,
        expected_close_date: formData.expected_close_date || null,
        source: formData.source && formData.source !== 'PLACEHOLDER_NONE' ? formData.source : null,
        client_id: formData.client_id && formData.client_id !== 'PLACEHOLDER_NONE' ? parseInt(formData.client_id) : null,
        contact_id: formData.contact_id && formData.contact_id !== 'PLACEHOLDER_NONE' ? parseInt(formData.contact_id) : null,
        assigned_to: formData.assigned_to && formData.assigned_to !== 'PLACEHOLDER_NONE' ? parseInt(formData.assigned_to) : null,
      };

      let response;
      if (mode === 'edit' && opportunity) {
        response = await apiRequest(
          API_ENDPOINTS.opportunities.update(opportunity.opportunity_id),
          {
            method: 'PUT',
            body: JSON.stringify(payload),
          }
        );
      } else {
        response = await apiRequest(API_ENDPOINTS.opportunities.create, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      if (response.success) {
        onSuccess?.();
        onOpenChange(false);
        resetForm();
      } else {
        setError(response.message || 'Failed to save opportunity');
      }
    } catch (err) {
      console.error('Error saving opportunity:', err);
      setError(err instanceof Error ? err.message : 'Failed to save opportunity');
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
            {mode === 'add' ? 'New Opportunity' : mode === 'edit' ? 'Edit Opportunity' : 'Opportunity Details'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'add' ? 'Create a new opportunity in the pipeline' : mode === 'edit' ? 'Update opportunity details' : 'View opportunity information'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm">
              {error}
            </div>
          )}

          <div>
            <Label htmlFor="opportunity_name">Opportunity Name *</Label>
            <Input
              id="opportunity_name"
              value={formData.opportunity_name}
              onChange={(e) => setFormData({ ...formData, opportunity_name: e.target.value })}
              disabled={isViewMode}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="stage">Stage</Label>
              <Select
                value={formData.stage}
                onValueChange={(value) => setFormData({ ...formData, stage: value })}
                disabled={isViewMode}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((stage) => (
                    <SelectItem key={stage.value} value={stage.value}>
                      {stage.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="probability">Probability (%)</Label>
              <Input
                id="probability"
                type="number"
                min="0"
                max="100"
                value={formData.probability}
                onChange={(e) => setFormData({ ...formData, probability: e.target.value })}
                disabled={isViewMode}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="client_id">Client (Optional)</Label>
              <Select
                value={formData.client_id === '' ? 'PLACEHOLDER_NONE' : formData.client_id}
                onValueChange={handleClientChange}
                disabled={isViewMode}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PLACEHOLDER_NONE">None</SelectItem>
                  {clients.map((client) => {
                    const clientId = client.id || client.client_id;
                    if (!clientId || clientId <= 0) return null;
                    const clientIdStr = clientId.toString();
                    if (clientIdStr === '') return null; // Defensive check
                    return (
                      <SelectItem key={clientId} value={clientIdStr}>
                        {client.companyName || client.client_name || 'Unknown Client'}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="contact_id">Contact (Optional)</Label>
              <Select
                value={formData.contact_id === '' ? 'PLACEHOLDER_NONE' : formData.contact_id}
                onValueChange={(value) => {
                  const safeValue = (value === '' || value === null || value === undefined) ? 'PLACEHOLDER_NONE' : value;
                  setFormData({ ...formData, contact_id: safeValue });
                }}
                disabled={isViewMode || !formData.client_id || formData.client_id === 'PLACEHOLDER_NONE'}
              >
                <SelectTrigger>
                  <SelectValue placeholder={formData.client_id ? 'Select contact' : 'Select client first'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PLACEHOLDER_NONE">None</SelectItem>
                  {contacts.map((contact) => {
                    const contactId = contact.id || contact.contact_id;
                    if (!contactId || contactId <= 0) return null;
                    const contactIdStr = contactId.toString();
                    if (contactIdStr === '') return null; // Defensive check
                    return (
                      <SelectItem key={contactId} value={contactIdStr}>
                        {contact.name || 'Unknown'} ({contact.email || 'No email'})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="practice_area">Practice Area</Label>
              <Input
                id="practice_area"
                value={formData.practice_area}
                onChange={(e) => setFormData({ ...formData, practice_area: e.target.value })}
                disabled={isViewMode}
                placeholder="e.g., Corporate Law, Litigation"
              />
            </div>

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
              <Label htmlFor="expected_close_date">Expected Close Date</Label>
              <Input
                id="expected_close_date"
                type="date"
                value={formData.expected_close_date}
                onChange={(e) => setFormData({ ...formData, expected_close_date: e.target.value })}
                disabled={isViewMode}
              />
            </div>
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
                <SelectValue placeholder="Select attorney" />
              </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PLACEHOLDER_NONE">Unassigned</SelectItem>
                  {users.map((user) => {
                    if (!user.user_id || user.user_id <= 0) return null;
                    const userIdStr = user.user_id.toString();
                    if (userIdStr === '') return null; // Defensive check
                    return (
                      <SelectItem key={user.user_id} value={userIdStr}>
                        {user.name || 'Unknown'} ({user.email || 'No email'})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              disabled={isViewMode}
              rows={4}
              placeholder="Opportunity description..."
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
              <Button className="mb-2 flex items-center justify-center gap-2 px-4 py-2.5 
                        bg-gradient-to-r from-red-500 to-red-600  text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-colors duration-200 shadow-md py-3" type="submit" disabled={saving}>
                {saving ? 'Saving...' : mode === 'edit' ? 'Update' : 'Create'}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

