/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React from 'react';
import { Calendar, Clock } from 'lucide-react';

const Badge = ({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'success' | 'warning' | 'danger' }) => {
  const variants: Record<'default' | 'success' | 'warning' | 'danger', string> = {
    default: 'bg-blue-100 text-blue-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    danger: 'bg-red-100 text-red-800'
  };
  
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${variants[variant]}`}>
      {children}
    </span>
  );
};

export interface UpcomingDeadlinesProps {
  data: Array<{
    title: string;
    date: string;
    type: string;
  }>;
}

export const UpcomingDeadlines: React.FC<UpcomingDeadlinesProps> = ({ data }) => (
  <div className="bg-white rounded-lg shadow p-6 h-full flex flex-col">
    <div className="mb-3">
      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
        <Calendar className="w-5 h-5 text-blue-600" />
        Upcoming Deadlines
      </h3>
    </div>
    <div className="space-y-2 overflow-y-auto flex-1">
      {data.length > 0 ? (
        data.map((event, idx) => (
          <div key={idx} className="border-l-4 border-blue-500 pl-3 py-2 bg-blue-50 rounded">
            <div className="flex justify-between items-start mb-1">
              <p className="font-medium text-sm text-gray-900 line-clamp-1">{event.title}</p>
              <Badge variant="warning">
                {event.type}
              </Badge>
            </div>
            <p className="text-xs text-gray-600 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(event.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
            </p>
          </div>
        ))
      ) : (
        <p className="text-gray-500 text-center py-8">No upcoming deadlines</p>
      )}
    </div>
  </div>
);

