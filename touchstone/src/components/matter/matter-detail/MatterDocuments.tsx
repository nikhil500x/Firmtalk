'use client';

import { useRouter } from 'next/navigation';
import { FileText, ArrowRight } from 'lucide-react';

export default function MatterDocuments() {
  const router = useRouter();

  return (
    <div className="h-screen flex flex-col items-center justify-start bg-gray-50 px-4 pt-24">
      <div className="flex flex-col items-center text-center space-y-3 max-w-md">
        <div className="p-5 bg-blue-100 rounded-full">
          <FileText className="w-10 h-10 text-blue-600" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900">
          Document Management
        </h1>
        <p className="text-gray-600 max-w-sm text-sm">
          Access your Azure OneDrive and SharePoint documents for this matter. Connect your Azure account to get started.
        </p>
        <button
          onClick={() => router.push('/document')}
          className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          Go to Documents
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
