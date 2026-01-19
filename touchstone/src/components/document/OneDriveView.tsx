'use client';

import { useState, useEffect } from 'react';
import { Folder, File, ArrowLeft, RefreshCw, Download, Upload, FolderPlus, Inbox } from 'lucide-react';
import { API_ENDPOINTS, apiRequest } from '@/lib/api';
import Breadcrumb from './Breadcrumb';
import FileTypeIcon from './FileTypeIcon';
import { Skeleton } from '@/components/ui/skeleton';

interface DriveItem {
  id: string;
  name: string;
  folder?: {
    childCount: number;
  };
  file?: {
    mimeType: string;
    size: number;
  };
  webUrl?: string;
  lastModifiedDateTime?: string;
}

interface OneDriveResponse {
  files: DriveItem[];
}

interface OneDriveViewProps {
  folderPath?: string;
  onNavigate?: (path: string) => void;
}

export default function OneDriveView({ folderPath = '/', onNavigate }: OneDriveViewProps) {
  const [files, setFiles] = useState<DriveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState(folderPath);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiRequest<OneDriveResponse>(
        `${API_ENDPOINTS.azure.documents.onedrive}?folderPath=${encodeURIComponent(currentPath)}`
      );

      if (response.success && response.data) {
        setFiles(response.data.files || []);
      } else {
        setError(response.message || 'Failed to load OneDrive files');
      }
    } catch (err) {
      console.error('Failed to fetch OneDrive files:', err);
      if (err instanceof Error && err.message.includes('not connected')) {
        setError('Azure account not connected. Please connect your Azure account to view OneDrive files.');
      } else {
        setError('Failed to load OneDrive files. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [currentPath]);

  const handleFolderClick = (item: DriveItem) => {
    if (item.folder) {
      const newPath = currentPath === '/' 
        ? `/${item.name}` 
        : `${currentPath}/${item.name}`;
      setCurrentPath(newPath);
      if (onNavigate) {
        onNavigate(newPath);
      }
    }
  };

  const handleBackClick = () => {
    if (currentPath !== '/') {
      const pathParts = currentPath.split('/').filter(Boolean);
      pathParts.pop();
      const newPath = pathParts.length === 0 ? '/' : `/${pathParts.join('/')}`;
      setCurrentPath(newPath);
      if (onNavigate) {
        onNavigate(newPath);
      }
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

  if (loading) {
    return (
      <div className="space-y-4">
        {/* Breadcrumb Skeleton */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-64" />
        </div>
        
        {/* Table Skeleton */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="divide-y divide-gray-200">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="px-4 py-3 flex items-center gap-4">
                <Skeleton className="h-5 w-5 rounded" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
        <button
          onClick={fetchFiles}
          className="mt-4 px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Navigation with Breadcrumb */}
      <div className="flex items-center justify-between">
        <Breadcrumb
          path={currentPath}
          onNavigate={(path) => {
            setCurrentPath(path);
            if (onNavigate) {
              onNavigate(path);
            }
          }}
          rootLabel="OneDrive"
        />
        
        <div className="flex items-center gap-2">
          <button
            onClick={fetchFiles}
            disabled={loading}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Files List */}
      {files.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="text-center py-16">
            <Inbox className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">This folder is empty</h3>
            <p className="text-sm text-gray-500 mb-6">
              {currentPath === '/' 
                ? 'Upload files to get started with OneDrive'
                : 'No files or folders in this directory'}
            </p>
            <div className="flex items-center justify-center gap-3">
              <button className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                <Upload className="w-4 h-4" />
                Upload Files
              </button>
              <button className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                <FolderPlus className="w-4 h-4" />
                New Folder
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Size
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Modified
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {files.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                >
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleFolderClick(item)}
                      className={`flex items-center gap-3 group ${
                        item.folder
                          ? 'text-blue-600 hover:text-blue-700 font-medium'
                          : 'text-gray-900 hover:text-blue-600'
                      } transition-colors`}
                    >
                      <FileTypeIcon
                        mimeType={item.file?.mimeType}
                        isFolder={!!item.folder}
                        fileName={item.name}
                        className="w-5 h-5 flex-shrink-0"
                      />
                      <span className="truncate">{item.name}</span>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
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
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {item.file ? formatFileSize(item.file.size) : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {item.lastModifiedDateTime
                      ? formatDate(item.lastModifiedDateTime)
                      : '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {item.webUrl && !item.folder && (
                      <a
                        href={item.webUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-all border border-transparent hover:border-blue-200"
                        title="Open in new tab"
                      >
                        <Download className="w-4 h-4" />
                        Open
                      </a>
                    )}
                    {item.folder && (
                      <button
                        onClick={() => handleFolderClick(item)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-all"
                        title="Open folder"
                      >
                        Open
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

