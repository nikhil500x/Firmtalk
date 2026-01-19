import { useState, useEffect } from 'react';
import { X, Calendar } from 'lucide-react';
import { API_ENDPOINTS, apiRequest } from '@/lib/api';

interface SupportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface Client {
  id: number;
  companyName: string;
}

interface Matter {
  id: number;
  matterTitle: string;
  clientId: number;
}

interface User {
  id: number;
  name: string;
  email: string;
}

export default function SupportDialog({ isOpen, onClose, onSuccess }: SupportDialogProps) {
  const [formData, setFormData] = useState({
    subject: '',
    clientId: '',
    matterId: '',
    description: '',
    assignedTo: '',
    category: '',
    priority: 'medium',
    dueDate: '',
  });

  const [clients, setClients] = useState<Client[]>([]);
  const [matters, setMatters] = useState<Matter[]>([]);
  const [filteredMatters, setFilteredMatters] = useState<Matter[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch initial data
  useEffect(() => {
    if (isOpen) {
      fetchClients();
      fetchMatters();
      fetchUsers();
    }
  }, [isOpen]);

  // Filter matters based on selected client
  useEffect(() => {
    if (formData.clientId) {
      const filtered = matters.filter(
        (matter) => matter.clientId === parseInt(formData.clientId)
      );
      setFilteredMatters(filtered);
      
      // Reset matter selection if current selection doesn't belong to selected client
      if (formData.matterId) {
        const matterExists = filtered.some(
          (m) => m.id === parseInt(formData.matterId)
        );
        if (!matterExists) {
          setFormData((prev) => ({ ...prev, matterId: '' }));
        }
      }
    } else {
      setFilteredMatters(matters);
    }
  }, [formData.clientId, matters]);

  const fetchClients = async () => {
    try {
      const response = await apiRequest<Client[]>(API_ENDPOINTS.clients.list);
      
      if (response.success && response.data) {
        const clientsData = Array.isArray(response.data) ? response.data : response.data;
        console.log('Clients loaded:', clientsData.length);
        setClients(clientsData);
      }
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    }
  };

  const fetchMatters = async () => {
    try {
      const response = await apiRequest<Matter[]>(API_ENDPOINTS.matters.list);
      
      if (response.success && response.data) {
        const mattersData = Array.isArray(response.data) ? response.data : response.data;
        console.log('Matters loaded:', mattersData.length);
        setMatters(mattersData);
        setFilteredMatters(mattersData);
      }
    } catch (error) {
      console.error('Failed to fetch matters:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await apiRequest<User[]>(API_ENDPOINTS.users.list);
      
      if (response.success && response.data) {
        const usersData = Array.isArray(response.data) ? response.data : response.data;
        console.log('Users loaded:', usersData.length);
        setUsers(usersData);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.subject.trim()) {
      newErrors.subject = 'Subject is required';
    }

    if (!formData.category) {
      newErrors.category = 'Category is required';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Create ticket payload
      const payload: {
        subject: string;
        description: string;
        category: string;
        priority: string;
        clientId?: number;
        matterId?: number;
        dueDate?: string;
      } = {
        subject: formData.subject.trim(),
        description: formData.description.trim(),
        category: formData.category,
        priority: formData.priority,
      };

      // Add optional fields only if they have values
      if (formData.clientId) {
        payload.clientId = parseInt(formData.clientId);
      }
      
      if (formData.matterId) {
        payload.matterId = parseInt(formData.matterId);
      }

      if (formData.dueDate) {
        payload.dueDate = formData.dueDate;
      }

      console.log('Creating ticket with payload:', payload);

      const response = await apiRequest(API_ENDPOINTS.support.create, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      console.log('Create ticket response:', response);

      if (response.success && response.data) {
        const ticketId = (response.data as { id?: number }).id;
        if (!ticketId) return;

        // If assigned to someone, make assignment call
        if (formData.assignedTo) {
          console.log('Assigning ticket to user ID:', formData.assignedTo);
          
          try {
            const assignResponse = await apiRequest(API_ENDPOINTS.support.assign(ticketId), {
              method: 'PUT',
              body: JSON.stringify({ userId: parseInt(formData.assignedTo) }),
            });
            console.log('Assignment response:', assignResponse);
          } catch (assignError) {
            console.error('Failed to assign ticket:', assignError);
            // Continue even if assignment fails - ticket is already created
          }
        }

        onSuccess();
        handleClose();
      }
    } catch (error) {
      console.error('Failed to create ticket:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create ticket';
      setErrors({ submit: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      subject: '',
      clientId: '',
      matterId: '',
      description: '',
      assignedTo: '',
      category: '',
      priority: 'medium',
      dueDate: '',
    });
    setErrors({});
    onClose();
  };

  // Get today's date in YYYY-MM-DD format for min date
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Raise A Ticket</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Subject */}
          <div>
            <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
              Subject
            </label>
            <input
              type="text"
              id="subject"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.subject ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter ticket subject"
            />
            {errors.subject && (
              <p className="mt-1 text-sm text-red-600">{errors.subject}</p>
            )}
          </div>

          {/* Category */}
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <select
              id="category"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${
                errors.category ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Select category</option>
              <option value="technical">Technical</option>
              <option value="hr">HR</option>
              <option value="accounts">Accounts</option>
              <option value="general">General</option>
            </select>
            {errors.category && (
              <p className="mt-1 text-sm text-red-600">{errors.category}</p>
            )}
          </div>

          {/* Priority */}
          <div>
            <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-2">
              Priority
            </label>
            <select
              id="priority"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          {/* Client Name and Matter ID Row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Client Name */}
            <div>
              <label htmlFor="clientId" className="block text-sm font-medium text-gray-700 mb-2">
                Client Name
              </label>
              <select
                id="clientId"
                value={formData.clientId}
                onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Select client (optional)</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.companyName}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                {clients.length} client{clients.length !== 1 ? 's' : ''} available
              </p>
            </div>

            {/* Matter ID */}
            <div>
              <label htmlFor="matterId" className="block text-sm font-medium text-gray-700 mb-2">
                Select Matter ID
              </label>
              <select
                id="matterId"
                value={formData.matterId}
                onChange={(e) => setFormData({ ...formData, matterId: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                disabled={!formData.clientId}
              >
                <option value="">Select matter (optional)</option>
                {filteredMatters.map((matter) => (
                  <option key={matter.id} value={matter.id}>
                    {matter.matterTitle}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                {formData.clientId 
                  ? `${filteredMatters.length} matter${filteredMatters.length !== 1 ? 's' : ''} for this client`
                  : 'Select a client first'
                }
              </p>
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Description/ Issue
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={6}
              className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${
                errors.description ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Describe your issue in detail..."
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600">{errors.description}</p>
            )}
          </div>

          {/* Assigned To and Due Date Row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Assigned To */}
            <div>
              <label htmlFor="assignedTo" className="block text-sm font-medium text-gray-700 mb-2">
                Assigned To
              </label>
              <select
                id="assignedTo"
                value={formData.assignedTo}
                onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Assign to someone (optional)</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.email})
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                {users.length} user{users.length !== 1 ? 's' : ''} available
              </p>
            </div>

            {/* Due Date */}
            <div>
              <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 mb-2">
                Due Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  id="dueDate"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  min={getTodayDate()}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">Optional</p>
            </div>
          </div>

          {/* Error Message */}
          {errors.submit && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{errors.submit}</p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-6 py-3 border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Submitting...' : 'Submit Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}