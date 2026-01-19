'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X, ChevronDown } from 'lucide-react';
import { API_ENDPOINTS, apiRequest } from '@/lib/api';

interface TicketDetail {
  id: number;
  ticketNumber: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  client: {
    id: number;
    name: string;
    industry: string;
  } | null;
  matter: {
    id: number;
    title: string;
    practiceArea: string;
    status: string;
  } | null;
  raisedBy: {
    id: number;
    name: string;
    email: string;
    phone: string;
    role: string;
  };
  assignedTo: {
    id: number;
    name: string;
    email: string;
    phone: string;
    role: string;
  } | null;
  assignedAt: string | null;
  resolvedAt: string | null;
  comments: string | null;
  attachmentUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PageProps {
  // Next's generated types expect params to be Promise-like in this route
  params: Promise<{
    ticket_id: string;
  }>;
}

export default function SupportTicketDetailPage({ params }: PageProps) {
  const router = useRouter();
  const [ticketId, setTicketId] = useState<string>('');

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [comment, setComment] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Resolve params (Promise-like) once on mount
  useEffect(() => {
    let isActive = true;
    Promise.resolve(params).then((resolved) => {
      if (!isActive) return;
      setTicketId(resolved.ticket_id);
    });
    return () => {
      isActive = false;
    };
  }, [params]);

  useEffect(() => {
    if (ticketId) {
      fetchTicketDetails();
    }
  }, [ticketId]);

  const fetchTicketDetails = async () => {
    try {
      setLoading(true);
      const response = await apiRequest<TicketDetail>(
        API_ENDPOINTS.support.byId(parseInt(ticketId))
      );

      if (response.success && response.data) {
        setTicket(response.data);
        setSelectedStatus(response.data.status);
        setComment(response.data.comments || '');
      }
    } catch (error) {
      console.error('Failed to fetch ticket details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAndSubmit = async () => {
    if (!ticket) return;

    setSaving(true);
    try {
      const updatePayload: {
        comments: string | null;
        status?: string;
      } = {
        comments: comment.trim() || null,
      };

      // Only update status if it changed
      if (selectedStatus !== ticket.status) {
        updatePayload.status = selectedStatus;
      }

      const response = await apiRequest(
        API_ENDPOINTS.support.update(ticket.id),
        {
          method: 'PUT',
          body: JSON.stringify(updatePayload),
        }
      );

      if (response.success) {
        // Redirect back to support page
        router.push('/support');
      }
    } catch (error) {
      console.error('Failed to update ticket:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update ticket';
      alert(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    router.push('/support');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'open':
        return 'text-blue-600 bg-blue-50';
      case 'in_progress':
        return 'text-yellow-600 bg-yellow-50';
      case 'resolved':
        return 'text-green-600 bg-green-50';
      case 'closed':
        return 'text-gray-600 bg-gray-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const formatStatus = (status: string) => {
    return status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading ticket details...</div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Ticket not found</p>
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Support
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 mb-2">
                Ticket ID: {ticket.ticketNumber}
              </h1>
              <p className="text-sm text-gray-500">
                Date Created: {formatDate(ticket.createdAt)}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* Subject and Status */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <p className="text-sm text-gray-500 mb-1">Subject:</p>
              <h2 className="text-xl font-semibold text-gray-900">
                {ticket.subject}
              </h2>
            </div>
            <div className="ml-6">
              <p className="text-sm text-gray-500 mb-2">Activity status</p>
              <div className="relative">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className={`appearance-none px-4 py-2 pr-10 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer ${getStatusColor(
                    selectedStatus
                  )}`}
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Information Grid */}
          <div className="grid grid-cols-4 gap-6 mb-6">
            {/* Client Name */}
            <div>
              <p className="text-sm text-gray-500 mb-1">Client Name:</p>
              <p className="text-base font-medium text-gray-900">
                {ticket.client?.name || '-'}
              </p>
            </div>

            {/* Matter Title */}
            <div>
              <p className="text-sm text-gray-500 mb-1">Matter Title:</p>
              <p className="text-base font-medium text-gray-900">
                {ticket.matter?.title || '-'}
              </p>
            </div>

            {/* Raised By */}
            <div>
              <p className="text-sm text-gray-500 mb-1">Raised By:</p>
              <p className="text-base font-medium text-gray-900">
                {ticket.raisedBy.name}
              </p>
            </div>

            {/* Assigned To */}
            <div>
              <p className="text-sm text-gray-500 mb-1">Assigned To:</p>
              <p className="text-base font-medium text-gray-900">
                {ticket.assignedTo?.name || '-'}
              </p>
            </div>
          </div>

          {/* Description */}
          <div className="mb-6">
            <p className="text-sm text-gray-500 mb-2">Description:</p>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-gray-900 whitespace-pre-wrap">
                {ticket.description}
              </p>
            </div>
          </div>

          {/* Add Comment */}
          <div>
            <label
              htmlFor="comment"
              className="block text-sm text-gray-500 mb-2"
            >
              Add Comment:
            </label>
            <textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Add any additional comments or updates..."
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={handleClose}
            className="flex-1 px-6 py-3 border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveAndSubmit}
            disabled={saving}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save & Submit'}
          </button>
        </div>
    
      </div>
    </div>
  );
}