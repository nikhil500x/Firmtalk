'use client';

import React from 'react';
import { Clock, Rocket } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ComingSoonPage() {
  const router = useRouter();

  return (
    <div className="h-screen flex flex-col items-center justify-start bg-gray-50 px-4 pt-24">
      <div className="flex flex-col items-center text-center space-y-3">
        <div className="p-5 bg-blue-100 rounded-full">
          <Rocket className="w-10 h-10 text-blue-600" />
        </div>

        <h1 className="text-xl font-semibold text-gray-900">
          New Features Coming Soon 🚀
        </h1>

        <p className="text-gray-600 max-w-sm text-sm">
          We’re working hard to bring you some powerful new tools and features.
          Stay tuned — updates are on the way!
        </p>

        <div className="flex items-center gap-2 text-gray-500 text-sm mt-1">
          <Clock className="w-4 h-4" />
          <span>Expected rollout soon</span>
        </div>

        <button
          onClick={() => router.push('/dashboard')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}
