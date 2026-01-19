'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Phone, Briefcase, Calendar, Award } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import QuickInteractionNote from './QuickInteractionNote';

interface BadgeInfo {
  type: string;
  createdBy: string;
  createdAt: string;
}

interface ContactCardProps {
  contact: {
    id: number;
    name: string;
    email: string;
    phone: string;
    designation: string | null;
    isPrimary: boolean;
    badges: BadgeInfo[];
    createdAt: string;
    updatedAt: string;
  };
  onClick?: () => void;
  showInteractions?: boolean;
  onViewInteractions?: () => void;
  associatedDealsCount?: number;
  lastActivityDate?: string | null;
}

const badgeColors: Record<string, { bg: string; text: string; label: string }> = {
  champion: { bg: 'bg-green-100', text: 'text-green-700', label: 'Champion' },
  blocker: { bg: 'bg-red-100', text: 'text-red-700', label: 'Blocker' },
  influencer: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Influencer' },
  budget_holder: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Budget Holder' },
  end_user: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'End User' },
  decision_maker: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Decision Maker' },
};

export default function ContactCard({
  contact,
  onClick,
  showInteractions = true,
  onViewInteractions,
  associatedDealsCount = 0,
  lastActivityDate,
}: ContactCardProps) {
  const router = useRouter();

  const handleCardClick = () => {
    if (onClick) {
      onClick();
    } else {
      // Default: navigate to contact detail view
      router.push(`/crm/contacts/${contact.id}`);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd/MM/yyyy');
    } catch {
      return dateString;
    }
  };

  return (
    <div
      className={`
        bg-white rounded-lg border-2 p-4 shadow-sm
        cursor-pointer hover:shadow-md hover:border-blue-300 transition-all
        ${contact.isPrimary ? 'border-blue-400 bg-blue-50' : 'border-gray-200'}
        min-w-[280px] max-w-[320px]
      `}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCardClick();
        }
      }}
    >
      {/* Header with Avatar and Name */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-12 h-12 rounded-full bg-blue-500 text-white flex items-center justify-center font-semibold text-sm flex-shrink-0">
          {getInitials(contact.name)}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{contact.name}</h3>
          {contact.designation && (
            <p className="text-sm text-gray-600 truncate flex items-center gap-1 mt-1">
              <Briefcase className="w-3 h-3" />
              {contact.designation}
            </p>
          )}
        </div>
      </div>

      {/* Contact Info */}
      <div className="space-y-2 mb-3">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Mail className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">{contact.email}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Phone className="w-4 h-4 flex-shrink-0" />
          <span>{contact.phone}</span>
        </div>
      </div>

      {/* Badges */}
      {contact.badges && contact.badges.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {contact.badges.map((badge, idx) => {
            const badgeConfig = badgeColors[badge.type] || {
              bg: 'bg-gray-100',
              text: 'text-gray-700',
              label: badge.type,
            };
            return (
              <Badge
                key={idx}
                className={`${badgeConfig.bg} ${badgeConfig.text} text-xs font-medium`}
              >
                <Award className="w-3 h-3 mr-1" />
                {badgeConfig.label}
              </Badge>
            );
          })}
        </div>
      )}

      {/* Stats */}
      <div className="border-t pt-3 space-y-2">
        {associatedDealsCount > 0 && (
          <div className="text-xs text-gray-600">
            Associated Deals: <span className="font-semibold">{associatedDealsCount}</span>
          </div>
        )}
        {lastActivityDate && (
          <div className="text-xs text-gray-600 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Last Activity: {formatDate(lastActivityDate)}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-3 pt-3 border-t space-y-2">
        <QuickInteractionNote
          contactId={contact.id}
          contactName={contact.name}
          compact={true}
        />
        {showInteractions && onViewInteractions && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={(e) => {
              e.stopPropagation();
              onViewInteractions();
            }}
          >
            View Interactions
          </Button>
        )}
      </div>
    </div>
  );
}

