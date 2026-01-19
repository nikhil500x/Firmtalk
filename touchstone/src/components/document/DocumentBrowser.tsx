'use client';

import { useState } from 'react';
import { Folder, Building2, Search } from 'lucide-react';
import OneDriveView from './OneDriveView';
import SharePointView from './SharePointView';
import SearchView from './SearchView';

export default function DocumentBrowser() {
  const [activeTab, setActiveTab] = useState<'onedrive' | 'sharepoint' | 'search'>('onedrive');

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('onedrive')}
            className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'onedrive'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Folder className="w-5 h-5" />
            OneDrive
          </button>
          <button
            onClick={() => setActiveTab('sharepoint')}
            className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'sharepoint'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Building2 className="w-5 h-5" />
            SharePoint
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'search'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Search className="w-5 h-5" />
            Search
          </button>
        </nav>
      </div>

      {/* Content */}
      <div>
        {activeTab === 'onedrive' ? (
          <OneDriveView />
        ) : activeTab === 'sharepoint' ? (
          <SharePointView />
        ) : (
          <SearchView />
        )}
      </div>
    </div>
  );
}

