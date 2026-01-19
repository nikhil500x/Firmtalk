'use client';

import { Suspense } from 'react';
import DocumentBrowser from '@/components/document/DocumentBrowser';
import { FileText } from 'lucide-react';

function DocumentPageContent() {
  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <FileText className="w-6 h-6 text-blue-600" />
        <h1 className="text-2xl font-semibold text-gray-900">Document Management</h1>
      </div>
      <DocumentBrowser />
    </div>
  );
}

export default function DocumentPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
      <DocumentPageContent />
    </Suspense>
  );
}

