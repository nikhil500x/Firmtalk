'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, File, Folder, Building2, RefreshCw, Download, AlertCircle, Loader2, Inbox } from 'lucide-react';
import { API_ENDPOINTS, apiRequest } from '@/lib/api';
import FileTypeIcon from './FileTypeIcon';
import { Skeleton } from '@/components/ui/skeleton';

interface SearchResult {
  id: string;
  name: string;
  webUrl?: string;
  folder?: {
    childCount: number;
  };
  file?: {
    mimeType: string;
    size: number;
  };
  lastModifiedDateTime?: string;
  source: 'onedrive' | 'sharepoint';
  siteName?: string;
  path?: string;
}

interface SearchResponse {
  files: SearchResult[];
  limit?: number;
  skip?: number;
  hasMore?: boolean;
  searchDepth?: {
    oneDrive: number;
    sharePoint: number;
    attempts: number;
  };
}

export default function SearchView() {
  const [searchQuery, setSearchQuery] = useState('');
  const [useRegex, setUseRegex] = useState(false);
  const [searchOneDrive, setSearchOneDrive] = useState(true);
  const [searchSharePoint, setSearchSharePoint] = useState(true);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [currentQuery, setCurrentQuery] = useState('');
  const [currentSkip, setCurrentSkip] = useState(0);
  const resultsContainerRef = useRef<HTMLDivElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const handleSearch = async (reset: boolean = true) => {
    if (!searchQuery.trim()) {
      setError('Please enter a search query');
      return;
    }

    const query = searchQuery.trim();
    const skip = reset ? 0 : currentSkip;

    try {
      if (reset) {
        setLoading(true);
        setResults([]);
        setCurrentSkip(0);
        setCurrentQuery(query);
      } else {
        setLoadingMore(true);
      }
      setError(null);
      setHasSearched(true);

      const response = await apiRequest<SearchResponse>(API_ENDPOINTS.azure.documents.search, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          useRegex,
          searchOneDrive,
          searchSharePoint,
          limit: 100,
          skip,
        }),
      });

      if (response.success && response.data) {
        const newFiles = response.data.files || [];
        
        if (reset) {
          setResults(newFiles);
        } else {
          // Append new results to existing ones
          setResults(prev => [...prev, ...newFiles]);
        }
        
        setHasMore(response.data.hasMore || false);
        setCurrentSkip(skip + newFiles.length);
        
        if (newFiles.length === 0 && reset) {
          setError('No files found matching your search');
        }
      } else {
        setError(response.message || 'Search failed');
        if (reset) {
          setResults([]);
        }
      }
    } catch (err) {
      console.error('Failed to search files:', err);
      if (err instanceof Error && err.message.includes('not connected')) {
        setError('Azure account not connected. Please connect your Azure account to search files.');
      } else if (err instanceof Error && err.message.includes('Invalid regex')) {
        setError(err.message);
      } else {
        setError('Failed to search files. Please try again.');
      }
      if (reset) {
        setResults([]);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore && currentQuery === searchQuery.trim()) {
      handleSearch(false);
    }
  }, [loadingMore, hasMore, currentQuery, searchQuery, handleSearch]);

  // Infinite scroll handler
  useEffect(() => {
    const container = resultsContainerRef.current;
    if (!container || !hasMore || loadingMore) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      // Load more when user scrolls to 80% of the container
      if (scrollTop + clientHeight >= scrollHeight * 0.8) {
        loadMore();
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [hasMore, loadingMore, loadMore]);

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !loading) {
      handleSearch(true);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Search Form */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="space-y-4">
          {/* Search Input */}
          <div>
            <label htmlFor="search-query" className="block text-sm font-medium text-gray-700 mb-2">
              Search Files
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  ref={searchInputRef}
                  id="search-query"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    setSearchQuery(newValue);
                    
                    // Clear existing timeout
                    if (debounceTimeoutRef.current) {
                      clearTimeout(debounceTimeoutRef.current);
                    }
                    
                    // Trigger debounced search if user is typing (only for non-empty queries)
                    if (newValue.trim().length > 0) {
                      debounceTimeoutRef.current = setTimeout(() => {
                        // Verify the input value hasn't changed before searching
                        if (searchInputRef.current?.value === newValue) {
                          handleSearch(true);
                        }
                      }, 500);
                    }
                  }}
                  onKeyPress={handleKeyPress}
                  placeholder={useRegex ? 'Enter regex pattern (e.g., "^report.*\\.pdf$")' : 'Enter file name or pattern'}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={loading}
                />
              </div>
              <button
                onClick={() => handleSearch(true)}
                disabled={loading || !searchQuery.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Search
                  </>
                )}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {useRegex
                ? 'Using regex pattern matching. Example: "^invoice.*2024\\.xlsx$" to find Excel files starting with "invoice" and ending with "2024.xlsx"'
                : 'Simple text search (case-insensitive). Use regex mode for advanced patterns.'}
            </p>
          </div>

          {/* Search Options */}
          <div className="flex flex-wrap gap-6 pt-4 border-t border-gray-200">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useRegex}
                onChange={(e) => setUseRegex(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                disabled={loading}
              />
              <span className="text-sm font-medium text-gray-700">Use Regex</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={searchOneDrive}
                onChange={(e) => setSearchOneDrive(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                disabled={loading}
              />
              <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
                <Folder className="w-4 h-4" />
                Search OneDrive
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={searchSharePoint}
                onChange={(e) => setSearchSharePoint(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                disabled={loading}
              />
              <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
                <Building2 className="w-4 h-4" />
                Search SharePoint
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Loading Overlay - Shows during entire search process */}
      {loading && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden relative min-h-[400px]">
          <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-10 flex flex-col items-center justify-center py-20">
            <div className="flex flex-col items-center gap-6 max-w-md mx-auto px-6">
              {/* Main Spinner */}
              <div className="relative">
                <Loader2 className="w-16 h-16 text-blue-600 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 bg-blue-100 rounded-full animate-pulse"></div>
                </div>
              </div>
              
              {/* Status Text */}
              <div className="text-center space-y-3">
                <p className="text-xl font-semibold text-gray-900">Searching files...</p>
                
                {/* Active Search Sources */}
                <div className="flex flex-col gap-2 mt-4">
                  {searchOneDrive && (
                    <div className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 rounded-lg border border-blue-200">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">Searching OneDrive</span>
                    </div>
                  )}
                  {searchSharePoint && (
                    <div className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 rounded-lg border border-blue-200">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">Searching SharePoint</span>
                    </div>
                  )}
                </div>
                
                <p className="text-sm text-gray-500 mt-6">
                  Please wait while we search through your files...
                </p>
                
                {/* Depth Indicator */}
                <div className="mt-4 space-y-2">
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full animate-pulse transition-all duration-300" style={{ width: '60%' }}></div>
                  </div>
                  <p className="text-xs text-gray-400">
                    Searching at increased depth to find more files...
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Placeholder content to maintain layout (hidden but maintains structure) */}
          <div className="opacity-0 pointer-events-none">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">Search Results</h3>
            </div>
            <div className="p-6">
              <div className="h-64"></div>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {hasSearched && !loading && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900">
              Search Results ({results.length} {results.length === 1 ? 'file' : 'files'}{hasMore ? '+' : ''})
            </h3>
          </div>

          {results.length === 0 ? (
            <div className="text-center py-16">
              <Inbox className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No files found</h3>
              <p className="text-sm text-gray-500 mb-4">
                Try adjusting your search query or use regex for more specific patterns
              </p>
              <div className="flex flex-col items-center gap-2 text-xs text-gray-400">
                <p>• Make sure you&apos;ve selected OneDrive or SharePoint</p>
                <p>• Try a different search term</p>
                <p>• Use regex mode for advanced pattern matching</p>
              </div>
            </div>
          ) : (
            <div 
              ref={resultsContainerRef}
              className="overflow-x-auto max-h-[600px] overflow-y-auto"
            >
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Source
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Path
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Size
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Modified
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {results.map((item) => (
                    <tr key={item.id} className="hover:bg-blue-50/50 transition-colors cursor-pointer group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <FileTypeIcon
                            mimeType={item.file?.mimeType}
                            isFolder={!!item.folder}
                            fileName={item.name}
                            className="w-5 h-5 flex-shrink-0"
                          />
                          <span className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">{item.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {item.source === 'onedrive' ? (
                            <>
                              <Folder className="w-4 h-4 text-blue-600" />
                              <span className="text-sm text-gray-600">OneDrive</span>
                            </>
                          ) : (
                            <>
                              <Building2 className="w-4 h-4 text-purple-600" />
                              <span className="text-sm text-gray-600">
                                {item.siteName || 'SharePoint'}
                              </span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600 font-mono">
                          {item.path || '/'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {item.folder ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                            <Folder className="w-3 h-3" />
                            Folder
                          </span>
                        ) : (
                          <span className="text-xs text-gray-500">
                            {item.file?.mimeType?.split('/')[1]?.toUpperCase() || 'FILE'}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {item.file ? formatFileSize(item.file.size) : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {item.lastModifiedDateTime
                          ? formatDate(item.lastModifiedDateTime)
                          : '-'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {item.webUrl && !item.folder && (
                          <a
                            href={item.webUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-all border border-transparent hover:border-blue-200"
                            title="Open in new tab"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Download className="w-4 h-4" />
                            Open
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {/* Load More Button / Infinite Scroll */}
              {hasMore && (
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                  {loadingMore ? (
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading more results...
                    </div>
                  ) : (
                    <button
                      onClick={loadMore}
                      className="w-full px-4 py-2 text-sm font-medium text-blue-600 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      Load More Results
                    </button>
                  )}
                </div>
              )}
              
              {!hasMore && results.length > 0 && (
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 text-center text-sm text-gray-500">
                  No more results to load
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

