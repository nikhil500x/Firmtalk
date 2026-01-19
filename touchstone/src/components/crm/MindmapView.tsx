import React, { useState, useEffect } from 'react';
import { API_ENDPOINTS, apiRequest } from '@/lib/api';
import { Search, Building2, Users, Briefcase } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

interface ClientNode {
  id: number;
  name: string;
  industry: string | null;
  contactCount: number;
  matterCount: number;
  website: string | null;
  address: string | null;
}

interface MindmapViewProps {
  onClientClick: (clientId: number) => void;
}

export default function MindmapView({ onClientClick }: MindmapViewProps) {
  const [clients, setClients] = useState<ClientNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');


  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiRequest<ClientNode[]>(API_ENDPOINTS.orgChart.mindmap);
      if (response.success && response.data) {
        setClients(response.data);
      } else {
        setError('Failed to load organizations');
      }
    } catch (err) {
      console.error('Error fetching mindmap:', err);
      setError(err instanceof Error ? err.message : 'Failed to load organizations');
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (client.industry && client.industry.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="p-6">
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center py-8">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchClients}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Search + View Toggle */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input
            placeholder="Search organizations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* ✅ View Toggle */}
        <div className="flex border rounded-md overflow-hidden">

          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 text-sm font-medium transition ${
              viewMode === 'list'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            List
          </button>
          
          <button
            onClick={() => setViewMode('grid')}
            className={`px-4 py-2 text-sm font-medium transition ${
              viewMode === 'grid'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Grid
          </button>

          
        </div>
      </div>


      {/* ✅ GRID / LIST TOGGLE VIEW */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredClients.length === 0 ? (
            <div className="col-span-full text-center py-8">
              <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-600">No organizations found</p>
            </div>
          ) : (
            filteredClients.map((client) => (
              <Card
                key={client.id}
                className="p-4 cursor-pointer hover:shadow-lg transition-all hover:border-blue-300"
                onClick={() => onClientClick(client.id)}
              >
                <div className="flex items-start gap-3">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <Building2 className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{client.name}</h3>
                    {client.industry && (
                      <p className="text-sm text-gray-600 mt-1">{client.industry}</p>
                    )}
                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        <span>{client.contactCount}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Briefcase className="w-4 h-4" />
                        <span>{client.matterCount}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      ) : (
        /* ✅ LIST VIEW */
        <div className="space-y-2">
          {filteredClients.length === 0 ? (
            <div className="text-center py-8">
              <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-600">No organizations found</p>
            </div>
          ) : (
            filteredClients.map((client) => (
              <div
                key={client.id}
                onClick={() => onClientClick(client.id)}
                className="flex items-center justify-between bg-white border rounded-lg px-4 py-3 hover:bg-gray-50 cursor-pointer"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{client.name}</p>
                  <p className="text-xs text-gray-500">{client.industry || '—'}</p>
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    <span>{client.contactCount}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Briefcase className="w-4 h-4" />
                    <span>{client.matterCount}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

    </div>
  );
}

