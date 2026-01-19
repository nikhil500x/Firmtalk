'use client';

import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbProps {
  path: string;
  onNavigate: (path: string) => void;
  rootLabel?: string;
}

export default function Breadcrumb({ path, onNavigate, rootLabel = 'Root' }: BreadcrumbProps) {
  // Parse path into segments
  const segments = path === '/' ? [] : path.split('/').filter(Boolean);
  
  const handleSegmentClick = (index: number) => {
    if (index === -1) {
      // Clicked on root
      onNavigate('/');
    } else {
      // Build path up to clicked segment
      const newPath = '/' + segments.slice(0, index + 1).join('/');
      onNavigate(newPath);
    }
  };

  return (
    <nav className="flex items-center gap-1 text-sm" aria-label="Breadcrumb">
      <button
        onClick={() => handleSegmentClick(-1)}
        className="flex items-center gap-1 px-2 py-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
        title={rootLabel}
      >
        <Home className="w-4 h-4" />
        <span className="font-medium">{rootLabel}</span>
      </button>
      
      {segments.map((segment, index) => (
        <div key={index} className="flex items-center gap-1">
          <ChevronRight className="w-4 h-4 text-gray-400" />
          <button
            onClick={() => handleSegmentClick(index)}
            className={`px-2 py-1 rounded transition-colors ${
              index === segments.length - 1
                ? 'text-gray-900 font-semibold cursor-default'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
            disabled={index === segments.length - 1}
          >
            {segment}
          </button>
        </div>
      ))}
    </nav>
  );
}

