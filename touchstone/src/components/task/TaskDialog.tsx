import { useState, useEffect } from 'react';
import { X, User, Flag, Paperclip, ChevronDown, Send, Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { API_ENDPOINTS } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'react-toastify';

interface Matter {
  matter_id: number;
  matter_title: string;
  client: {
    client_id: number;
    client_name: string;
  };
}

interface User {
  user_id: number;
  name: string;
  email: string;
}

interface TaskAssignment {
  user_id: number;
  status: string;
  completed_at: string | null;
  completed_by: number | null;
  user: User;
  completer?: {
    user_id: number;
    name: string;
    email: string;
  } | null;
}

interface Task {
  task_id: number;
  task_name: string;
  description: string | null;
  matter_id: number | null;  // CHANGE: Add | null
  client_id: number | null;  // CHANGE: Add | null
  assigned_by: number | null;
  priority: string;
  due_date: string;
  status: string;
  comments: string | null;
  matter?: {
    matter_id: number;
    matter_title: string;
  } | null;  // CHANGE: Add | null
  client?: {
    client_id: number;
    client_name: string;
  } | null;  // CHANGE: Add | null
  task_assignments?: TaskAssignment[];
  assigner?: {
    user_id: number;
    name: string;
    email: string;
  } | null;
  user_status?: string | null;
  user_completed_at?: string | null;
}

interface Comment {
  user: string;
  text: string;
  timestamp: string;
  avatar: string;
}

interface TaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'add' | 'edit' | 'view';
  taskId?: number;
  onSuccess?: () => void;
}

export default function TaskDialog({ isOpen, onClose, mode, taskId, onSuccess }: TaskDialogProps) {
  const [taskName, setTaskName] = useState('');
  const [selectedMatter, setSelectedMatter] = useState<Matter | null>(null);
  const [selectedClient, setSelectedClient] = useState<{ client_id: number; client_name: string } | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('medium');
  const [assignedTo, setAssignedTo] = useState<User[]>([]);  // Changed to array
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('todo');
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState<Comment[]>([]);
  const [taskData, setTaskData] = useState<Task | null>(null);  // Store full task data
  
  const [matters, setMatters] = useState<Matter[]>([]);
  const [clients, setClients] = useState<{ client_id: number; client_name: string }[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  const [matterComboboxOpen, setMatterComboboxOpen] = useState(false);
  const [clientComboboxOpen, setClientComboboxOpen] = useState(false);
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [filteredMatters, setFilteredMatters] = useState<Matter[]>([]);
  const [filteredClients, setFilteredClients] = useState<{ client_id: number; client_name: string }[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchCurrentUser();
      fetchMatters();
      fetchClients();
      fetchUsers();
      
      if (mode === 'edit' || mode === 'view') {
        if (taskId) {
          fetchTaskDetails(taskId);
        }
      } else {
        resetForm();
      }
    }
  }, [isOpen, mode, taskId]);

  useEffect(() => {
    if (selectedClient && !selectedMatter) {
      const filtered = matters.filter(m => m.client.client_id === selectedClient.client_id);  // ✅ This line is fine
      setFilteredMatters(filtered);
    } else {
      setFilteredMatters(matters);
    }
  }, [selectedClient, matters, selectedMatter]);

  useEffect(() => {
    if (selectedMatter && !selectedClient) {
      const filtered = clients.filter(c => c.client_id === selectedMatter.client.client_id);  // ✅ This line is fine
      setFilteredClients(filtered);
    } else {
      setFilteredClients(clients);
    }
  }, [selectedMatter, clients, selectedClient]);

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.auth.session, {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success && data.data?.user) {
        setCurrentUser({
          user_id: data.data.user.id,
          name: data.data.user.name,
          email: data.data.user.email,
        });
      }
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  };

  const fetchTaskDetails = async (id: number) => {
    try {
      setLoading(true);
      const response = await fetch(API_ENDPOINTS.tasks.byId(id), {
        credentials: 'include',
      });
      const data = await response.json();
      
      if (data.success && data.data) {
        const task: Task = data.data;
        setTaskData(task);  // Store full task data
        setTaskName(task.task_name);
        setDescription(task.description || '');
        setDueDate(task.due_date.split('T')[0]);
        setPriority(task.priority);
        setStatus(task.user_status || task.status || 'todo');  // Use user's specific status
        
        if (task.matter) {
          setSelectedMatter({
            matter_id: task.matter.matter_id,
            matter_title: task.matter.matter_title,
            client: task.client!,
          });
        }
        
        if (task.client) {
          setSelectedClient({
            client_id: task.client.client_id,
            client_name: task.client.client_name,
          });
        }
        
        // Set assigned users from task_assignments
        if (task.task_assignments && task.task_assignments.length > 0) {
          setAssignedTo(task.task_assignments.map(a => a.user));
        }

        if (task.comments) {
          try {
            const parsedComments = JSON.parse(task.comments);
            if (Array.isArray(parsedComments)) {
              setComments(parsedComments);
            }
          } catch {
            setComments([{
              user: task.assigner?.name || 'Unknown',
              text: task.comments,
              timestamp: new Date().toISOString(),
              avatar: task.assigner?.name?.charAt(0) || 'U',
            }]);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching task details:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMatters = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.matters.list, {
        credentials: 'include',
      });
      const data = await response.json();
      
      if (data.success && data.data) {
        const transformedMatters = data.data.map((matter: {
          matter_id?: number;
          id?: number;
          matter_title?: string;
          title?: string;
          matterTitle?: string;
          client?: {
            client_id?: number;
            id?: number;
            client_name?: string;
            companyName?: string;
            clientName?: string;
          };
          clientId?: number;
          [key: string]: unknown;
        }) => ({
          matter_id: matter.matter_id || matter.id || 0,
          matter_title: matter.matter_title || matter.title || matter.matterTitle || '',
          client: {
            client_id: matter.client?.client_id || matter.client?.id || matter.clientId || 0,
            client_name: (typeof (matter.client?.client_name || matter.client?.companyName || matter.clientName) === 'string' 
              ? (matter.client?.client_name || matter.client?.companyName || matter.clientName) 
              : '') as string,
          }
        })).filter((m: Matter) => m.matter_id > 0);
        setMatters(transformedMatters);
      } else if (Array.isArray(data)) {
        const transformedMatters = data.map((matter: {
          matter_id?: number;
          id?: number;
          matter_title?: string;
          title?: string;
          matterTitle?: string;
          client?: {
            client_id?: number;
            id?: number;
            client_name?: string;
            companyName?: string;
            clientName?: string;
          };
          clientId?: number;
          [key: string]: unknown;
        }) => ({
          matter_id: matter.matter_id || matter.id || 0,
          matter_title: matter.matter_title || matter.title || matter.matterTitle || '',
          client: {
            client_id: matter.client?.client_id || matter.client?.id || matter.clientId || 0,
            client_name: (typeof (matter.client?.client_name || matter.client?.companyName || matter.clientName) === 'string' 
              ? (matter.client?.client_name || matter.client?.companyName || matter.clientName) 
              : '') as string,
          }
        })).filter((m: Matter) => m.matter_id > 0);
        setMatters(transformedMatters);
      }
    } catch (error) {
      console.error('Error fetching matters:', error);
    }
  };

  const fetchClients = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.clients.list, {
        credentials: 'include',
      });
      const data = await response.json();
      
      if (data.success && data.data) {
        const transformedClients = data.data.map((client: {
          client_id?: number;
          id?: number;
          client_name?: string;
          companyName?: string;
          name?: string;
          [key: string]: unknown;
        }) => ({
          client_id: client.client_id || client.id || 0,
          client_name: (client.client_name || client.companyName || client.name || '') as string,
        })).filter((c: { client_id: number; client_name: string }) => c.client_id > 0);
        setClients(transformedClients);
      } else if (Array.isArray(data)) {
        const transformedClients = data.map((client: {
          client_id?: number;
          id?: number;
          client_name?: string;
          companyName?: string;
          name?: string;
          [key: string]: unknown;
        }) => ({
          client_id: client.client_id || client.id || 0,
          client_name: (client.client_name || client.companyName || client.name || '') as string,
        })).filter((c: { client_id: number; client_name: string }) => c.client_id > 0);
        setClients(transformedClients);
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.users.list, {
        credentials: 'include',
      });
      const data = await response.json();
      
      if (data.success && data.data) {
        const transformedUsers = data.data
          .filter((user: {
            user_id?: number;
            id?: number;
            [key: string]: unknown;
          }) => user.user_id || user.id)
          .map((user: {
            user_id?: number;
            id?: number;
            name?: string;
            email?: string;
            [key: string]: unknown;
          }) => ({
            user_id: user.user_id || user.id || 0,
            name: (user.name || '') as string,
            email: (user.email || '') as string,
          })).filter((u: { user_id: number; name: string; email: string }) => u.user_id > 0);
        setUsers(transformedUsers);
      } else if (Array.isArray(data)) {
        const transformedUsers = data
          .filter((user: {
            user_id?: number;
            id?: number;
            [key: string]: unknown;
          }) => user.user_id || user.id)
          .map((user: {
            user_id?: number;
            id?: number;
            name?: string;
            email?: string;
            [key: string]: unknown;
          }) => ({
            user_id: user.user_id || user.id || 0,
            name: (user.name || '') as string,
            email: (user.email || '') as string,
          })).filter((u: { user_id: number; name: string; email: string }) => u.user_id > 0);
        setUsers(transformedUsers);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const resetForm = () => {
    setTaskName('');
    setSelectedMatter(null);
    setSelectedClient(null);
    setDueDate('');
    setPriority('medium');
    setAssignedTo([]);  // Changed to empty array
    setDescription('');
    setStatus('todo');
    setNewComment('');
    setComments([]);
    setTaskData(null);
  };

  const handleSave = async () => {
    if (!taskName.trim()) {
        // alert('Task Name is required');
        toast.error('Task Name is required');
        return;
    }
    // REMOVE OR COMMENT OUT these validations:
    // if (!selectedMatter?.matter_id) {
    //     alert('Matter is required');
    //     return;
    // }
    // if (!selectedClient?.client_id) {
    //     alert('Client is required');
    //     return;
    // }
    
    if (!dueDate) {
        // alert('Due Date is required');
        toast.error('Due Date is required');
        return;
    }
    if (assignedTo.length === 0) {
        // alert('At least one lawyer must be assigned');
        toast.error('At least one lawyer must be assigned');
        return;
    }

    try {
      setSaving(true);

      const taskData = {
        task_name: taskName,
        matter_id: selectedMatter?.matter_id || null,  // CHANGE: Use optional chaining
        client_id: selectedClient?.client_id || null,   // CHANGE: Use optional chaining
        assigned_to: assignedTo.map(user => user.user_id),
        assigned_by: currentUser?.user_id || null,
        priority,
        due_date: dueDate,
        status: mode === 'add' ? 'todo' : status,
        description: description || null,
        comments: comments.length > 0 ? JSON.stringify(comments) : null,
      };

      let response;
      if (mode === 'edit' && taskId) {
        response = await fetch(API_ENDPOINTS.tasks.update(taskId), {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(taskData),
        });
      } else {
        response = await fetch(API_ENDPOINTS.tasks.create, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(taskData),
        });
      }

      const data = await response.json();
      
      if (data.success) {
        onSuccess?.();
        onClose();
        resetForm();
      } else {
        // alert(data.message || 'Failed to save task');
        toast.error(data.message || 'Failed to save task');
      }
    } catch (error) {
      console.error('Error saving task:', error);
      // alert('Failed to save task');
      toast.error('Failed to save task');
    } finally {
      setSaving(false);
    }
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;

    const comment: Comment = {
      user: currentUser?.name || 'You',
      text: newComment,
      timestamp: new Date().toISOString(),
      avatar: currentUser?.name?.charAt(0) || 'U',
    };

    setComments([...comments, comment]);
    setNewComment('');
  };

  const getStatusOptions = () => [
    { value: 'todo', label: 'To Do' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'overdue', label: 'Over Due' },
  ];

  const getStatusColor = (s: string) => {
    switch (s) {
      case 'todo':
        return 'bg-blue-100 text-blue-700';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-700';
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'overdue':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (!isOpen) return null;

  const isViewMode = mode === 'view';
  const isEditMode = mode === 'edit';
  const isAddMode = mode === 'add';

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
           {/* Status Dropdown */}
            <div className="relative">
              {isAddMode ? (
                <div className={`px-3 py-1.5 rounded-full text-sm font-semibold border ${getStatusColor('todo')}`}>
                  To Do
                </div>
              ) : (
                <>
                  {/* Check if task is completed by checking all assignments */}
                  {(() => {
                    const isTaskCompleted = taskData?.task_assignments?.some(a => a.status === 'completed') || status === 'completed';
                    return (
                      <>
                        <button
                          disabled={isViewMode || isTaskCompleted}
                          onClick={() => !isTaskCompleted && setShowStatusDropdown(!showStatusDropdown)}
                          className={`px-3 py-1.5 rounded-full text-sm font-semibold border ${
                            isTaskCompleted ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                          } disabled:cursor-not-allowed ${getStatusColor(status)}`}
                        >
                          {getStatusOptions().find(s => s.value === status)?.label}
                          {!isViewMode && !isTaskCompleted && <ChevronDown className="inline-block w-4 h-4 ml-1 opacity-60" />}
                          {isTaskCompleted && <span className="ml-1 text-xs">🔒</span>}
                        </button>
                        
                        {!isViewMode && !isTaskCompleted && (
                          <div className="text-xs text-gray-500 mt-1">Your status</div>
                        )}
                        
                        {isTaskCompleted && (
                          <div className="text-xs text-red-500 mt-1">Task is locked (completed)</div>
                        )}

                        {showStatusDropdown && !isViewMode && !isTaskCompleted && (
                          <div className="absolute mt-2 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-30">
                            {getStatusOptions().map(opt => (
                              <button
                                key={opt.value}
                                onClick={() => {
                                  setStatus(opt.value);
                                  setShowStatusDropdown(false);
                                }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-3 gap-6 p-6">
            {/* Left Column - Task Details */}
            <div className="col-span-2 space-y-6">
              {/* Task Name */}
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-2">
                  <div className="w-6 h-6 rounded-full border-2 border-gray-300"></div>
                </div>
                <input
                  type="text"
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  placeholder="Add New Task"
                  disabled={isViewMode}
                  className="flex-1 text-2xl font-normal text-black-400 placeholder-black-300 border-none focus:outline-none disabled:bg-transparent"
                />
              </div>

              {/* Action Buttons Row */}
              <div className="flex items-center gap-3 flex-wrap">
                {/* Matter Combobox */}
                <Popover open={matterComboboxOpen} onOpenChange={setMatterComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={matterComboboxOpen}
                      disabled={isViewMode}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-md border border-gray-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span>{selectedMatter?.matter_title || 'Matter Name (Optional)'}</span>  {/* CHANGE: Use optional chaining */}
                      <ChevronsUpDown className="w-4 h-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search matters..." />
                      <CommandList>
                        <CommandEmpty>No matters available.</CommandEmpty>
                        <CommandGroup>
                          {filteredMatters.map((matter) => (
                            <CommandItem
                              key={matter.matter_id}
                              value={matter.matter_title}
                              onSelect={() => {
                                setSelectedMatter(matter);
                                setSelectedClient(matter.client);
                                setMatterComboboxOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedMatter?.matter_id === matter.matter_id ? "opacity-100" : "opacity-0"  // CHANGE: Use optional chaining
                                )}
                              />
                              {matter.matter_title}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                {/* Client Combobox */}
                <Popover open={clientComboboxOpen} onOpenChange={setClientComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={clientComboboxOpen}
                      disabled={isViewMode}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-md border border-gray-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span>{selectedClient?.client_name || 'Client Name (Optional)'}</span>  {/* CHANGE: Use optional chaining */}
                      <ChevronsUpDown className="w-4 h-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search clients..." />
                      <CommandList>
                        <CommandEmpty>No clients available.</CommandEmpty>
                        <CommandGroup>
                          {filteredClients.map((client) => (
                            <CommandItem
                              key={client.client_id}
                              value={client.client_name}
                              onSelect={() => {
                                setSelectedClient(client);
                                setClientComboboxOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedClient?.client_id === client.client_id ? "opacity-100" : "opacity-0"  // CHANGE: Use optional chaining
                                )}
                              />
                              {client.client_name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                {/* Date Picker */}
                <div className="relative">
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    disabled={isViewMode}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-md border border-gray-300 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>
              </div>

              {/* Second Row of Action Buttons */}
              <div className="flex items-center gap-3 flex-wrap">
                {/* Priority Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => !isViewMode && setShowPriorityDropdown(!showPriorityDropdown)}
                    disabled={isViewMode}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-md border border-gray-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Flag className="w-4 h-4" />
                    <span className="capitalize">{priority} Priority</span>
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  
                  {showPriorityDropdown && (
                    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 w-40">
                      {['high', 'medium', 'low'].map((p) => (
                        <button
                          key={p}
                          onClick={() => {
                            setPriority(p);
                            setShowPriorityDropdown(false);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm capitalize"
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Assign To Combobox - Multi-select with checkboxes */}
                <Popover open={showAssigneeDropdown} onOpenChange={setShowAssigneeDropdown}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={showAssigneeDropdown}
                      disabled={isViewMode}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-md border border-gray-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <User className="w-4 h-4" />
                      <span>
                        {assignedTo.length === 0 
                          ? 'Assign to' 
                          : assignedTo.length === 1 
                          ? assignedTo[0].name 
                          : `${assignedTo.length} lawyers assigned`}
                      </span>
                      <ChevronsUpDown className="w-4 h-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search lawyers..." />
                      <CommandList>
                        <CommandEmpty>No lawyers found.</CommandEmpty>
                        <CommandGroup>
                          {users.map((user) => {
                            const isSelected = assignedTo.some(u => u.user_id === user.user_id);
                            return (
                              <CommandItem
                                key={user.user_id}
                                value={user.name}
                                onSelect={() => {
                                  if (isSelected) {
                                    setAssignedTo(assignedTo.filter(u => u.user_id !== user.user_id));
                                  } else {
                                    setAssignedTo([...assignedTo, user]);
                                  }
                                }}
                                className="flex items-center gap-2 cursor-pointer"
                              >
                                <div className={`w-4 h-4 border-2 rounded flex items-center justify-center flex-shrink-0 ${
                                  isSelected 
                                    ? 'bg-blue-600 border-blue-600' 
                                    : 'border-gray-300'
                                }`}>
                                  {isSelected && (
                                    <Check className="w-3 h-3 text-white" />
                                  )}
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm truncate">{user.name}</div>
                                  <div className="text-xs text-gray-500 truncate">{user.email}</div>
                                </div>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                      
                      {assignedTo.length > 0 && (
                        <div className="border-t border-gray-200 px-3 py-2 bg-gray-50">
                          <div className="flex items-center justify-between text-xs text-gray-600">
                            <span>{assignedTo.length} lawyer{assignedTo.length !== 1 ? 's' : ''} selected</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setAssignedTo([]);
                              }}
                              className="text-blue-600 hover:text-blue-700 font-medium"
                            >
                              Clear all
                            </button>
                          </div>
                        </div>
                      )}
                    </Command>
                  </PopoverContent>
                </Popover>

                {/* Add Attachment */}
                <button
                  disabled={isViewMode}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-md border border-gray-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Paperclip className="w-4 h-4" />
                  <span>Add an Attachment</span>
                </button>
              </div>

              {/* Show selected assignees as chips */}
              {assignedTo.length > 0 && !isViewMode && (
                <div className="flex flex-wrap gap-2">
                  {assignedTo.map((user) => (
                    <div
                      key={user.user_id}
                      className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs"
                    >
                      <span>{user.name}</span>
                      <button
                        onClick={() => setAssignedTo(assignedTo.filter(u => u.user_id !== user.user_id))}
                        className="hover:bg-blue-100 rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Assigned Lawyers Section - Show in view/edit mode */}
              {(mode === 'edit' || mode === 'view') && assignedTo.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Assigned To</label>
                  <div className="flex flex-wrap gap-2">
                    {assignedTo.map((user) => (
                      <div
                        key={user.user_id}
                        className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                          {user.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{user.name}</div>
                          <div className="text-xs text-gray-500 truncate">{user.email}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Status Summary for All Assignees - Only in view mode */}
              {/* Status Summary for All Assignees - Only in view mode */}
              {mode === 'view' && taskData && taskData.task_assignments && taskData.task_assignments.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Task Status by Lawyer</label>
                  <div className="space-y-2">
                    {taskData.task_assignments.map((assignment) => (
                      <div
                        key={assignment.user_id}
                        className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium">
                            {assignment.user.name.charAt(0)}
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-900">{assignment.user.name}</span>
                            {assignment.status === 'completed' && assignment.completer && (
                              <div className="text-xs text-gray-500">
                                Completed by {assignment.completer.name}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(assignment.status)}`}>
                          {getStatusOptions().find(s => s.value === assignment.status)?.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add a description..."
                  disabled={isViewMode}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:bg-gray-50"
                />
              </div>

              {/* Metadata */}
              <div className="text-xs text-gray-500 space-y-1 pt-4 border-t border-gray-200">
                {mode === 'edit' || mode === 'view' ? (
                  <>
                    <div>Created On: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} - by {currentUser?.name || 'Unknown'}</div>
                    <div>Last Updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} - Checklist updated by {currentUser?.name || 'Unknown'}</div>
                  </>
                ) : null}
              </div>
            </div>

            {/* Right Column - Comments */}
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                {/* Comment Input */}
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                    {currentUser?.name?.charAt(0) || 'U'}
                  </div>
                  <div className="flex-1 relative">
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Write comments or post an update here"
                      disabled={isViewMode}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm disabled:bg-gray-100"
                    />
                    {!isViewMode && (
                      <button
                        onClick={handleAddComment}
                        disabled={!newComment.trim()}
                        className="absolute bottom-2 right-2 p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Comments List */}
                <div className="space-y-4">
                  {comments.map((comment, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                        {comment.avatar}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-gray-900">{comment.user}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(comment.timestamp).toLocaleString('en-US', {
                              weekday: 'short',
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true
                            })}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">{comment.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        {!isViewMode && (
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg border border-gray-300"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : (mode === 'edit' ? 'Update Task' : 'Create Task')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}