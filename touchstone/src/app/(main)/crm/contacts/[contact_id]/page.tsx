'use client';

import React, { Suspense } from 'react';
import { useParams } from 'next/navigation';
import ContactDetailView from '@/components/crm/ContactDetailView';
import { Skeleton } from '@/components/ui/skeleton';

function ContactDetailPageContent() {
  const params = useParams();
  const contactId = parseInt(params.contact_id as string);

  if (isNaN(contactId)) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-red-600">Invalid contact ID</p>
        </div>
      </div>
    );
  }

  return <ContactDetailView contactId={contactId} />;
}

export default function ContactDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </div>
      }
    >
      <ContactDetailPageContent />
    </Suspense>
  );
}

