'use client';

import React, { useState, useEffect } from 'react';
import { API_ENDPOINTS, apiRequest } from '@/lib/api';
import ContactCard from './ContactCard';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, ZoomIn, ZoomOut, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import InteractionTimeline from './InteractionTimeline';

interface Relationship {
  id: number;
  toContactId?: number;
  fromContactId?: number;
  toContactName?: string;
  fromContactName?: string;
  toContactEmail?: string;
  fromContactEmail?: string;
  toContactDesignation?: string;
  fromContactDesignation?: string;
  type: string;
  lineStyle: string;
  lineColor?: string;
  notes?: string;
}

interface Contact {
  id: number;
  name: string;
  email: string;
  phone: string;
  designation: string | null;
  isPrimary: boolean;
  badges: Array<{ type: string; createdBy: string; createdAt: string }>;
  relationships: Relationship[];
  createdAt: string;
  updatedAt: string;
}

interface OrgChartData {
  client: {
    id: number;
    name: string;
    industry: string | null;
  };
  contacts: Contact[];
}

interface OrgChartViewProps {
  clientId: number;
  onBack?: () => void;
}

export default function OrgChartView({ clientId, onBack }: OrgChartViewProps) {
  const [data, setData] = useState<OrgChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showInteractions, setShowInteractions] = useState(false);
  const [zoom, setZoom] = useState(1);

  const fetchOrgChart = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiRequest<OrgChartData>(API_ENDPOINTS.orgChart.byClient(clientId));
      if (response.success && response.data) {
        setData(response.data);
      } else {
        setError('Failed to load org chart');
      }
    } catch (err) {
      console.error('Error fetching org chart:', err);
      setError(err instanceof Error ? err.message : 'Failed to load org chart');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (clientId) {
      fetchOrgChart();
    }
  }, [clientId]);

  const handleContactClick = (contact: Contact) => {
    setSelectedContact(contact);
    setShowInteractions(true);
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 2));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.5));
  const handleZoomReset = () => setZoom(1);

  if (loading) {
    return (
      <div className="p-6">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
        <Button onClick={fetchOrgChart} className="mt-4">
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <p className="text-gray-600">No org chart data available</p>
      </div>
    );
  }

  // Build hierarchy - find root contacts (those with no incoming relationships)
  const rootContacts = data.contacts.filter(contact => {
    return !data.contacts.some(other => 
      other.relationships.some(rel => 
        rel.toContactId === contact.id || rel.fromContactId === contact.id
      )
    ) || contact.relationships.length === 0;
  });

  // If no clear hierarchy, show all contacts in a grid
  const hasHierarchy = data.contacts.some(c => c.relationships.length > 0);

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{data.client.name}</h2>
          {data.client.industry && (
            <p className="text-sm text-gray-600 mt-1">{data.client.industry}</p>
          )}
          <p className="text-sm text-gray-500 mt-1">
            {data.contacts.length} contact{data.contacts.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleZoomOut}>
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-sm text-gray-600 min-w-[60px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button variant="outline" size="sm" onClick={handleZoomIn}>
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleZoomReset}>
            Reset
          </Button>
          <Button variant="outline" size="sm" onClick={fetchOrgChart}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          {onBack && (
            <Button variant="outline" size="sm" onClick={onBack}>
              Back
            </Button>
          )}
        </div>
      </div>

      {/* Org Chart Area */}
      <div className="flex-1 overflow-auto bg-gray-50 rounded-lg p-6 relative">
        <div
          className="inline-block"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'top left',
            minWidth: '100%',
          }}
        >
          {hasHierarchy ? (
            <div className="space-y-8">
              {/* Render root contacts and their hierarchies */}
              {rootContacts.length > 0 ? (
                rootContacts.map(rootContact => (
                  <ContactHierarchy
                    key={rootContact.id}
                    contact={rootContact}
                    allContacts={data.contacts}
                    onContactClick={handleContactClick}
                    level={0}
                  />
                ))
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {data.contacts.map(contact => (
                    <ContactCard
                      key={contact.id}
                      contact={contact}
                      onClick={() => handleContactClick(contact)}
                      onViewInteractions={() => handleContactClick(contact)}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-24">
              {data.contacts.map(contact => (
                <ContactCard
                  key={contact.id}
                  contact={contact}
                  onClick={() => handleContactClick(contact)}
                  onViewInteractions={() => handleContactClick(contact)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Interaction Timeline Sidebar */}
      {showInteractions && selectedContact && (
        <InteractionTimeline
          contactId={selectedContact.id}
          contactName={selectedContact.name}
          onClose={() => {
            setShowInteractions(false);
            setSelectedContact(null);
          }}
        />
      )}
    </div>
  );
}

// Recursive component for rendering hierarchy
function ContactHierarchy({
  contact,
  allContacts,
  onContactClick,
  level,
}: {
  contact: Contact;
  allContacts: Contact[];
  onContactClick: (contact: Contact) => void;
  level: number;
}) {
  // Find direct reports (contacts that report to this contact)
  const directReports = allContacts.filter(c =>
    c.relationships.some(rel =>
      rel.toContactId === contact.id && rel.type === 'reports_to'
    )
  );

  return (
    <div className="flex flex-col items-center">
      <ContactCard
        contact={contact}
        onClick={() => onContactClick(contact)}
        onViewInteractions={() => onContactClick(contact)}
      />
      {directReports.length > 0 && (
        <div className="mt-4 flex gap-4">
          {directReports.map(report => (
            <ContactHierarchy
              key={report.id}
              contact={report}
              allContacts={allContacts}
              onContactClick={onContactClick}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

