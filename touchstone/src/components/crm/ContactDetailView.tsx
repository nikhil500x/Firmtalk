'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Mail,
  Phone,
  Briefcase,
  Building2,
  MapPin,
  Globe,
  MoreVertical,
  Calendar,
  Award,
  Linkedin,
  Twitter,
  Cake,
  Gift,
  User,
} from 'lucide-react';
import { format, isToday, isTomorrow, differenceInDays } from 'date-fns';
import { API_ENDPOINTS, apiRequest } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import InteractionTimeline from './InteractionTimeline';
import { useAuth } from '@/contexts/AuthContext';

interface ContactDetail {
  id: number;
  name: string;
  email: string;
  number: string;
  designation: string | null;
  isPrimary: boolean;
  birthday: string | null;
  anniversary: string | null;
  linkedinUrl: string | null;
  twitterHandle: string | null;
  notes: string | null;
  tags: string[];
  preferredContactMethod: string | null;
  timezone: string | null;
  client: {
    client_id: number;
    client_name: string;
    industry: string | null;
    website_url?: string | null;
    address?: string | null;
    group?: {
      group_id: number;
      name: string;
    } | null;
  } | null;
  creator: {
    id: number;
    name: string;
    email: string;
    role: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
  badges: Array<{
    id: number;
    type: string;
    createdBy: string;
    createdAt: string;
  }>;
  reportsTo: {
    id: number;
    name: string;
    email: string;
    designation: string | null;
  } | null;
  manages: Array<{
    id: number;
    name: string;
    email: string;
    designation: string | null;
  }>;
  lastInteraction: {
    id: number;
    type: "matter";
    date: string;
    createdBy: {
      id: number;
      name: string;
      email: string;
    };
    data: {
      matter_id: number;
      matter_title: string;
      practice_area: string | null;
      start_date: string;
    };
  } | {
    id: number;
    type: "note";
    date: string;
    createdBy: {
      id: number;
      name: string;
      email: string;
    };
    data: {
      subject: string;
      notes: string;
      date: string;
    };
  } | null;
  stats: {
    totalInteractions: number;
    interactionsByType: Record<string, number>;
    relationshipDurationDays: number;
    mattersCount: number;
    tasksCount: number;
    daysSinceLastInteraction: number | null;
  };
}

interface ContactDetailViewProps {
  contactId: number;
}

const badgeColors: Record<string, { bg: string; text: string; label: string }> = {
  champion: { bg: 'bg-green-100', text: 'text-green-700', label: 'Champion' },
  blocker: { bg: 'bg-red-100', text: 'text-red-700', label: 'Blocker' },
  influencer: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Influencer' },
  budget_holder: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Budget Holder' },
  end_user: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'End User' },
  decision_maker: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Decision Maker' },
};

export default function ContactDetailView({ contactId }: ContactDetailViewProps) {
  const router = useRouter();
  const { role } = useAuth();
  const [contact, setContact] = useState<ContactDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showContactMenu, setShowContactMenu] = useState(false);
  const [showInteractionModal, setShowInteractionModal] = useState(false);

  useEffect(() => {
    fetchContactDetail();
  }, [contactId]);

  const fetchContactDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiRequest<ContactDetail>(API_ENDPOINTS.contacts.byId(contactId));
      console.log('Fetched contact detail:', response);
      if (response.success && response.data) {
        setContact(response.data);
      } else {
        setError('Failed to load contact details');
      }
    } catch (err) {
      console.error('Error fetching contact detail:', err);
      setError(err instanceof Error ? err.message : 'Failed to load contact details');
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getUpcomingBirthday = (birthday: string | null) => {
    if (!birthday) return null;
    const birthDate = new Date(birthday);
    const today = new Date();
    const thisYear = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
    const nextYear = new Date(today.getFullYear() + 1, birthDate.getMonth(), birthDate.getDate());
    
    const upcoming = thisYear >= today ? thisYear : nextYear;
    const daysUntil = differenceInDays(upcoming, today);
    
    if (daysUntil <= 30) {
      return {
        date: upcoming,
        daysUntil,
        isToday: isToday(upcoming),
        isTomorrow: isTomorrow(upcoming),
      };
    }
    return null;
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !contact) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Contact not found'}</p>
          <Button onClick={() => router.push('/crm?tab=contacts')}>Go Back to CRM</Button>
        </div>
      </div>
    );
  }

  const upcomingBirthday = getUpcomingBirthday(contact.birthday);

  return (
    <div className="p-6 space-y-4">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          {/* <User className="w-5 h-5 text-gray-500" /> */}
          {/* <button
            onClick={() => router.push('/crm?tab=contacts')}
            className="text-gray-500 hover:text-blue-600 font-medium transition-colors"
          >
            CRM
          </button> */}
          {/* <span className="text-gray-400">›</span> */}
          <button
            onClick={() => router.push('/crm?tab=contacts')}
            className="text-gray-500 hover:text-blue-600 font-medium transition-colors"
          >
            Contacts Hub
          </button>
          <span className="text-gray-400">›</span>
          <span className="text-gray-900 font-semibold">{contact.name}</span>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="bg-white rounded-[22px] shadow-sm border border-gray-100 overflow-hidden">
        {/* Page Title */}
        {/* <div className="px-6 pt-6">
          <h1 className="text-2xl font-medium text-gray-900" style={{ fontFamily: 'PF Square Sans Pro, sans-serif' }}>
            {contact.name}
          </h1>
        </div> */}

        {/* Contact Profile Section */}
        <div className="bg-[#F9FAFB] rounded-xl mx-6 mt-6 p-4">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white text-xl font-semibold">
                  {getInitials(contact.name)}
                </span>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{contact.name}</h2>
                <p className="text-sm text-gray-600">{contact.designation || 'Contact'}</p>
                {contact.client && (
                  <p className="text-sm text-gray-500 mt-1">{contact.client.client_name}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              {contact.isPrimary && (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                  Primary Contact
                </span>
              )}

              {contact.badges.length > 0 && (
                <div className="flex gap-2">
                  {contact.badges.slice(0, 2).map((badge) => {
                    const badgeConfig = badgeColors[badge.type] || {
                      bg: 'bg-gray-100',
                      text: 'text-gray-700',
                      label: badge.type,
                    };
                    return (
                      <Badge key={badge.id} className={`${badgeConfig.bg} ${badgeConfig.text}`}>
                        <Award className="w-3 h-3 mr-1" />
                        {badgeConfig.label}
                      </Badge>
                    );
                  })}
                </div>
              )}

              <div className="relative">
                {/* <button 
                  onClick={() => setShowContactMenu(!showContactMenu)}
                  className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                >
                  <MoreVertical className="w-5 h-5 text-gray-600" />
                </button> */}
                {showContactMenu && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setShowContactMenu(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-20 border border-gray-200">
                      <button
                        onClick={() => {
                          router.push(`/crm/contacts/${contact.id}/edit`);
                          setShowContactMenu(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Edit Contact
                      </button>
                      <button
                        onClick={() => {
                          setShowInteractionModal(true);
                          setShowContactMenu(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        View Interactions
                      </button>
                      <button
                        onClick={() => {
                          // TODO: Implement delete
                          setShowContactMenu(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                      >
                        Delete Contact
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Contact Info Card */}
          <div className="bg-gray-50 rounded-xl p-4">
            {/* Row 1 - Basic Contact Information */}
            <div className="grid grid-cols-6 gap-4 mb-4 items-start">
              <div className="flex items-center">
                <span className="text-xs font-bold  b text-gray-400 uppercase tracking-wider">
                  Contact Info
                </span>
              </div>

              <div className="col-span-5 grid grid-cols-5 gap-4">
                <div>
                  <Label className="text-xs font-medium text-gray-500">Email</Label>
                  <a 
                    href={`mailto:${contact.email}`}
                    className="mt-1 block text-sm font-medium text-blue-600 hover:underline break-all"
                  >
                    {contact.email}
                  </a>
                </div>

                <div>
                  <Label className="text-xs font-medium text-gray-500">Phone</Label>
                  <a
                    href={`tel:${contact.number}`}
                    className="mt-1 block text-sm font-medium text-gray-900 hover:text-blue-600"
                  >
                    {contact.number}
                  </a>
                </div>

                <div>
                  <Label className="text-xs font-medium text-gray-500">Job Title</Label>
                  <p className="mt-1 text-sm font-medium text-gray-900">
                    {contact.designation || '—'}
                  </p>
                </div>

                {contact.linkedinUrl && (
                  <div>
                    <Label className="text-xs font-medium text-gray-500">LinkedIn</Label>
                    <a
                      href={contact.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
                    >
                      <Linkedin size={14} />
                      Profile
                    </a>
                  </div>
                )}

                {contact.twitterHandle && (
                  <div>
                    <Label className="text-xs font-medium text-gray-500">Twitter</Label>
                    <a
                      href={`https://twitter.com/${contact.twitterHandle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
                    >
                      <Twitter size={14} />
                      @{contact.twitterHandle}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Row 2 - Company Information */}
            {contact.client && (
              <div className="grid grid-cols-6 gap-4 pt-4 border-t border-gray-200 mb-4 items-start">
                <div className="flex items-center">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Company Info
                  </span>
                </div>

                <div className="col-span-5 grid grid-cols-5 gap-4">
                  <div>
                    <Label className="text-xs font-medium text-gray-500">Company</Label>
                    <p className="mt-1 text-sm font-medium text-gray-900">
                      {contact.client.client_name}
                    </p>
                  </div>

                  {contact.client.industry && (
                    <div>
                      <Label className="text-xs font-medium text-gray-500">Industry</Label>
                      <p className="mt-1 text-sm font-medium text-gray-900">
                        {contact.client.industry}
                      </p>
                    </div>
                  )}

                  {contact.client.website_url && (
                    <div>
                      <Label className="text-xs font-medium text-gray-500">Website</Label>
                      <a
                        href={contact.client.website_url.startsWith('http') ? contact.client.website_url : `https://${contact.client.website_url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
                      >
                        <Globe size={14} />
                        {contact.client.website_url.replace(/^https?:\/\//, '')}
                      </a>
                    </div>
                  )}

                  {contact.client.group && (
                    <div>
                      <Label className="text-xs font-medium text-gray-500">Client Group</Label>
                      <p className="mt-1 text-sm font-medium text-gray-900">
                        {contact.client.group.name}
                      </p>
                    </div>
                  )}

                  {contact.client.address && (
                    <div className="col-span-2">
                      <Label className="text-xs font-medium text-gray-500 flex items-center gap-1">
                        <MapPin size={12} />
                        Address
                      </Label>
                      <p className="mt-1 text-sm font-medium text-gray-900">
                        {contact.client.address}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Row 3 - Additional Details */}
            <div className="grid grid-cols-6 gap-4 pt-4 border-t border-gray-200 items-start">
              <div className="flex items-center">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Additional Info
                </span>
              </div>

              <div className="col-span-5 grid grid-cols-5 gap-4">
                {contact.preferredContactMethod && (
                  <div>
                    <Label className="text-xs font-medium text-gray-500">Preferred Method</Label>
                    <p className="mt-1 text-sm font-medium text-gray-900 capitalize">
                      {contact.preferredContactMethod}
                    </p>
                  </div>
                )}

                {contact.timezone && (
                  <div>
                    <Label className="text-xs font-medium text-gray-500">Timezone</Label>
                    <p className="mt-1 text-sm font-medium text-gray-900">
                      {contact.timezone}
                    </p>
                  </div>
                )}

                {contact.birthday && (
                  <div>
                    <Label className="text-xs font-medium text-gray-500 flex items-center gap-1">
                      <Cake size={12} />
                      Birthday
                    </Label>
                    <p className="mt-1 text-sm font-medium text-gray-900">
                      {format(new Date(contact.birthday), 'MMMM d')}
                    </p>
                    {upcomingBirthday && (
                      <Badge
                        className={`mt-1 ${
                          upcomingBirthday.isToday
                            ? 'bg-red-100 text-red-700'
                            : upcomingBirthday.isTomorrow
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {upcomingBirthday.isToday
                          ? '🎉 Today!'
                          : upcomingBirthday.isTomorrow
                          ? '🎂 Tomorrow'
                          : `In ${upcomingBirthday.daysUntil} days`}
                      </Badge>
                    )}
                  </div>
                )}

                {contact.anniversary && (
                  <div>
                    <Label className="text-xs font-medium text-gray-500 flex items-center gap-1">
                      <Gift size={12} />
                      Anniversary
                    </Label>
                    <p className="mt-1 text-sm font-medium text-gray-900">
                      {format(new Date(contact.anniversary), 'MMMM d, yyyy')}
                    </p>
                  </div>
                )}

                <div>
                  <Label className="text-xs font-medium text-gray-500">Created</Label>
                  <p className="mt-1 text-sm font-medium text-gray-900">
                    {format(new Date(contact.createdAt), 'MMM d, yyyy')}
                  </p>
                  {contact.creator && (
                    <p className="text-xs text-gray-500">by {contact.creator.name}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Row 4 - Organization Hierarchy (if exists)
            {(contact.reportsTo || contact.manages.length > 0) && (
              <div className="grid grid-cols-6 gap-4 pt-4 border-t border-gray-200 items-start">
                <div className="flex items-center">
                  <span className="text-xs font-normal text-gray-400 uppercase tracking-wider">
                    Organization
                  </span>
                </div>

                <div className="col-span-5 grid grid-cols-5 gap-4">
                  {contact.reportsTo && (
                    <div>
                      <Label className="text-xs font-medium text-gray-500">Reports To</Label>
                      <button
                        onClick={() => router.push(`/crm/contacts/${contact.reportsTo!.id}`)}
                        className="mt-1 block text-sm font-medium text-blue-600 hover:underline"
                      >
                        {contact.reportsTo.name}
                      </button>
                      {contact.reportsTo.designation && (
                        <p className="text-xs text-gray-500">{contact.reportsTo.designation}</p>
                      )}
                    </div>
                  )}

                  {contact.manages.length > 0 && (
                    <div>
                      <Label className="text-xs font-medium text-gray-500">Manages</Label>
                      <p className="mt-1 text-sm font-medium text-gray-900">
                        {contact.manages.length} {contact.manages.length === 1 ? 'person' : 'people'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )} */}

            {/* Row 5 - Stats */}
            <div className="grid grid-cols-6 gap-4 pt-4 border-t border-gray-200 items-start">
              <div className="flex items-center">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Statistics
                </span>
              </div>

              <div className="col-span-5 grid grid-cols-5 gap-4">
                <div>
                  <Label className="text-xs font-medium text-gray-500">Last Interaction</Label>
                  <p className="mt-1 text-sm font-medium text-gray-900">
                    {contact.stats.daysSinceLastInteraction !== null
                      ? contact.stats.daysSinceLastInteraction === 0
                        ? 'Today'
                        : `${contact.stats.daysSinceLastInteraction}d ago`
                      : 'Never'}
                  </p>
                </div>

                <div>
                  <Label className="text-xs font-medium text-gray-500">Total Interactions</Label>
                  <p className="mt-1 text-sm font-medium text-gray-900">
                    {contact.stats.totalInteractions}
                  </p>
                </div>

                <div>
                  <Label className="text-xs font-medium text-gray-500">Relationship</Label>
                  <p className="mt-1 text-sm font-medium text-gray-900">
                    {Math.floor(contact.stats.relationshipDurationDays / 30)} months
                  </p>
                </div>

                <div>
                  <Label className="text-xs font-medium text-gray-500">Associated Matters</Label>
                  <p className="mt-1 text-sm font-medium text-gray-900">
                    {contact.stats.mattersCount}
                  </p>
                </div>

                <div>
                  <Label className="text-xs font-medium text-gray-500">Associated Tasks</Label>
                  <p className="mt-1 text-sm font-medium text-gray-900">
                    {contact.stats.tasksCount}
                  </p>
                </div>
              </div>
            </div>

            {/* Row 6 - Notes and Tags (if exist) */}
            {(contact.notes || contact.tags.length > 0) && (
              <div className="grid grid-cols-6 gap-4 pt-4 border-t border-gray-200 items-start">
                <div className="flex items-center">
                  <span className="text-xs font-normal text-gray-400 uppercase tracking-wider">
                    Notes & Tags
                  </span>
                </div>

                <div className="col-span-5 space-y-3">
                  {contact.notes && (
                    <div>
                      <Label className="text-xs font-medium text-gray-500">Notes</Label>
                      <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">
                        {contact.notes}
                      </p>
                    </div>
                  )}

                  {contact.tags.length > 0 && (
                    <div>
                      <Label className="text-xs font-medium text-gray-500">Tags</Label>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {contact.tags.map((tag, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Interaction Timeline Modal */}
      {showInteractionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Interaction Timeline</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowInteractionModal(false)}
                >
                  Close
                </Button>
              </div>
              <InteractionTimeline
                contactId={contact.id}
                contactName={contact.name}
                onClose={() => setShowInteractionModal(false)}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}