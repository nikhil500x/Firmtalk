'use client';

import React, { useState } from 'react';

interface ReferredByProps {
  internalReference?: {
    id: number;
    name: string;
    email: string;
    phone?: string;
  } | null;
  externalReferenceName?: string | null;
  className?: string;
}

export default function ReferredBy({ 
  internalReference, 
  externalReferenceName,
  className = "text-sm text-gray-600"
}: ReferredByProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const referrers: string[] = [];
  
  if (internalReference?.name) {
    referrers.push(internalReference.name);
  }
  if (externalReferenceName) {
    referrers.push(externalReferenceName);
  }

  if (referrers.length === 0) {
    return <span className={className}>N/A</span>;
  }

  if (referrers.length === 1) {
    return <span className={className}>{referrers[0]}</span>;
  }

  // Multiple referrers - show first with +count, tooltip on hover
  const firstReferrer = referrers[0];
  const remainingCount = referrers.length - 1;
  const remainingReferrers = referrers.slice(1);

  return (
    <div className="relative inline-block">
      <span 
        className={`${className} cursor-help`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {firstReferrer} <span className="text-gray-400">+{remainingCount}</span>
      </span>
      {showTooltip && (
        <div className="absolute z-50 bottom-full left-0 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg shadow-xl min-w-[180px] max-w-[250px]">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-gray-400 mb-1.5 border-b border-gray-700 pb-1.5">
              Additional Referrers:
            </p>
            <div className="space-y-1">
              {remainingReferrers.map((referrer, index) => (
                <div 
                  key={index}
                  className="text-xs text-gray-200 bg-gray-700/60 px-2.5 py-1.5 rounded-md"
                >
                  {referrer}
                </div>
              ))}
            </div>
          </div>
          {/* Arrow pointing down */}
          <div className="absolute top-full left-4 -mt-1 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-gray-800"></div>
        </div>
      )}
    </div>
  );
}

