import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
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
import { Plus, Pencil, Trash2, Check, ChevronsUpDown, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import ClientDialog from '@/components/crm/ClientDialog'; // Adjust path as needed
import RateCardDialog from '@/components/invoice/RateCardDialog'; // ✅ ADD THIS
import { convertCurrency, formatAmountWithCurrency, type CurrencyCode } from '@/lib/currencyUtils';
import { useConfig } from '@/hooks/useConfig';

import { toast } from 'react-toastify';

interface Client {
  id: number;
  companyName: string;
  industry?: string;
  clientGroup?: string;
}

interface User {
  id?: number;
  user_id: number;
  name: string;
  email: string;
  role_id: number;
  role?: string;
}

interface TeamMember {
  id?: number;
  user_id: number;
  original_user_id?: number;  // ✅ Track the original user_id
  original_service_type?: string;  // ✅ Track the original service_type
  role: string;
  service_type?: string | null;  
  hourly_rate?: string;
  userName?: string;
  isEditing?: boolean;
  userRole?: string;
  isExisting?: boolean; // ✅ Add this property

}

interface PastTeamMember {
  memberName: string;
  role: string;
  serviceType?: string;
  addedDate: string;
  addedBy: string;
  addedById: number;
  removedDate: string;
  removedBy: string;
  removedById: number;
  durationDays: number;
  status: string;
}

interface Matter {
  matter_id: number;
  client_id: number;
  assigned_lawyer?: number;
  matter_title: string;
  description?: string;
  matter_type?: string;
  practice_area?: string;
  start_date: string;
  estimated_deadline?: string;
  status: string;
  estimated_value?: number;
  billing_rate_type?: string;
  opposing_party_name?: string;
  engagement_letter_url?: string;
  matter_users?: {
    user_id: number;
    role: string;
    hourly_rate?: string;
    user: {
      name: string;
      role?: string;
    };
  }[];
}

interface MatterFormData {
  matter_title?: string;
  client_id?: string;
  assigned_lawyer?: string; //primary lead
  assigned_lawyers?: string[]; // secondary leads - multiple
  practice_area?: string;
  matter_type?: string;
  start_date?: string;
  estimated_deadline?: string;
  description?: string;
  opposing_party_name?: string;
  estimated_value?: string;
  billing_rate_type?: string;
  status?: string;
  engagement_letter_url?: string;
  currency?: string;
  [key: string]: unknown;
}

interface MatterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  mode: 'create' | 'edit';
  matterId?: string;
  initialData?: MatterFormData;
}

type NewTeamMember = {
  user_id: number | null;
  service_type: string | null;
  hourly_rate: string;
};

const initialFormData = {
  matter_title: '',
  client_id: '',
  assigned_lawyer: '',
  assigned_lawyers: [] as string[], // Multiple leads support
  practice_area: 'none',
  matter_type: '',
  start_date: '',
  estimated_deadline: '',
  description: '',
  opposing_party_name: '',
  estimated_value: '',
  billing_rate_type: '',
  status: 'active',
  engagement_letter_url: '',
  matter_creation_requested_by: '',
  currency: 'INR',
};

// These are now fetched dynamically via useConfig hook
// Fallback values for when config hasn't loaded yet
const FALLBACK_PRACTICE_AREAS = ['Corporate M&A', 'Litigation', 'IP', 'Banking & Finance'];
const FALLBACK_MATTER_TYPES = ['Advisory', 'Transactional', 'Litigation', 'Compliance'];
const FALLBACK_BILLING_RATE_TYPES = ['hourly', 'fixed'];
const FALLBACK_STATUS_OPTIONS = ['active', 'closed', 'completed', 'on_hold', 'cancelled'];

export default function MatterMasterDialog({
  open,
  onOpenChange,
  onSuccess,
  mode,
  matterId,
  // initialData, //initialFormData is used instead
}: MatterDialogProps) {

  // Use dynamic configuration from backend
  const {
    practiceAreas: configPracticeAreas,
    matterTypes: configMatterTypes,
    matterStatuses: configMatterStatuses,
    billingTypes: configBillingTypes,
    currencies: configCurrencies,
    loading: configLoading
  } = useConfig();

  // Use config values with fallbacks
  const PRACTICE_AREAS = configPracticeAreas.length > 0
    ? configPracticeAreas.map(pa => pa.name)
    : FALLBACK_PRACTICE_AREAS;
  const MATTER_TYPES = configMatterTypes.length > 0
    ? configMatterTypes.map(mt => mt.name)
    : FALLBACK_MATTER_TYPES;
  const BILLING_RATE_TYPES = configBillingTypes.length > 0
    ? configBillingTypes.map(bt => bt.code)
    : FALLBACK_BILLING_RATE_TYPES;
  const STATUS_OPTIONS = configMatterStatuses.length > 0
    ? configMatterStatuses.map(ms => ms.code)
    : FALLBACK_STATUS_OPTIONS;
  const supportedCurrenciesFromConfig = configCurrencies.length > 0
    ? configCurrencies.map(c => c.code)
    : ['INR', 'USD', 'EUR', 'GBP', 'AED', 'JPY'];

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isLoadingMatter, setIsLoadingMatter] = useState(false);
  const [clientComboboxOpen, setClientComboboxOpen] = useState(false);
  
  const [formData, setFormData] = useState(initialFormData);
  const [assignedLawyerServiceType, setAssignedLawyerServiceType] = useState('');
  const [assignedLawyerServiceTypes, setAssignedLawyerServiceTypes] = useState<string[]>([]);
  const [newMemberServiceTypes, setNewMemberServiceTypes] = useState<string[]>([]);
  const [editMemberServiceTypes, setEditMemberServiceTypes] = useState<Record<number, string[]>>({});
  const [editMemberRateRanges, setEditMemberRateRanges] = useState<Record<number, {min: number, max: number}>>({});
  const [serviceTypes, setServiceTypes] = useState<string[]>([]);
  const [isLoadingServiceTypes, setIsLoadingServiceTypes] = useState(false);
  const [assignedLawyerRate, setAssignedLawyerRate] = useState('');
  // const [assignedLawyerRateRange, setAssignedLawyerRateRange] = useState<{min: number, max: number} | null>(null);
  
  // Multiple leads support
  const [assignedLeads, setAssignedLeads] = useState<Array<{
    userId: string;
    serviceType: string;
    hourlyRate: string;
    serviceTypes: string[];
    rateRange: {min: number, max: number} | null;
  }>>([]);
  const [newMemberRateRange, setNewMemberRateRange] = useState<{min: number, max: number} | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [pastTeamMembers, setPastTeamMembers] = useState<PastTeamMember[]>([]);
  const [isLoadingPastMembers, setIsLoadingPastMembers] = useState(false);
  const [showPastMembers, setShowPastMembers] = useState(false);
  const [showAddTeamMember, setShowAddTeamMember] = useState(false);
 const [newTeamMember, setNewTeamMember] = useState<NewTeamMember>({
  user_id: null,
  service_type: null,
  hourly_rate: '',
});
  // const [assignedLawyerComboboxOpen, setAssignedLawyerComboboxOpen] = useState(false);
  const [addTeamMemberComboboxOpen, setAddTeamMemberComboboxOpen] = useState(false);
  const [assignedLawyerOpen, setAssignedLawyerOpen] = useState(false);
  const [uploadingEngagementLetter, setUploadingEngagementLetter] = useState(false);
  const [engagementLetterFile, setEngagementLetterFile] = useState<File | null>(null);
  const [matterRequestedByUsers, setMatterRequestedByUsers] = useState<User[]>([]);
  const [isLoadingMatterRequestedByUsers, setIsLoadingMatterRequestedByUsers] = useState(false);
  const [matterRequestedByComboboxOpen, setMatterRequestedByComboboxOpen] = useState(false);
  const [showClientDialog, setShowClientDialog] = useState(false);
  const [supportedCurrencies, setSupportedCurrencies] = useState<string[]>(supportedCurrenciesFromConfig);
  const [currencyComboboxOpen, setCurrencyComboboxOpen] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [assignedLawyerServiceSearchQuery, setAssignedLawyerServiceSearchQuery] = useState('');
  const [newMemberServiceSearchQuery, setNewMemberServiceSearchQuery] = useState('');
  const [editMemberServiceSearchQuery, setEditMemberServiceSearchQuery] = useState<Record<number, string>>({});
  const [assignedLawyerServiceOpen, setAssignedLawyerServiceOpen] = useState(false);
  const [newMemberServiceOpen, setNewMemberServiceOpen] = useState(false);
  const [editMemberServiceOpen, setEditMemberServiceOpen] = useState<Record<number, boolean>>({});


  const [showRateCardDialog, setShowRateCardDialog] = useState(false);
  const [rateCardContext, setRateCardContext] = useState<'assigned_lawyer' | 'new_member' | 'edit_member' | null>(null);
  const [editMemberIndex, setEditMemberIndex] = useState<number | null>(null);

  // Converted rate hints
  const [assignedLawyerConvertedRate, setAssignedLawyerConvertedRate] = useState<number | null>(null);
  const [newMemberConvertedRate, setNewMemberConvertedRate] = useState<number | null>(null);
  const [editMemberConvertedRates, setEditMemberConvertedRates] = useState<Record<number, number>>({});
  const [teamMemberConvertedRates, setTeamMemberConvertedRates] = useState<Record<number, number>>({});
  const [allowEmptyRates, setAllowEmptyRates] = useState(false);

  // Fetch full matter details when editing
  useEffect(() => {
    const fetchMatterDetails = async () => {
      if (!open || mode !== 'edit' || !matterId) {
        console.log('⏭️ Skipping fetch:', { open, mode, matterId });
        return;
      }

      try {
        setIsLoadingMatter(true);
        console.log('🔍 Fetching matter with ID:', matterId);
        
        const response = await fetch(API_ENDPOINTS.matters.byId(Number(matterId)), {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch matter details');
        }

        const result = await response.json();
        
        // ✅ ADD THIS: Log the raw response
        console.log('📦 Raw API response:', JSON.stringify(result, null, 2));
        
        if (result.success && result.data) {
          const matter = result.data;
          
          // ✅ ADD THIS: Log matter object
          console.log('📋 Matter data:', matter);
          console.log('👥 Team members from API:', {
            teamMembers: matter.teamMembers,
            team_members: matter.team_members,
            matter_users: matter.matter_users,
            matterUsers: matter.matterUsers,
            users: matter.users,
          });
          
          // Pre-fill form with matter data
          setFormData({
            matter_title: matter.matterTitle || matter.matter_title || '',
            client_id: (matter.client?.id || matter.clientId || matter.client_id)?.toString() || '',
            assigned_lawyers: [],
            assigned_lawyer: (matter.assignedLawyer?.id || matter.assigned_lawyer)?.toString() || '',
            practice_area: matter.practiceArea || matter.practice_area || 'none',
            matter_type: matter.matterType || matter.matter_type || '',
            start_date: matter.startDate ? new Date(matter.startDate).toISOString().split('T')[0] : 
                        matter.start_date ? new Date(matter.start_date).toISOString().split('T')[0] : '',
            estimated_deadline: matter.estimatedDeadline ? new Date(matter.estimatedDeadline).toISOString().split('T')[0] : 
                               matter.estimated_deadline ? new Date(matter.estimated_deadline).toISOString().split('T')[0] : '',
            description: matter.description || '',
            opposing_party_name: matter.opposingPartyName || matter.opposing_party_name || '',
            estimated_value: (matter.estimatedValue || matter.estimated_value)?.toString() || '',
            billing_rate_type: matter.billingRateType || matter.billing_rate_type || '',
            status: matter.status || 'active',
            engagement_letter_url: matter.engagementLetterUrl || matter.engagement_letter_url || '',
            matter_creation_requested_by:
            matter.matterCreationRequestedBy?.id
              ? String(matter.matterCreationRequestedBy.id)
              : matter.matter_creation_requested_by
                ? String(matter.matter_creation_requested_by)
                : '',
            currency: matter.currency || 'INR',
          });

          // ✅ Extract assigned lawyer's service type and rate directly from assignedLawyer object
          // Inside the fetchMatterDetails function, after setting the assigned lawyer service type:
          if (matter.assignedLawyer) {

            const serviceType = matter.assignedLawyer.serviceType || '';
            const hourlyRate = matter.assignedLawyer.hourlyRate
              ? matter.assignedLawyer.hourlyRate.toString()
              : '';

            setAssignedLawyerServiceType(serviceType);
            setAssignedLawyerRate(hourlyRate);

            // ✅ ADD THIS: Fetch service types for the assigned lawyer
            try {
              const lawyerId = matter.assignedLawyer.id || matter.assigned_lawyer;
              const response = await fetch(
                API_ENDPOINTS.rateCards.userServiceTypes(Number(lawyerId)),
                {
                  credentials: 'include',
                  headers: { 'Content-Type': 'application/json' },
                }
              );

              if (response.ok) {
                const result = await response.json();
                if (result.success && result.data) {
                  console.log('✅ Loaded service types for assigned lawyer:', result.data);
                  setAssignedLawyerServiceTypes(result.data);
                }
              }
            } catch (error) {
              console.error('Error fetching assigned lawyer service types:', error);
            }
          }




          // Try multiple possible locations for team members data
          let teamData = null;
          
          // Check all possible property names and structures
          if (matter.teamMembers && Array.isArray(matter.teamMembers) && matter.teamMembers.length > 0) {
            teamData = matter.teamMembers;
          } else if (matter.team_members && Array.isArray(matter.team_members) && matter.team_members.length > 0) {
            teamData = matter.team_members;
          } else if (matter.matter_users && Array.isArray(matter.matter_users) && matter.matter_users.length > 0) {
            teamData = matter.matter_users;
          } else if (matter.matterUsers && Array.isArray(matter.matterUsers) && matter.matterUsers.length > 0) {
            teamData = matter.matterUsers;
          } else if (matter.users && Array.isArray(matter.users) && matter.users.length > 0) {
            teamData = matter.users;
          }

          if (teamData && teamData.length > 0) {
            console.log('👥 Processing team data:', teamData);

            // ✅ Filter out assigned lawyer from team members
            const assignedLawyerId = matter.assignedLawyer?.id || matter.assigned_lawyer;
            
            const regularTeamMembers = teamData.filter((mu: {
              role?: string;
              matterRole?: string;
              userId?: number;
              user_id?: number;
              user?: {
                user_id?: number;
                id?: number;
                [key: string]: unknown;
              };
              [key: string]: unknown;
            }) => {
              const role = mu.role || mu.matterRole;
              const userId = mu.userId || mu.user_id || mu.user?.user_id || mu.user?.id;
              
              // Filter out both by role AND by matching user_id with assigned lawyer
              return role !== 'assigned_lawyer' && userId !== assignedLawyerId;
            });

            console.log('👥 Regular team members (excluding assigned lawyer):', regularTeamMembers);;

            const members = regularTeamMembers.map((mu: {
              userId?: number;
              user_id?: number;
              name?: string;
              user?: {
                user_id?: number;
                id?: number;
                name?: string;
                role?: {
                  name?: string;
                } | string;
                [key: string]: unknown;
              };
              hourlyRate?: number | string;
              hourly_rate?: number | string;
              serviceType?: string;
              service_type?: string;
              [key: string]: unknown;
            }, index: number) => {
              const userId = mu.userId || mu.user_id || mu.user?.user_id || mu.user?.id;
              const userName = mu.name || mu.user?.name || 'Unknown User';
              const userRoleFromBackend =
                mu.userRole ||
                (typeof mu.user?.role === 'object' && mu.user?.role && 'name' in mu.user.role ? mu.user.role.name : null) ||
                (typeof mu.user?.role === 'string' ? mu.user.role : null) ||
                'Lawyer';
              const finalRole = String(userRoleFromBackend || 'Lawyer');

              let hourlyRate = '';
              const rawHourlyRate = mu.hourlyRate ?? mu.hourly_rate ?? null;
              if (rawHourlyRate !== null && rawHourlyRate !== undefined) {
                hourlyRate =
                  typeof rawHourlyRate === 'number'
                    ? rawHourlyRate.toString()
                    : rawHourlyRate.toString();
              }

              const serviceType = mu.serviceType || mu.service_type || '';

              return {
                id: userId,
                user_id: userId,
                original_user_id: userId,
                original_service_type: serviceType,
                role: finalRole,
                service_type: serviceType,
                hourly_rate: hourlyRate,
                userName: userName,
                userRole: finalRole,
                isEditing: false,
                isExisting: true,
              };
            }).filter((m: {
              user_id?: number;
              [key: string]: unknown;
            }) => m.user_id);

            setTeamMembers(members);
          } else {
            console.log('👥 No team members found');
            setTeamMembers([]);
          }

        }
      } catch (error) {
        console.error('Error fetching matter details:', error);
        // alert('Failed to load matter details. Please try again.');
        toast.error('Failed to load matter details. Please try again.');
      } finally {
        setIsLoadingMatter(false);
      }
    };

    fetchMatterDetails();
  }, [open, mode, matterId]);

  // Fetch past team members when in edit mode
  useEffect(() => {
    const fetchPastTeamMembers = async () => {
      if (!open || mode !== 'edit' || !matterId) {
        return;
      }

      try {
        setIsLoadingPastMembers(true);
        console.log('🔍 Fetching past team members for matter:', matterId);
        
        const response = await fetch(API_ENDPOINTS.matters.team.history(Number(matterId)), {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch past team members');
        }

        const result = await response.json();
        
        if (result.success && result.data) {
          console.log('✅ Past team members loaded:', result.data);
          setPastTeamMembers(result.data);
        } else {
          setPastTeamMembers([]);
        }
      } catch (error) {
        console.error('Error fetching past team members:', error);
        // Don't show alert for this - it's not critical
        setPastTeamMembers([]);
      } finally {
        setIsLoadingPastMembers(false);
      }
    };

    fetchPastTeamMembers();
  }, [open, mode, matterId]);

  // Reset form when dialog closes or switches to create mode
  useEffect(() => {
    if (!open || mode === 'create') {
      setFormData(initialFormData);
      setTeamMembers([]);
      setPastTeamMembers([]);
      setShowPastMembers(false);
      setShowAddTeamMember(false);
      setNewTeamMember({ user_id: null, hourly_rate: '', service_type: '' });
      setAssignedLawyerServiceType(''); // ✅ ADD THIS
      setAssignedLawyerRate(''); // ✅ ADD THIS
      setEngagementLetterFile(null);
      setUploadingEngagementLetter(false);
    }
  }, [open, mode]);

  // Fetch clients and users when dialog opens
  useEffect(() => {
    const fetchData = async () => {
      if (!open) return;

      // Fetch clients
      try {
        setIsLoadingClients(true);
        const response = await fetch(API_ENDPOINTS.clients.list, {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch clients');
        }

        const data = await response.json();

        if (data.success) {
          setClients(data.data);
          console.log('✅ Total clients loaded:', data.data.length); // ADD THIS LINE

        }
      } catch (error) {
        console.error('Error fetching clients:', error);
      } finally {
        setIsLoadingClients(false);
      }

    
      // Fetch users
      try {
        setIsLoadingUsers(true);
        const response = await fetch(API_ENDPOINTS.users.list, {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch users');
        }

        const data = await response.json();

        if (data.success) {
          const transformedUsers = data.data.map((user: {
            id: number;
            name: string;
            [key: string]: unknown;
          }) => ({
            user_id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            role_id: user.roleId,
            phone: user.phone,
            practice_area: user.practiceArea,
          }));
          
          setUsers(transformedUsers);
        }
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setIsLoadingUsers(false);
      }
    };

    fetchData();
  }, [open]);

  // Fetch rate range when service type is selected for new team member
  // useEffect(() => {
  //   const fetchRateForNewMember = async () => {
  //     if (!newTeamMember.user_id || !newTeamMember.service_type) {
  //       setNewMemberRateRange(null);
  //       return;
  //     }

  //     // Only fetch if billing type is hourly
  //     if (formData.billing_rate_type !== 'hourly') {
  //       setNewTeamMember(prev => ({ ...prev, hourly_rate: '' }));
  //       setNewMemberRateRange(null);
  //       return;
  //     }

  //     try {
  //       const url = API_ENDPOINTS.rateCards.activeByService(
  //         newTeamMember.user_id,
  //         newTeamMember.service_type
  //       );
  //       console.log('🔍 Fetching rate range for new member:', {
  //         user_id: newTeamMember.user_id,
  //         service_type: newTeamMember.service_type,
  //         url
  //       });

  //       const response = await fetch(url, {
  //         credentials: 'include',
  //         headers: { 'Content-Type': 'application/json' },
  //       });

  //       const result = await response.json();

  //       if (response.ok && result.success && result.data) {
  //         // ✅ CHECK IF RATES ARE NULL
  //         if (result.data.min_hourly_rate === null || result.data.max_hourly_rate === null) {
  //           console.log('⚠️ No rates assigned for this service type, please set rates');
  //           setNewMemberRateRange(null);
  //           setNewTeamMember(prev => ({ ...prev, hourly_rate: '' }));
  //         } else {
  //           const rateRange = {
  //             min: result.data.min_hourly_rate,
  //             max: result.data.max_hourly_rate
  //           };
  //           console.log('✅ Rate range found:', rateRange);
  //           setNewMemberRateRange(rateRange);
  //         }
  //       } else {
  //         console.log('⚠️ No rate card found');
  //         setNewMemberRateRange(null);
  //         setNewTeamMember(prev => ({ ...prev, hourly_rate: '' }));
  //       }
  //     } catch (error) {
  //       console.error('❌ Error fetching rate range:', error);
  //       setNewMemberRateRange(null);
  //     }
  //   };

  //   fetchRateForNewMember();
  // }, [newTeamMember.user_id, newTeamMember.service_type, formData.billing_rate_type]);

  // Convert new team member rate from INR to matter currency
  useEffect(() => {
    const convertNewMemberRate = async () => {
      if (!newTeamMember.hourly_rate || !formData.currency || formData.currency === 'INR') {
        setNewMemberConvertedRate(null);
        return;
      }

      try {
        const rateInINR = parseFloat(newTeamMember.hourly_rate);
        if (isNaN(rateInINR) || rateInINR <= 0) {
          setNewMemberConvertedRate(null);
          return;
        }

        const converted = await convertCurrency(rateInINR, 'INR', formData.currency as CurrencyCode);
        setNewMemberConvertedRate(converted);
      } catch (error) {
        console.error('Error converting new member rate:', error);
        setNewMemberConvertedRate(null);
      }
    };

    convertNewMemberRate();
  }, [newTeamMember.hourly_rate, formData.currency]);

  // Fetch rate range for assigned lawyer when service type is selected
  // useEffect(() => {
  //   const fetchRateForAssignedLawyer = async () => {
  //     if (!formData.assigned_lawyer || !assignedLawyerServiceType) {
  //       setAssignedLawyerRate('');
  //       setAssignedLawyerRateRange(null);
  //       return;
  //     }

  //     // Only fetch if billing type is hourly
  //     if (formData.billing_rate_type !== 'hourly') {
  //       setAssignedLawyerRate('');
  //       setAssignedLawyerRateRange(null);
  //       return;
  //     }

  //     try {
  //       console.log('🔍 Fetching rate range for assigned lawyer:', {
  //         lawyer_id: formData.assigned_lawyer,
  //         service_type: assignedLawyerServiceType
  //       });

  //       const response = await fetch(
  //         API_ENDPOINTS.rateCards.activeByService(
  //           Number(formData.assigned_lawyer),
  //           assignedLawyerServiceType
  //         ),
  //         {
  //           credentials: 'include',
  //           headers: { 'Content-Type': 'application/json' },
  //         }
  //       );

  //       if (response.ok) {
  //         const result = await response.json();
  //         if (result.success && result.data) {
  //           const rateRange = {
  //             min: result.data.min_hourly_rate,
  //             max: result.data.max_hourly_rate
  //           };
  //           console.log('✅ Assigned lawyer rate range found:', rateRange);
  //           setAssignedLawyerRateRange(rateRange);
  //         }
  //       } else {
  //         console.log('⚠️ No rate card found for assigned lawyer');
  //         setAssignedLawyerRate('');
  //         setAssignedLawyerRateRange(null);
  //       }
  //     } catch (error) {
  //       console.error('❌ Error fetching assigned lawyer rate range:', error);
  //       setAssignedLawyerRate('');
  //       setAssignedLawyerRateRange(null);
  //     }
  //   };

  //   fetchRateForAssignedLawyer();
  // }, [formData.assigned_lawyer, assignedLawyerServiceType, formData.billing_rate_type]);

  // Convert assigned lawyer rate from INR to matter currency
  useEffect(() => {
    const convertAssignedLawyerRate = async () => {
      if (!assignedLawyerRate || !formData.currency || formData.currency === 'INR') {
        setAssignedLawyerConvertedRate(null);
        return;
      }

      try {
        const rateInINR = parseFloat(assignedLawyerRate);
        if (isNaN(rateInINR) || rateInINR <= 0) {
          setAssignedLawyerConvertedRate(null);
          return;
        }

        const converted = await convertCurrency(rateInINR, 'INR', formData.currency as CurrencyCode);
        setAssignedLawyerConvertedRate(converted);
      } catch (error) {
        console.error('Error converting assigned lawyer rate:', error);
        setAssignedLawyerConvertedRate(null);
      }
    };

    convertAssignedLawyerRate();
  }, [assignedLawyerRate, formData.currency]);

  // Fetch rate range when service type changes in edit mode
  useEffect(() => {
    const fetchRatesForEditingMembers = async () => {
      if (formData.billing_rate_type !== 'hourly') {
        return;
      }

      for (let i = 0; i < teamMembers.length; i++) {
        const member = teamMembers[i];
        if (member.isEditing && member.user_id && member.service_type) {
          try {
            const response = await fetch(
              API_ENDPOINTS.rateCards.activeByService(member.user_id, member.service_type),
              {
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
              }
            );

            if (response.ok) {
              const result = await response.json();
              // Just fetch the range, don't set the rate
              // The rate range will be available for placeholder display
            }
          } catch (error) {
            console.error('Error fetching rate range for editing member:', error);
          }
        }
      }
    };

    fetchRatesForEditingMembers();
  }, [teamMembers.map(m => `${m.user_id}-${m.service_type}-${m.isEditing}`).join(','), formData.billing_rate_type]);

  // Fetch service types when assigned lawyer changes
  useEffect(() => {
    const fetchAssignedLawyerServiceTypes = async () => {
      if (!formData.assigned_lawyer) {
        setAssignedLawyerServiceTypes([]);
        // Only reset service type and rate in create mode or when lawyer is cleared
        if (mode === 'create') {
          setAssignedLawyerServiceType('');
          setAssignedLawyerRate('');
        }
        return;
      }

      // ✅ Skip if we already have service types loaded (from fetchMatterDetails)
      if (mode === 'edit' && assignedLawyerServiceTypes.length > 0) {
        console.log('⏭️ Skipping fetch - service types already loaded in edit mode');
        return;
      }

      try {
        console.log('🔍 Fetching service types for lawyer:', formData.assigned_lawyer);
        
        const response = await fetch(
          API_ENDPOINTS.rateCards.userServiceTypes(Number(formData.assigned_lawyer)),
          {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
          }
        );

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            console.log('✅ Service types for lawyer:', result.data);
            setAssignedLawyerServiceTypes(result.data);
          } else {
            console.log('⚠️ No service types found for lawyer');
            setAssignedLawyerServiceTypes([]);
          }
        } else {
          console.log('⚠️ Failed to fetch service types');
          setAssignedLawyerServiceTypes([]);
        }
      } catch (error) {
        console.error('Error fetching lawyer service types:', error);
        setAssignedLawyerServiceTypes([]);
      }
    };

    fetchAssignedLawyerServiceTypes();
  }, [formData.assigned_lawyer, mode]); // Add mode and keep other dependencies

  // Fetch service types when new team member user changes
  useEffect(() => {
    const fetchNewMemberServiceTypes = async () => {
      if (newTeamMember.user_id === null) {
        setNewMemberServiceTypes([]);
        setNewTeamMember(prev => ({ ...prev, service_type: '', hourly_rate: '' }));
        return;
      }

      try {
        console.log('🔍 Fetching service types for new member:', newTeamMember.user_id);
        
        const response = await fetch(
          API_ENDPOINTS.rateCards.userServiceTypes(newTeamMember.user_id),
          {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
          }
        );

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            console.log('✅ Service types for new member:', result.data);
            setNewMemberServiceTypes(
              result.data
                .filter((v: unknown) => typeof v === 'string' && v.trim() !== '')
            );
          }
        } else {
          console.log('⚠️ No service types found for new member');
          setNewMemberServiceTypes([]);
        }
      } catch (error) {
        console.error('Error fetching new member service types:', error);
        setNewMemberServiceTypes([]);
      }
    };

    fetchNewMemberServiceTypes();
  }, [newTeamMember.user_id]);

  /**
   * Fetch rate range when editing team member's service type
  */
  // useEffect(() => {
  //   const fetchEditMemberRateRanges = async () => {
  //     // Only process members that are in edit mode
  //     const editingMembers = teamMembers
  //       .map((member, index) => ({ member, index }))
  //       .filter(({ member }) => member.isEditing && member.user_id && member.service_type);

  //     for (const { member, index } of editingMembers) {
  //       // Skip if we already have the rate range for this member's current service type
  //       if (editMemberRateRanges[index]) {
  //         continue;
  //       }

  //       // Only fetch if billing type is hourly
  //       if (formData.billing_rate_type !== 'hourly') {
  //         continue;
  //       }

  //       try {
  //         console.log('🔍 Fetching rate range for editing member:', {
  //           user_id: member.user_id,
  //           service_type: member.service_type,
  //           index,
  //         });

  //         const response = await fetch(
  //           API_ENDPOINTS.rateCards.activeByService(
  //             Number(member.user_id),
  //             member.service_type as string
  //           ),
  //           {
  //             credentials: 'include',
  //             headers: { 'Content-Type': 'application/json' },
  //           }
  //         );

  //         if (response.ok) {
  //           const result = await response.json();
  //           if (result.success && result.data) {
  //             const fetchedRateRange = {
  //               min: result.data.min_hourly_rate,
  //               max: result.data.max_hourly_rate,
  //             };
  //             console.log('✅ Edit member rate range found:', fetchedRateRange);

  //             setEditMemberRateRanges((prev) => ({
  //               ...prev,
  //               [index]: fetchedRateRange,
  //             }));

  //             // If hourly rate is empty or 0, suggest midpoint
  //             if (!member.hourly_rate || parseFloat(member.hourly_rate) === 0) {
  //               const suggestedRate = (
  //                 (fetchedRateRange.min + fetchedRateRange.max) / 2
  //               ).toString();
  //               updateTeamMember(index, 'hourly_rate', suggestedRate);
  //             }
  //           } else {
  //             console.log('⚠️ No rate range found for edit member');
  //           }
  //         }
  //       } catch (error) {
  //         console.error('Error fetching edit member rate range:', error);
  //       }
  //     }
  //   };

  //   fetchEditMemberRateRanges();
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [
  //   JSON.stringify(teamMembers.map(m => ({
  //     id: m.user_id,
  //     service: m.service_type,
  //     editing: m.isEditing
  //   }))),
  //   formData.billing_rate_type
  // ]);

  // Convert editing team member rates from INR to matter currency
  useEffect(() => {
    const convertEditMemberRates = async () => {
      if (!formData.currency || formData.currency === 'INR') {
        setEditMemberConvertedRates({});
        return;
      }

      const newConvertedRates: Record<number, number> = {};

      for (let i = 0; i < teamMembers.length; i++) {
        const member = teamMembers[i];
        if (member.isEditing && member.hourly_rate) {
          try {
            const rateInINR = parseFloat(member.hourly_rate);
            if (!isNaN(rateInINR) && rateInINR > 0) {
              const converted = await convertCurrency(rateInINR, 'INR', formData.currency as CurrencyCode);
              newConvertedRates[i] = converted;
            }
          } catch (error) {
            console.error(`Error converting rate for member ${i}:`, error);
          }
        }
      }

      setEditMemberConvertedRates(newConvertedRates);
    };

    convertEditMemberRates();
  }, [
    JSON.stringify(teamMembers.map((m, i) => ({ index: i, rate: m.hourly_rate, editing: m.isEditing }))),
    formData.currency
  ]);

  // Convert all team member rates (for display in the table) from INR to matter currency
  useEffect(() => {
    const convertAllTeamMemberRates = async () => {
      if (!formData.currency || formData.currency === 'INR') {
        setTeamMemberConvertedRates({});
        return;
      }

      const newConvertedRates: Record<number, number> = {};

      for (let i = 0; i < teamMembers.length; i++) {
        const member = teamMembers[i];
        if (member.hourly_rate) {
          try {
            const rateInINR = parseFloat(member.hourly_rate);
            if (!isNaN(rateInINR) && rateInINR > 0) {
              const converted = await convertCurrency(rateInINR, 'INR', formData.currency as CurrencyCode);
              newConvertedRates[i] = converted;
            }
          } catch (error) {
            console.error(`Error converting rate for team member ${i}:`, error);
          }
        }
      }

      setTeamMemberConvertedRates(newConvertedRates);
    };

    convertAllTeamMemberRates();
  }, [
    JSON.stringify(teamMembers.map((m, i) => ({ index: i, rate: m.hourly_rate }))),
    formData.currency
  ]);

  // Fetch service types when editing team member user changes
  const fetchEditMemberServiceTypes = async (userId: number, index: number) => {
    if (!userId) {
      setEditMemberServiceTypes(prev => ({ ...prev, [index]: [] }));
      return;
    }

    try {
      console.log('🔍 Fetching service types for edit member:', userId);
      
      const response = await fetch(
        API_ENDPOINTS.rateCards.userServiceTypes(userId),
        {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          console.log('✅ Service types for edit member:', result.data);
          setEditMemberServiceTypes(prev => ({ ...prev, [index]: result.data }));
        }
      } else {
        console.log('⚠️ No service types found for edit member');
        setEditMemberServiceTypes(prev => ({ ...prev, [index]: [] }));
      }
    } catch (error) {
      console.error('Error fetching edit member service types:', error);
      setEditMemberServiceTypes(prev => ({ ...prev, [index]: [] }));
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleEngagementLetterSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (e.g., max 10MB for PDFs)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      // alert('File size must be less than 10MB');
      toast.error('File size must be less than 10MB');
      return;
    }

    // Validate file type (only PDFs)
    const allowedTypes = ['application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      // alert('Only PDF files are allowed for engagement letters');
      toast.error('Only PDF files are allowed for engagement letters');
      return;
    }

    setEngagementLetterFile(file);
  };

  const uploadEngagementLetterToS3 = async (file: File, matterId: number): Promise<string> => {
    try {
      // Step 1: Get pre-signed URL from backend
      const presignedResponse = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/uploads/engagement-letter/presigned-url`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type,
            matterId: matterId,
          }),
        }
      );

      if (!presignedResponse.ok) {
        throw new Error('Failed to get upload URL');
      }

      const { data } = await presignedResponse.json();
      const { uploadUrl, publicUrl } = data;

      // Step 2: Upload file directly to S3
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file to S3');
      }

      return publicUrl;
    } catch (error) {
      console.error('Error uploading engagement letter:', error);
      throw error;
    }
  };

  const removeTeamMember = async (index: number) => {
    const member = teamMembers[index];
    
    // If in edit mode and member exists in database, call API to delete
    if (mode === 'edit' && member.isExisting && matterId) {
      const confirmed = window.confirm(
        `Are you sure you want to remove ${member.userName} (${member.service_type}) from this matter?`
      );
      
      if (!confirmed) return;
      
      if (!member.service_type) {
        // alert('Service type is required to remove team member');
        toast.error('Service type is required to remove team member');
        return;
      }
      
      try {
        const response = await fetch(
          API_ENDPOINTS.matters.team.remove(Number(matterId), member.user_id, member.service_type),
          {
            method: 'DELETE',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || 'Failed to remove team member');
        }

        const result = await response.json();
        
        if (!result.success) {
          throw new Error(result.message || 'Failed to remove team member');
        }

        // Remove from local state after successful API call
        setTeamMembers(teamMembers.filter((_, i) => i !== index));
        // alert('Team member removed successfully!');
       toast.success('Team member removed successfully!');
      } catch (error) {
        console.error('Error removing team member:', error);
        // alert(error instanceof Error ? error.message : 'Failed to remove team member. Please try again.');
        toast.error(error instanceof Error ? error.message : 'Failed to remove team member. Please try again.');
      }
    } else {
      // For create mode or new members, just remove from local state
      setTeamMembers(teamMembers.filter((_, i) => i !== index));
    }
  };

  const toggleEditTeamMember = (index: number, enterEdit = true) => {
    setTeamMembers(prev =>
      prev.map((m, i) => (i === index ? { ...m, isEditing: enterEdit } : m))
    );
    
    // Fetch service types when entering edit mode
    if (enterEdit) {
      const member = teamMembers[index];
      if (member.user_id) {
        fetchEditMemberServiceTypes(member.user_id, index);
      }
    }
  };

  const cancelEditTeamMember = (index: number) => {
    setTeamMembers(prev => prev.map((m, i) => (i === index ? { ...m, isEditing: false } : m)));
    
    // ✅ Reset search query and close dropdown for this member
    setEditMemberServiceSearchQuery(prev => {
      const newQueries = { ...prev };
      delete newQueries[index];
      return newQueries;
    });
    
    setEditMemberServiceOpen(prev => {
      const newOpen = { ...prev };
      delete newOpen[index];
      return newOpen;
    });
  };

  const handleAddTeamMember = () => {
    if (newTeamMember.user_id === null) {
      // alert('Please select a lawyer');
      toast.error('Please select a lawyer');
      return;
    }

   if (formData.billing_rate_type === 'hourly' && !newTeamMember.hourly_rate) {
  toast.error('Please enter hourly rate');
  return;
}

    // Only validate hourly rate if billing type is hourly
    // if (formData.billing_rate_type === 'hourly') {
    //   if (!newTeamMember.hourly_rate) {
    //     // alert('Please enter an hourly rate');
    //     toast.error('Please enter an hourly rate');
    //     return;
    //   }

    //   // Validate rate is within range if range exists
    //   if (newMemberRateRange) {
    //     const enteredRate = parseFloat(newTeamMember.hourly_rate);
    //     if (enteredRate < newMemberRateRange.min || enteredRate > newMemberRateRange.max) {
    //       // alert(`Hourly rate must be between ₹${newMemberRateRange.min} and ₹${newMemberRateRange.max}`);
    //       toast.error(`Hourly rate must be between ₹${newMemberRateRange.min} and ₹${newMemberRateRange.max}`);
    //       return;
    //     }
    //   }
    // }

    const selectedUser = users.find((u) => u.user_id === newTeamMember.user_id);
    if (!selectedUser) return;

    // Check if this user+service_type combination already exists
    if (teamMembers.some((tm) => tm.user_id === newTeamMember.user_id && tm.service_type === newTeamMember.service_type)) {
      // alert('This lawyer is already added with this service type');
      toast.error('This lawyer is already added with this service type');
      return;
    }

    setTeamMembers([
      ...teamMembers,
      {
        user_id: newTeamMember.user_id,
        role: selectedUser.role || 'Lawyer',
        service_type: null,
hourly_rate: formData.billing_rate_type === 'hourly'
  ? newTeamMember.hourly_rate
  : '',
        userName: selectedUser.name,
        userRole: selectedUser.role || 'Lawyer',
        isExisting: false,
      },
    ]);

    setNewTeamMember({ user_id: null, service_type: '', hourly_rate: '' });
    setShowAddTeamMember(false);
  };

  const updateTeamMember = (index: number, field: keyof TeamMember, value: string | number) => {
    const updated = [...teamMembers];
    const currentMember = updated[index];
    
    if (field === 'user_id') {
      const selectedUser = users.find((u) => u.user_id === Number(value));
      updated[index] = {
        ...currentMember,
        user_id: Number(value),
        userName: selectedUser?.name || '',
        userRole: selectedUser?.role || currentMember.userRole || '',
        service_type: '',
        hourly_rate: '',
        isExisting: currentMember.isExisting,
      };
      
      // Clear service types and rate range for this index
      setEditMemberServiceTypes((prev) => {
        const newTypes = { ...prev };
        delete newTypes[index];
        return newTypes;
      });
      
      // setEditMemberRateRanges((prev) => {
      //   const newRanges = { ...prev };
      //   delete newRanges[index];
      //   return newRanges;
      // });
      
      fetchEditMemberServiceTypes(Number(value), index);
    } else if (field === 'service_type') {
      // ✅ When service type changes, clear hourly rate and rate range
      updated[index] = { 
        ...currentMember, 
        service_type: value as string,
        hourly_rate: '', // Clear rate when service type changes
        isExisting: currentMember.isExisting,
      } as TeamMember;
      
      // Clear the rate range for this index to trigger refetch
      // setEditMemberRateRanges((prev) => {
      //   const newRanges = { ...prev };
      //   delete newRanges[index];
      //   return newRanges;
      // });
    } else {
      updated[index] = { 
        ...currentMember, 
        [field]: value,
        isExisting: currentMember.isExisting,
      } as TeamMember;
    }
    
    setTeamMembers(updated);
  };

  const handleDelete = async () => {
    if (!matterId) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete "${formData.matter_title}"?\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const response = await fetch(API_ENDPOINTS.matters.delete(Number(matterId)), {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete matter');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to delete matter');
      }

      // alert('Matter deleted successfully!');
      toast.success('Matter deleted successfully!');
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Error deleting matter:', error);
      // alert(error instanceof Error ? error.message : 'Failed to delete matter. Please try again.');
      toast.error(error instanceof Error ? error.message : 'Failed to delete matter. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };


  /**
   * Opens the rate card dialog for creating a new rate card
   * @param context - Which part of the form triggered this (assigned_lawyer, new_member, or edit_member)
   * @param memberIndex - If editing a team member, the index of that member
   * @param allowEmpty - Whether to allow creating an empty rate card (disables rate fields)
   */
  const handleOpenRateCardDialog = (
    context: 'assigned_lawyer' | 'new_member' | 'edit_member',
    memberIndex?: number,
    allowEmpty = false  // ✅ This controls whether rates are disabled
  ) => {
    setRateCardContext(context);
    if (context === 'edit_member' && memberIndex !== undefined) {
      setEditMemberIndex(memberIndex);
    }
    // ✅ Store the allowEmpty flag in state
    setAllowEmptyRates(allowEmpty);
    setShowRateCardDialog(true);
  };

/**
 * Refreshes service types for a specific user after rate card creation
 * @param userId - The user ID to refresh service types for
 * @param context - Which part of the form to update
 */
const refreshServiceTypes = async (userId: number, context: 'assigned_lawyer' | 'new_member' | 'edit_member') => {
  try {
    console.log('🔄 Refreshing service types for user:', userId, 'context:', context);
    
    const response = await fetch(
      API_ENDPOINTS.rateCards.userServiceTypes(userId),
      {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    if (response.ok) {
      const result = await response.json();
      if (result.success && result.data) {
        console.log('✅ Refreshed service types:', result.data);
        
        // Update the appropriate service types array based on context
        if (context === 'assigned_lawyer') {
          setAssignedLawyerServiceTypes(result.data);
        } else if (context === 'new_member') {
          setNewMemberServiceTypes(
            result.data
              .filter((v: unknown) => typeof v === 'string' && v.trim() !== '')
          );
        } else if (context === 'edit_member' && editMemberIndex !== null) {
          setEditMemberServiceTypes(prev => ({ ...prev, [editMemberIndex]: result.data }));
        }
        
        return result.data;
      }
    }
  } catch (error) {
    console.error('Error refreshing service types:', error);
  }
  
  return [];
};

  
  //  Callback when rate card is successfully created
  
  const handleRateCardSuccess = async () => {
    console.log('✅ Rate card created successfully');
    
    // Determine which user to refresh service types for
    let userId: number | null = null;
    
    if (rateCardContext === 'assigned_lawyer' && formData.assigned_lawyer) {
      userId = Number(formData.assigned_lawyer);
    } else if (rateCardContext === 'new_member' && newTeamMember.user_id) {
      userId = newTeamMember.user_id;
    } else if (rateCardContext === 'edit_member' && editMemberIndex !== null) {
      userId = teamMembers[editMemberIndex]?.user_id;
    }
    
    if (userId && rateCardContext) {
      await refreshServiceTypes(userId, rateCardContext);
    }
    
    // Reset context
    setRateCardContext(null);
    setEditMemberIndex(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields with specific error messages
    if (!formData.client_id) {
        toast.error("Please select a client");
        return;
    }
    
    if (!formData.matter_title || !formData.matter_title.trim()) {
        toast.error("Please enter a matter title");
        return;
    }
    
    if (!formData.start_date) {
        toast.error("Please select a start date");
        return;
    }

    // Validate assigned lawyer rate if billing type is hourly
    if (formData.billing_rate_type === 'hourly' && formData.assigned_lawyer) {
      if (!assignedLawyerRate) {
        // alert('Please enter an hourly rate for the assigned lawyer');
        toast.error('Please enter an hourly rate for the assigned lawyer');
        return;
      }


    setIsSubmitting(true);
    try {
        let engagementLetterUrl = formData.engagement_letter_url;

        const url =
        mode === "create"
            ? API_ENDPOINTS.matters.create
            : API_ENDPOINTS.matters.update(Number(matterId));
        const method = mode === "create" ? "POST" : "PUT";

        const assignedLawyerHourlyInput = assignedLawyerRate
          ? Number(assignedLawyerRate)
          : null;

        const assignedLawyerConversionRate =
          formData.currency === 'INR'
            ? 1
            : assignedLawyerConvertedRate && assignedLawyerHourlyInput
              ? assignedLawyerConvertedRate / assignedLawyerHourlyInput
              : 1;

        const matterPayload = {
          matter_title: formData.matter_title.trim(),
          client_id: Number(formData.client_id),
          start_date: new Date(formData.start_date).toISOString(),
          
          // ✅ Only include assigned_lawyer data in create mode
          ...(mode === 'create' && {
            assigned_lawyers: formData.assigned_lawyer
            ? [
                {
                  user_id: Number(formData.assigned_lawyer),
                  hourly_rate_input: assignedLawyerHourlyInput,
                  conversion_rate: assignedLawyerConversionRate,
                },
              ]
            : [],
            // assigned_lawyer_service_type: assignedLawyerServiceType || null,
            // assigned_lawyer_hourly_rate_input: assignedLawyerHourlyInput,
            // assigned_lawyer_currency: formData.currency,
            // assigned_lawyer_conversion_rate: assignedLawyerConversionRate,
          }),

          practice_area: !formData.practice_area || formData.practice_area === 'none' ? null : formData.practice_area,
          matter_type: formData.matter_type || formData.matter_type === 'none' ? null : formData.matter_type,
          estimated_deadline: formData.estimated_deadline
              ? new Date(formData.estimated_deadline).toISOString()
              : null,
          description: formData.description?.trim() || null,
          opposing_party_name: formData.opposing_party_name?.trim() || null,
          estimated_value: formData.estimated_value
              ? parseFloat(formData.estimated_value)
              : null,
          billing_rate_type: formData.billing_rate_type || null,
          status: formData.status || "active",
          engagement_letter_url: engagementLetterUrl || null,
          matter_creation_requested_by: formData.matter_creation_requested_by ? parseInt(formData.matter_creation_requested_by) : null,
          currency: formData.currency || 'INR',
          ...(mode === 'create' && {
              team_members: teamMembers.map((tm, index) => ({
                user_id: tm.user_id,
                role: tm.role,
                service_type: null,
                hourly_rate_input: Number(tm.hourly_rate),
                input_currency: formData.currency,
                conversion_rate:
                  formData.currency === 'INR'
                    ? 1
                    : teamMemberConvertedRates[index] && Number(tm.hourly_rate)
                      ? teamMemberConvertedRates[index] / Number(tm.hourly_rate)
                      : 1,
                              })),
                          }),
                        };



        const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(matterPayload),
        });

        const data = await response.json();

        if (!response.ok) {
        throw new Error(data.message || `Failed to ${mode} matter`);
        }


        const currentMatterId = mode === 'create' ? data.data.id : Number(matterId);

        // Upload engagement letter if a new file was selected
        if (engagementLetterFile && currentMatterId) {
          try {
            setUploadingEngagementLetter(true);
            engagementLetterUrl = await uploadEngagementLetterToS3(engagementLetterFile, currentMatterId);
            
            // Update the matter with the engagement letter URL
            const updateResponse = await fetch(API_ENDPOINTS.matters.update(currentMatterId), {
              method: 'PUT',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                engagement_letter_url: engagementLetterUrl,
              }),
            });

            if (!updateResponse.ok) {
              console.error('Failed to update matter with engagement letter URL');
            }
            
            setUploadingEngagementLetter(false);
          } catch (error) {
            console.error('Error uploading engagement letter:', error);
            setUploadingEngagementLetter(false);
            // Don't fail the entire operation if engagement letter upload fails
            // alert('Matter saved, but engagement letter upload failed. Please try uploading again.');
            toast.error('Matter saved, but engagement letter upload failed. Please try uploading again.');
          }
        }

        // Handle team member updates ONLY for edit mode
        if (mode === 'edit') {
        console.log('🔄 Handling team member updates for edit mode');
        
        // Get existing team member user IDs from the loaded matter data
        const existingUserIds = teamMembers
            .filter((tm) => tm.isExisting)
            .map((tm) => tm.user_id);
        
        const formUserIds = teamMembers
            .filter((tm) => tm.user_id > 0)
            .map((tm) => tm.user_id);


        
        // ✅ REMOVED: No longer handling assigned lawyer in edit mode
        // Assigned lawyer should be managed via "Reassign Lead" button only

        // Update/Add team members
        console.log('📤 Processing team members:', teamMembers);
        for (const member of teamMembers) {
            if (!member.user_id || !member.role.trim()) {
            console.warn('⚠️ Skipping invalid member:', member);
            continue;
            }

            const memberPayload = {
              user_id: member.user_id,
              role: member.role,
              service_type: member.service_type || null,
              hourly_rate: formData.billing_rate_type === 'hourly' && member.hourly_rate 
                ? parseFloat(member.hourly_rate) 
                : null,
            };

            try {
            if (member.isExisting) {
                // Update existing member - use original_user_id and original_service_type for the URL
                const userIdForUrl = member.original_user_id || member.user_id;
                const serviceTypeForUrl = member.original_service_type || member.service_type;
                
                if (!serviceTypeForUrl) {
                  console.error('❌ Cannot update team member without service type');
                  continue;
                }
                
                console.log('🔄 Updating team member:', currentMatterId, userIdForUrl, serviceTypeForUrl, '(original) to', member.user_id, member.service_type, '(new)');
                
                const updateResponse = await fetch(
                API_ENDPOINTS.matters.team.update(currentMatterId, userIdForUrl),
                {
                    method: 'PUT',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(memberPayload),
                }
                );
                const updateResult = await updateResponse.json();
                console.log('✅ Update result:', updateResult);
            } else {
                // Add new member
                console.log('➕ Adding new team member:', currentMatterId);
                const addResponse = await fetch(
                API_ENDPOINTS.matters.team.add(currentMatterId),
                {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(memberPayload),
                }
                );
                const addResult = await addResponse.json();
                console.log('✅ Add result:', addResult);
            }
            } catch (error) {
            console.error('❌ Error saving team member:', member, error);
            }
        }
        }

        setFormData(initialFormData);
        setTeamMembers([]);
        setEngagementLetterFile(null);
        setUploadingEngagementLetter(false);
        onSuccess?.();
        onOpenChange(false);
        // alert(`Matter ${mode === 'create' ? 'created' : 'updated'} successfully!`);
        toast.success(`Matter ${mode === 'create' ? 'created' : 'updated'} successfully!`);
    } catch (error) {
        console.error(`Error ${mode}ing matter:`, error);
        // alert(error instanceof Error ? error.message : `Failed to ${mode} matter. Please try again.`);
        toast.error(error instanceof Error ? error.message : `Failed to ${mode} matter. Please try again.`);
    } finally {
        setIsSubmitting(false);
    }
    };
  }

  if (isLoadingMatter && mode === 'edit') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[800px]">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading matter details...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const isClosed = mode === 'edit' && formData.status?.toLowerCase() === 'closed';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Add New Matter' : 'Edit Matter'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create' 
              ? 'Fill in the matter details below. Fields marked with * are required.'
              : isClosed
              ? 'This matter is closed. Most fields are read-only. You can only change the status to reopen it.'
              : 'Update the matter details below. Current values are shown in the fields.'
            }
          </DialogDescription>
          {isClosed && (
            <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800">
                This matter is closed. To make changes, please reopen it first.
              </p>
            </div>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6 py-4">
            {/* CLIENT & RELATIONSHIP */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Client & Relationship
              </h3>

              <div className="space-y-2">
                <Label htmlFor="client_id">
                  Select Client <span className="text-red-500 -ml-1.5">*</span>
                  {mode === 'edit' && (
                    <span className="text-xs text-gray-500 ml-2">(Cannot be changed in edit mode)</span>
                  )}
                </Label>
                  <Popover 
                    open={clientComboboxOpen} 
                    onOpenChange={(open) => {
                      setClientComboboxOpen(open);
                      if (!open) {
                        setClientSearchQuery(''); // ✅ Reset search when closing
                      }
                    }}
                  >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={clientComboboxOpen}
                      className={`w-full justify-between ${!formData.client_id ? 'border-red-300' : ''}`}
                      disabled={isLoadingClients || isClosed || mode === 'edit'}
                    >
                      {isLoadingClients ? (
                        "Loading..."
                      ) : formData.client_id ? (
                        (() => {
                          const selectedClient = clients.find(
                            (client) => client.id.toString() === formData.client_id
                          );
                          return selectedClient ? (
                            <div>
                              <span>{selectedClient.companyName}</span>
                              {selectedClient.industry && (
                                <span className="text-gray-500 text-xs ml-2">
                                  ({selectedClient.industry})
                                </span>
                              )}
                            </div>
                          ) : (
                            "Select client"
                          );
                        })()
                      ) : (
                        "Select client"
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput 
                        placeholder="Search clients..." 
                        onValueChange={(value) => setClientSearchQuery(value)}
                      />
                      <CommandList>
                        <CommandEmpty>No clients found.</CommandEmpty>
                        
                        <CommandGroup>
                          {isLoadingClients ? (
                            <div className="px-3 py-2 text-sm text-gray-500 text-center">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mx-auto mb-1"></div>
                              Loading clients...
                            </div>
                          ) : Array.isArray(clients) && clients.length > 0 ? (
                            <>
                              {/* ✅ Show only 5 if no search query, show ALL if searching */}
                              {(clientSearchQuery ? clients : clients.slice(0, 5)).map((client, index) => {
                                const id = client?.id?.toString?.() || `temp-${index}`;
                                const name = client?.companyName || "Unnamed Client";
                                const industry = client?.industry || '';

                                return (
                                  <CommandItem
                                    key={id}
                                    value={`${name} ${industry}`.toLowerCase()}
                                    onSelect={() => {
                                      handleChange('client_id', id);
                                      setClientComboboxOpen(false);
                                      setClientSearchQuery(''); // ✅ Reset search after selection
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        formData.client_id === id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    <div className="flex flex-col">
                                      <span>{name}</span>
                                      {industry && (
                                        <span className="text-gray-500 text-xs">
                                          {industry}
                                        </span>
                                      )}
                                    </div>
                                  </CommandItem>
                                );
                              })}
                              
                              {/* ✅ Show hint message only when NOT searching and there are more than 5 clients */}
                              {!clientSearchQuery && clients.length > 5 && (
                                <div className="px-3 py-2 text-xs text-gray-500 italic border-t">
                                  + {clients.length - 5} more clients (type to search)
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="px-3 py-2 text-sm text-gray-500 text-center">
                              {clientSearchQuery ? 'No clients found matching your search' : 'No clients available'}
                            </div>
                          )}

                          {/* ✅ Create New Client Button - Always visible */}
                          <CommandItem
                            value="__create_new_client__"
                            onSelect={() => {
                              setShowClientDialog(true);
                              setClientComboboxOpen(false);
                              setClientSearchQuery(''); // ✅ Reset search
                            }}
                            className="text-blue-600 font-medium border-t sticky bottom-0 bg-white"
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Create New Client
                          </CommandItem>
                          
                         
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="opposing_party_name">Opposing Party Name</Label>
                <Input
                  id="opposing_party_name"
                  value={formData.opposing_party_name}
                  onChange={(e) => handleChange('opposing_party_name', e.target.value)}
                  placeholder="e.g., XYZ Legal Associates"
                />
              </div>
            </div>

            {/* MATTER INFORMATION */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Matter Information
              </h3>

              <div className="space-y-2">
                <Label htmlFor="matter_creation_requested_by">Matter Creation Requested By</Label>
                <Popover open={matterRequestedByComboboxOpen} onOpenChange={setMatterRequestedByComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={matterRequestedByComboboxOpen}
                      className="w-full justify-between"
                    >
                      {formData.matter_creation_requested_by
                        ? users.find(u => u.user_id.toString() === formData.matter_creation_requested_by)?.name
                        : "Select user..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput placeholder="Search user..." />
                      <CommandList>
                        <CommandEmpty>No user found.</CommandEmpty>
                        <CommandGroup>
                          {users.map((user) => (
                            <CommandItem
                              key={user.user_id}
                              value={user.name}
                              onSelect={() => {
                                handleChange('matter_creation_requested_by', user.user_id.toString());
                                setMatterRequestedByComboboxOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  formData.matter_creation_requested_by === user.user_id.toString()
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                              <div>
                                <div className="font-medium">{user.name}</div>
                                <div className="text-sm text-gray-500">{user.email}</div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="matter_title">
                  Matter Title <span className="text-red-500 -ml-1.5">*</span>
                </Label>
                <Input
                  id="matter_title"
                  value={formData.matter_title}
                  onChange={(e) => handleChange('matter_title', e.target.value)}
                  placeholder="e.g., Corporate Merger - ABC Inc."
                  required
                  className={!formData.matter_title?.trim() ? 'border-red-300 focus:border-red-500' : ''}
                  disabled={isClosed}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">
                    Start Date <span className="text-red-500 -ml-1.5">*</span>
                  </Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => handleChange('start_date', e.target.value)}
                    required
                    className={!formData.start_date ? 'border-red-300 focus:border-red-500' : ''}
                    disabled={isClosed}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="estimated_deadline">Estimated Deadline</Label>
                  <Input
                    id="estimated_deadline"
                    type="date"
                    value={formData.estimated_deadline}
                    onChange={(e) => handleChange('estimated_deadline', e.target.value)}
                    min={formData.start_date || undefined}  

                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="practice_area">Practice Area</Label>
                  <Select
                    value={formData.practice_area}
                    onValueChange={(value) => handleChange('practice_area', value)}
                  >
                    <SelectTrigger id="practice_area">
                      <SelectValue placeholder="Select practice area" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Practice Area</SelectItem>
                      {PRACTICE_AREAS.map((area) => (
                        <SelectItem key={area} value={area}>
                          {area}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="matter_type">Matter Type</Label>
                  <Select
                    value={formData.matter_type}
                    onValueChange={(value) => handleChange('matter_type', value)}
                  >
                    <SelectTrigger id="matter_type">
                      <SelectValue placeholder="Select matter type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Matter Type</SelectItem>
                      {MATTER_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Add a description of the matter..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="engagement_letter">Engagement Letter</Label>

                {/* Show existing engagement letter URL if in edit mode */}
                {formData.engagement_letter_url && !engagementLetterFile && (
                  <div className="mb-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-gray-700 font-medium mb-1">Current engagement letter:</p>
                    <a
                      href={formData.engagement_letter_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline break-all flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      View Engagement Letter
                    </a>
                  </div>
                )}

                {/* File input */}
                <Input
                  id="engagement_letter"
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleEngagementLetterSelect}
                  disabled={uploadingEngagementLetter || isSubmitting}
                />

                <p className="text-xs text-gray-500">
                  Supported format: PDF only (max 10MB)
                  {formData.engagement_letter_url && ' • Upload a new file to replace the existing one'}
                </p>

                {/* Selected file indicator */}
                {engagementLetterFile && (
                  <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <p className="text-sm text-green-700 font-medium">
                      Selected: {engagementLetterFile.name}
                    </p>
                  </div>
                )}

                {/* Upload progress indicator */}
                {uploadingEngagementLetter && (
                  <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <p className="text-sm text-blue-700">
                      Uploading engagement letter...
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* FINANCIAL DETAILS */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Financial Details
              </h3>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="estimated_value">Estimated Value</Label>
                  <Input
                    id="estimated_value"
                    type="number"
                    step="1"
                    min="0"
                    value={formData.estimated_value}
                    onChange={(e) => handleChange('estimated_value', e.target.value)}
                    placeholder="e.g., 50000.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency">
                    Currency
                    {mode === 'edit' && (
                      <span className="text-xs text-gray-500 ml-2">(Cannot be changed in edit mode)</span>
                    )}
                  </Label>
                  <Select
                    value={formData.currency || 'INR'}
                    onValueChange={(value) => handleChange('currency', value)}
                    disabled={mode === 'edit'}
                  >
                    <SelectTrigger id="currency" disabled={mode === 'edit'}>
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {supportedCurrencies.map((curr) => (
                        <SelectItem key={curr} value={curr}>
                          {curr}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="billing_rate_type">Billing Rate Type</Label>
                  <Select
                    value={formData.billing_rate_type}
                    onValueChange={(value) => {
                      console.log('🔄 Billing rate type changed to:', value);
                      handleChange('billing_rate_type', value);
                    }}
                  >
                    <SelectTrigger id="billing_rate_type">
                      <SelectValue placeholder="Select billing type" />
                    </SelectTrigger>
                    <SelectContent>
                      {BILLING_RATE_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* ASSIGNMENT - Only show in create mode */}
            {mode === 'create' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  Assignment
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Assigned Lawyer */}
                  <div className="space-y-2">
                    <Label htmlFor="assigned_lawyer">Matter Lead</Label>
                    <Popover modal={true}open={assignedLawyerOpen} onOpenChange={setAssignedLawyerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="w-full justify-between"
                          disabled={isLoadingUsers}
                        >
                          {formData.assigned_lawyer
                            ? users.find(u => u.user_id === Number(formData.assigned_lawyer))?.name || "Select Team Lead"
                            : "Select Team Lead"}

                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>

                      <PopoverContent className="w-full p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search Team Lead..." />
                          <CommandList>
                            <CommandEmpty>No team Leads found.</CommandEmpty>

                            <CommandGroup>
                              {Array.isArray(users) &&
                                users
                                  .filter((user) => {
                                    const isAlreadyTeamMember = teamMembers.some(
                                      (tm) => tm.user_id === user.user_id
                                    );

                                    const isCurrentAssignedLawyer =
                                      formData.assigned_lawyer &&
                                      Number(formData.assigned_lawyer) === user.user_id;

                                    return user && user.user_id && (!isAlreadyTeamMember || isCurrentAssignedLawyer);
                                  })
                                  .map((user) => (
                                    <CommandItem
                                      key={user.user_id}
                                      value={user.name}
                                      onSelect={() => {
                                        const isChangingLawyer =
                                          String(user.user_id) !== formData.assigned_lawyer;

                                        handleChange("assigned_lawyer", String(user.user_id));

                                        if (isChangingLawyer) {
                                          // setAssignedLawyerServiceType("");
                                          setAssignedLawyerRate("");
                                        }

                                        setAssignedLawyerOpen(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          Number(formData.assigned_lawyer) === user.user_id
                                            ? "opacity-100"
                                            : "opacity-0"
                                        )}
                                      />
                                      <div className="flex flex-col">
                                        <span>{user.name}</span>
                                        {user.email && (
                                          <span className="text-gray-500 text-xs">{user.email}</span>
                                        )}
                                      </div>
                                    </CommandItem>
                                  ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>


                  {/* Service Type - Show for both hourly and fixed */}
                  {/* {formData.assigned_lawyer && (
                    <div className="space-y-2">
                      <Label htmlFor="assigned_lawyer_service">Service Type</Label>
                      <div className="flex gap-2">
                        <Popover
                          open={assignedLawyerServiceOpen}
                          onOpenChange={(open) => {
                            setAssignedLawyerServiceOpen(open);
                            if (!open) {
                              setAssignedLawyerServiceSearchQuery('');
                            }
                          }}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className="w-full justify-between"
                            >
                              {assignedLawyerServiceType || "Select service"}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0" align="start">
                            <Command>
                              <CommandInput
                                placeholder="Search service types..."
                                onValueChange={(value) => setAssignedLawyerServiceSearchQuery(value)}
                              />
                              <CommandList>
                                <CommandEmpty>No service types found.</CommandEmpty>
                                <CommandGroup>
                                  {assignedLawyerServiceTypes.length > 0 ? (
                                    <>
                                      {(assignedLawyerServiceSearchQuery
                                        ? assignedLawyerServiceTypes
                                        : assignedLawyerServiceTypes.slice(0, 5)
                                      ).map((serviceType) => (
                                        <CommandItem
                                          key={serviceType}
                                          value={serviceType.toLowerCase()}
                                          onSelect={() => {
                                            setAssignedLawyerServiceType(serviceType);
                                            setAssignedLawyerServiceSearchQuery('');
                                            setAssignedLawyerServiceOpen(false);
                                          }}
                                        >
                                          <Check
                                            className={cn(
                                              "mr-2 h-4 w-4",
                                              assignedLawyerServiceType === serviceType ? "opacity-100" : "opacity-0"
                                            )}
                                          />
                                          {serviceType}
                                        </CommandItem>
                                      ))}

                                      {!assignedLawyerServiceSearchQuery && assignedLawyerServiceTypes.length > 5 && (
                                        <div className="px-3 py-2 text-xs text-gray-500 italic border-t">
                                          + {assignedLawyerServiceTypes.length - 5} more (type to search)
                                        </div>
                                      )}
                                    </>
                                  ) : (
                                    <div className="px-3 py-2 text-gray-500 text-sm">
                                      {formData.assigned_lawyer
                                        ? 'No rate cards found for this user'
                                        : 'Select a lawyer first'}
                                    </div>
                                  )}

                                  ✅ ADD BOTH OPTIONS
                                  {formData.assigned_lawyer && (
                                    <>
                                      <CommandItem
                                        value="__create_new_rate_card_assigned__"
                                        onSelect={() => {
                                          handleOpenRateCardDialog('assigned_lawyer', undefined, false);
                                          setAssignedLawyerServiceSearchQuery('');
                                          setAssignedLawyerServiceOpen(false);
                                        }}
                                        className="text-blue-600 font-medium border-t sticky bottom-0 bg-white"
                                      >
                                        <Plus className="w-4 h-4 mr-2" />
                                        Create New Rate Card (with rates)
                                      </CommandItem>
                                      <CommandItem
                                        value="__create_empty_rate_card_assigned__"
                                        onSelect={() => {
                                          handleOpenRateCardDialog('assigned_lawyer', undefined, true);
                                          setAssignedLawyerServiceSearchQuery('');
                                          setAssignedLawyerServiceOpen(false);
                                        }}
                                        className="text-green-600 font-medium bg-white"
                                      >
                                        <Plus className="w-4 h-4 mr-2" />
                                        Create Empty Rate Card
                                      </CommandItem>
                                    </>
                                  )}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  )} */}

                  {/* Hourly Rate - Only show if billing type is hourly */}
                  {formData.assigned_lawyer && formData.billing_rate_type === 'hourly' && (
                  <div className="space-y-2">
                    <Label htmlFor="assigned_lawyer_rate">
                      Hourly Rate ({formData.currency})
                    </Label>

                    <Input
                      id="assigned_lawyer_rate"
                      type="number"
                      step="0.01"
                      min={0}
                      value={assignedLawyerRate}
                      onChange={(e) => setAssignedLawyerRate(e.target.value)}
                      placeholder="Enter hourly rate"
                      className="border-gray-300"
                    />

                    {assignedLawyerRate && !isNaN(Number(assignedLawyerRate)) && (
                      <p className="text-xs text-gray-500">
                        Min will be stored as{" "}
                        <strong>
                          {Number(assignedLawyerRate) * 0.5}
                        </strong>{" "}
                        and Max will be stored as{" "}
                        <strong>
                          {Number(assignedLawyerRate) * 1.5}
                        </strong>
                      </p>
                    )}

                    {/* {assignedLawyerConvertedRate && formData.currency !== 'INR' && (
                      <p className="text-xs text-blue-600 font-medium">
                        💡 Will be stored as:{" "}
                        {formatAmountWithCurrency(
                          assignedLawyerConvertedRate,
                          formData.currency as CurrencyCode
                        )}
                      </p>
                    )} */}
                  </div>
                )}

                </div>

                {/* Info message for fixed rate */}
                {formData.assigned_lawyer && assignedLawyerServiceType && formData.billing_rate_type === 'fixed' && (
                  <p className="text-sm text-gray-500 italic">
                    ✓ Service type recorded. Hourly rate not applicable for fixed billing.
                  </p>
                )}
              </div>
            )}

            {/* TEAM MEMBERS */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                    Team Members
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Add team members who will work on this matter
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => setShowAddTeamMember(!showAddTeamMember)}
                  className="bg-blue-600 text-white hover:bg-blue-700"
                >
                  <Plus size={16} className="mr-1" />
                  Add
                </Button>
              </div>

              {/* Add Team Member Form */}
              {showAddTeamMember && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex flex-col gap-4">
                    {/* Input Row */}
                    <div className="flex gap-3 items-end">
                      {/* ✅ LAWYER SELECT (This was missing!) */}
                      <div className="flex-1 min-w-0">
                        <Label htmlFor="new-team-member" className="text-sm font-medium">Lawyer</Label>
                        <Popover open={addTeamMemberComboboxOpen} onOpenChange={setAddTeamMemberComboboxOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={addTeamMemberComboboxOpen}
                              className="w-full justify-between mt-1"
                              disabled={isLoadingUsers}
                            >
                              {newTeamMember.user_id
                                ? users.find(u => u.user_id === newTeamMember.user_id)?.name || "Select Lawyer"
                                : "Select Lawyer"}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>

                          <PopoverContent className="w-full p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Search lawyers..." />
                              <CommandList>
                                <CommandEmpty>No lawyers found.</CommandEmpty>

                                <CommandGroup>
                                  {users
                                    .filter(u => {
                                      const isAssigned = formData.assigned_lawyer && u.user_id === Number(formData.assigned_lawyer);
                                      return !isAssigned;
                                    })
                                    .map(user => (
                                      <CommandItem
                                        key={user.user_id}
                                        value={user.name}
                                        onSelect={() => {
                                          setNewTeamMember(prev => ({
                                            ...prev,
                                            user_id: user.user_id,
                                            service_type: "",
                                            hourly_rate: ""
                                          }));

                                          // Force fetch of service types
                                          setNewMemberServiceTypes([]);

                                          setAddTeamMemberComboboxOpen(false);
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            newTeamMember.user_id === user.user_id ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        <div className="flex flex-col">
                                          <span>{user.name}</span>
                                          {user.email && (
                                            <span className="text-gray-500 text-xs">{user.email}</span>
                                          )}
                                        </div>
                                      </CommandItem>
                                    ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* Service Type Select */}
                      {/* <div className="flex-1 min-w-0">
                        <Label htmlFor="new-team-service" className="text-sm font-medium">Service Type</Label>
                        <Popover
                          open={newMemberServiceOpen}
                          onOpenChange={(open) => {
                            setNewMemberServiceOpen(open);
                            if (!open) {
                              setNewMemberServiceSearchQuery('');
                            }
                          }}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className="w-full justify-between mt-1"
                            >
                              {newTeamMember.service_type || "Select service"}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0" align="start">
                            <Command>
                              <CommandInput
                                placeholder="Search service types..."
                                onValueChange={(value) => setNewMemberServiceSearchQuery(value)}
                              />
                              <CommandList>
                                <CommandEmpty>No service types found.</CommandEmpty>
                                <CommandGroup>
                                  {newMemberServiceTypes.length > 0 ? (
                                    <>
                                      {(newMemberServiceSearchQuery
                                        ? newMemberServiceTypes
                                        : newMemberServiceTypes.slice(0, 5)
                                      ).map((serviceType) => (
                                        <CommandItem
                                          key={serviceType}
                                          value={serviceType.toLowerCase()}
                                          onSelect={() => {
                                            setNewTeamMember({ ...newTeamMember, service_type: serviceType });
                                            setNewMemberServiceSearchQuery('');
                                            setNewMemberServiceOpen(false);
                                          }}
                                        >
                                          <Check
                                            className={cn(
                                              "mr-2 h-4 w-4",
                                              newTeamMember.service_type === serviceType ? "opacity-100" : "opacity-0"
                                            )}
                                          />
                                          {serviceType}
                                        </CommandItem>
                                      ))}

                                      {!newMemberServiceSearchQuery && newMemberServiceTypes.length > 5 && (
                                        <div className="px-3 py-2 text-xs text-gray-500 italic border-t">
                                          + {newMemberServiceTypes.length - 5} more (type to search)
                                        </div>
                                      )}
                                    </>
                                  ) : (
                                    <div className="px-3 py-2 text-gray-500 text-sm">
                                      {newTeamMember.user_id
                                        ? 'No rate cards found for this user'
                                        : 'Select a Lawyer first'}
                                    </div>
                                  )}

                                  ✅ ADD BOTH OPTIONS
                                  {newTeamMember.user_id && (
                                    <>
                                      <CommandItem
                                        value="__create_new_rate_card_new_member__"
                                        onSelect={() => {
                                          handleOpenRateCardDialog('new_member', undefined, false);
                                          setNewMemberServiceSearchQuery('');
                                          setNewMemberServiceOpen(false);
                                        }}
                                        className="text-blue-600 font-medium border-t sticky bottom-0 bg-white"
                                      >
                                        <Plus className="w-4 h-4 mr-2" />
                                        Create New Rate Card (with rates)
                                      </CommandItem>
                                      <CommandItem
                                        value="__create_empty_rate_card_new_member__"
                                        onSelect={() => {
                                          handleOpenRateCardDialog('new_member', undefined, true);
                                          setNewMemberServiceSearchQuery('');
                                          setNewMemberServiceOpen(false);
                                        }}
                                        className="text-green-600 font-medium bg-white"
                                      >
                                        <Plus className="w-4 h-4 mr-2" />
                                        Create Empty Rate Card
                                      </CommandItem>
                                    </>
                                  )}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div> */}

                      {/* ✅ HOURLY RATE INPUT - Only show if rate range exists */}
                      {newTeamMember.user_id && formData.billing_rate_type === 'hourly' && (
                      <div className="flex-1 min-w-0">
                        <Label className="text-sm font-medium">
                          Hourly Rate ({formData.currency})
                        </Label>

                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          value={newTeamMember.hourly_rate}
                          onChange={(e) =>
                            setNewTeamMember(prev => ({
                              ...prev,
                              hourly_rate: e.target.value,
                            }))
                          }
                          placeholder="Enter hourly rate"
                          className="mt-1 border-gray-300"
                        />

                        {newTeamMember.hourly_rate && !isNaN(Number(newTeamMember.hourly_rate)) && (
                          <p className="text-xs text-gray-500 mt-1">
                            Min will be stored as{" "}
                            <strong>{Number(newTeamMember.hourly_rate) * 0.5}</strong>{" "}
                            and Max will be stored as{" "}
                            <strong>{Number(newTeamMember.hourly_rate) * 1.5}</strong>
                          </p>
                        )}
                      </div>
                    )}

                      {/* ✅ ADD/CANCEL BUTTONS */}
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          onClick={handleAddTeamMember}
                          className="bg-green-600 hover:bg-green-700 whitespace-nowrap"
                        >
                          Add
                        </Button>
                        <Button
                          type="button"
                          onClick={() => {
                            setShowAddTeamMember(false);
                            setNewTeamMember({ user_id: 0, hourly_rate: '', service_type: '' });
                            setNewMemberServiceSearchQuery(''); 
                          }}
                          variant="secondary"
                          className="whitespace-nowrap"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Team Members Table */}
              {teamMembers.length > 0 ? (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                          Lawyer
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                          Lawyer Role
                        </th>
                        {/* <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                          Service Type
                        </th> */}
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                          Hourly Rate
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {teamMembers.map((member, index) => (
                        <tr key={`${member.user_id}-${member.service_type}-${index}`} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">
                            {member.isEditing ? (
                              <Select
                                value={member.user_id ? member.user_id.toString() : ""}
                                onValueChange={(value) => updateTeamMember(index, "user_id", Number(value))}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select Lawyer" />
                                </SelectTrigger>
                                <SelectContent>
                                  {users
                                    .filter((u) => {
                                      // Allow same user with different service types
                                      // Only filter out if user is assigned lawyer
                                      const isAssignedLawyer = formData.assigned_lawyer && u.user_id === Number(formData.assigned_lawyer);
                                      return u && u.user_id && !isAssignedLawyer;
                                    })
                                    .map((user) => (
                                      <SelectItem key={user.user_id} value={user.user_id.toString()}>
                                        {user.name || "Unnamed User"}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              member.userName || "—"
                            )}
                          </td>

                          <td className="px-6 py-4 text-sm text-gray-600">
                            {/* ✅ FIXED: Display the actual role, not practice area */}
                            {member.role || member.userRole || "Lawyer"}
                          </td>

                          {/* <td className="px-6 py-4 text-sm text-gray-600">
                            {member.isEditing ? (
                              <Popover
                                open={editMemberServiceOpen[index] || false}
                                onOpenChange={(open) => {
                                  setEditMemberServiceOpen(prev => ({ ...prev, [index]: open }));
                                  if (!open) {
                                    setEditMemberServiceSearchQuery(prev => ({ ...prev, [index]: '' }));
                                  }
                                }}
                              >
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    role="combobox"
                                    className="w-full justify-between"
                                  >
                                    {member.service_type || "Select service"}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-full p-0" align="start">
                                  <Command>
                                    <CommandInput
                                      placeholder="Search service types..."
                                      onValueChange={(value) => {
                                        setEditMemberServiceSearchQuery(prev => ({ ...prev, [index]: value }));
                                      }}
                                    />
                                    <CommandList>
                                      <CommandEmpty>No service types found.</CommandEmpty>
                                      <CommandGroup>
                                        {(editMemberServiceTypes[index] || []).length > 0 ? (
                                          <>
                                            {((editMemberServiceSearchQuery[index] || '')
                                              ? editMemberServiceTypes[index]
                                              : (editMemberServiceTypes[index] || []).slice(0, 5)
                                            ).map((serviceType) => (
                                              <CommandItem
                                                key={serviceType}
                                                value={String(serviceType).toLowerCase()}
                                                onSelect={() => {
                                                  updateTeamMember(index, "service_type", serviceType);
                                                  setEditMemberServiceSearchQuery(prev => ({ ...prev, [index]: '' }));
                                                  setEditMemberServiceOpen(prev => ({ ...prev, [index]: false }));
                                                }}
                                              >
                                                <Check
                                                  className={cn(
                                                    "mr-2 h-4 w-4",
                                                    member.service_type === serviceType ? "opacity-100" : "opacity-0"
                                                  )}
                                                />
                                                {serviceType}
                                              </CommandItem>
                                            ))}

                                            {!(editMemberServiceSearchQuery[index] || '') && (editMemberServiceTypes[index] || []).length > 5 && (
                                              <div className="px-3 py-2 text-xs text-gray-500 italic border-t">
                                                + {(editMemberServiceTypes[index] || []).length - 5} more (type to search)
                                              </div>
                                            )}
                                          </>
                                        ) : (
                                          <div className="px-3 py-2 text-gray-500 text-sm">
                                            {member.user_id
                                              ? 'No rate cards found for this user'
                                              : 'Select a Lawyer first'}
                                          </div>
                                        )}

                                        ✅ ADD BOTH OPTIONS
                                        {member.user_id && (
                                          <>
                                            <CommandItem
                                              value="__create_new_rate_card_edit__"
                                              onSelect={() => {
                                                handleOpenRateCardDialog('edit_member', index, false);
                                                setEditMemberServiceSearchQuery(prev => ({ ...prev, [index]: '' }));
                                                setEditMemberServiceOpen(prev => ({ ...prev, [index]: false }));
                                              }}
                                              className="text-blue-600 font-medium border-t sticky bottom-0 bg-white"
                                            >
                                              <Plus className="w-4 h-4 mr-2" />
                                              Create New Rate Card (with rates)
                                            </CommandItem>
                                            <CommandItem
                                              value="__create_empty_rate_card_edit__"
                                              onSelect={() => {
                                                handleOpenRateCardDialog('edit_member', index, true);
                                                setEditMemberServiceSearchQuery(prev => ({ ...prev, [index]: '' }));
                                                setEditMemberServiceOpen(prev => ({ ...prev, [index]: false }));
                                              }}
                                              className="text-green-600 font-medium bg-white"
                                            >
                                              <Plus className="w-4 h-4 mr-2" />
                                              Create Empty Rate Card
                                            </CommandItem>
                                          </>
                                        )}
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                            ) : (
                              member.service_type ? member.service_type.replace('_', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : "—"
                            )}
                          </td> */}


                          {/* ✅ HOURLY RATE CELL - Only show if editing and rate range exists, or if not editing and rate exists */}
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {/* {member.isEditing ? (
                              editMemberRateRanges[index] ? (
                                <div className="space-y-1">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min={editMemberRateRanges[index].min}
                                    max={editMemberRateRanges[index].max}
                                    value={member.hourly_rate || ''}
                                    onChange={(e) => updateTeamMember(index, "hourly_rate", e.target.value)}
                                    placeholder={`${editMemberRateRanges[index].min}-${editMemberRateRanges[index].max}`}
                                    className="border-gray-300"
                                  />
                                  <p className="text-xs text-gray-500">
                                    Range: ₹{editMemberRateRanges[index].min} - ₹{editMemberRateRanges[index].max}
                                  </p>
                                  {editMemberConvertedRates[index] && formData.currency !== 'INR' && (
                                    <p className="text-xs text-blue-600 font-medium">
                                      💡 Will be stored as: {formatAmountWithCurrency(editMemberConvertedRates[index], formData.currency as CurrencyCode)}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-400 italic text-xs">No rate card available</span>
                              )
                            ) : (
                              <div className="space-y-1">
                                <span className="font-medium">
                                  {member.hourly_rate ? `₹${parseFloat(member.hourly_rate).toFixed(2)}` : '—'}
                                </span>
                                {member.hourly_rate && teamMemberConvertedRates[index] && formData.currency !== 'INR' && (
                                  <p className="text-xs text-gray-600">
                                    ≈ {formatAmountWithCurrency(teamMemberConvertedRates[index], formData.currency as CurrencyCode)}
                                  </p>
                                )}
                              </div>
                            )} */}
                            {member.isEditing ? (
                              <Input
                                type="number"
                                step="0.01"
                                min={0}
                                value={member.hourly_rate || ''}
                                onChange={(e) =>
                                  updateTeamMember(index, 'hourly_rate', e.target.value)
                                }
                                placeholder="Enter hourly rate"
                                className="border-gray-300"
                              />
                            ) : (
                              <span className="font-medium">
                                {member.hourly_rate
                                  ? formatAmountWithCurrency(
                                      Number(member.hourly_rate),
                                      formData.currency as CurrencyCode
                                    )
                                  : '—'}
                              </span>
                            )}
                          </td>


                          <td className="px-6 py-4 text-sm">
                            <div className="flex items-center gap-4">
                              {member.isEditing ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const member = teamMembers[index];

                                      if (!member.user_id) {
                                        alert('Please select a user');
                                        return;
                                      }

                                      // ✅ Only validate hourly rate if billing type is hourly AND rate range exists
                                      // if (formData.billing_rate_type === 'hourly' && editMemberRateRanges[index]) {
                                      //   if (!member.hourly_rate) {
                                      //     alert('Please enter an hourly rate');
                                      //     return;
                                      //   }

                                      //   const enteredRate = parseFloat(member.hourly_rate);
                                      //   const range = editMemberRateRanges[index];
                                      //   if (enteredRate < range.min || enteredRate > range.max) {
                                      //     alert(`Hourly rate must be between ₹${range.min} and ₹${range.max}`);
                                      //     return;
                                      //   }
                                      // }

                                      try {
                                        console.log('💾 Saving team member:', member);
                                        
                                        const urlUserId = member.original_user_id || member.user_id;
                                        const urlServiceType = member.original_service_type || member.service_type;
                                        
                                        const response = await fetch(
                                          API_ENDPOINTS.matters.team.update(
                                            Number(matterId),
                                            Number(urlUserId),
                                          ),
                                          {
                                            method: 'PUT',
                                            credentials: 'include',
                                            headers: {
                                              'Content-Type': 'application/json',
                                            },
                                            body: JSON.stringify({
                                              role: member.role,
                                              hourly_rate_input:
                                                formData.billing_rate_type === 'hourly' && member.hourly_rate
                                                  ? parseFloat(member.hourly_rate)
                                                  : null,
                                            })
                                          }
                                        );

                                        if (!response.ok) {
                                          const errorData = await response.json();
                                          throw new Error(errorData.message || 'Failed to update team member');
                                        }

                                        const result = await response.json();

                                        if (result.success) {
                                          const updatedMembers = [...teamMembers];
                                          updatedMembers[index] = {
                                            ...updatedMembers[index],
                                            isEditing: false,
                                            // original_service_type: member.service_type,
                                            original_user_id: member.user_id,
                                          };
                                          setTeamMembers(updatedMembers);
                                          
                                          // ✅ Clear the rate range for this index
                                          // setEditMemberRateRanges((prev) => {
                                          //   const newRanges = { ...prev };
                                          //   delete newRanges[index];
                                          //   return newRanges;
                                          // });
                                          
                                          alert('Team member updated successfully!');
                                        }
                                      } catch (error) {
                                        console.error('Error updating team member:', error);
                                        alert(error instanceof Error ? error.message : 'Failed to update team member');
                                      }
                                    }}
                                    className="text-green-600 hover:text-green-800 font-medium flex items-center gap-1"
                                  >
                                    <span>Save</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => cancelEditTeamMember(index)}
                                    className="text-gray-600 hover:text-gray-800 font-medium flex items-center gap-1"
                                  >
                                    <span>Cancel</span>
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => toggleEditTeamMember(index, true)}
                                    className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                                  >
                                    <Pencil size={14} />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeTeamMember(index)}
                                    className="text-red-600 hover:text-red-800 font-medium flex items-center gap-1"
                                    disabled={isSubmitting || isDeleting} // Add this to prevent clicks during operations
                                  >
                                    <Trash2 size={14} />
                                    <span>Remove</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-300 rounded-lg py-12 text-center">
                  <p className="text-sm text-gray-500">
                    No team members added yet. Click &quot;Add&quot; to add team members to this matter.
                  </p>
                </div>
              )}

              {teamMembers.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <span className="font-medium">{teamMembers.length}</span> team member{teamMembers.length !== 1 ? 's' : ''} added to this matter
                  </p>
                </div>
              )}

              {/* Past Team Members Section - Only show in edit mode */}
              {mode === 'edit' && pastTeamMembers.length > 0 && (
                <div className="space-y-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowPastMembers(!showPastMembers)}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-gray-700">
                        Past Team Members ({pastTeamMembers.length})
                      </h4>
                    </div>
                    {showPastMembers ? (
                      <ChevronUp className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    )}
                  </button>

                  {showPastMembers && (
                    <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                      {isLoadingPastMembers ? (
                        <div className="py-8 text-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600 mx-auto mb-2"></div>
                          <p className="text-sm text-gray-500">Loading past members...</p>
                        </div>
                      ) : (
                        <table className="w-full">
                          <thead className="bg-gray-100 border-b border-gray-200">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                Member Name
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                Role
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                Service Type
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                Period
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                Duration
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {pastTeamMembers.map((member, index) => (
                              <tr key={index} className="hover:bg-gray-50">
                                <td className="px-6 py-4 text-sm text-gray-700">
                                  <div className="flex flex-col">
                                    <span className="font-medium">{member.memberName}</span>
                                    <span className="text-xs text-gray-500">
                                      Removed by {member.removedBy}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600">
                                  {member.role || '—'}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600">
                                  {member.serviceType 
                                    ? member.serviceType.replace('_', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                                    : '—'
                                  }
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600">
                                  <div className="flex flex-col">
                                    <span>
                                      {new Date(member.addedDate).toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric',
                                      })}
                                    </span>
                                    <span className="text-xs text-gray-500">to</span>
                                    <span>
                                      {new Date(member.removedDate).toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric',
                                      })}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600">
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                    {member.durationDays} {member.durationDays === 1 ? 'day' : 'days'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="flex justify-between">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting || isDeleting}
              >
                Cancel
              </Button>
              <Button className="mb-2 flex items-center justify-center gap-2 px-4 py-2.5 
                        bg-gradient-to-r from-red-500 to-red-600  text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-colors duration-200 shadow-md py-3" type="submit" disabled={isSubmitting || isDeleting || isClosed}>
                {isSubmitting 
                  ? (mode === 'create' ? 'Creating...' : 'Updating...') 
                  : (mode === 'create' ? 'Create Matter' : 'Update Matter')
                }
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
      {/* Client Dialog for creating new client */}
      <ClientDialog
        open={showClientDialog}
        onOpenChange={setShowClientDialog}
        mode="create"
        onSuccess={async () => {
          // Refresh clients list after creating new client
          try {
            const response = await fetch(API_ENDPOINTS.clients.list, {
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              },
            });

            if (response.ok) {
              const data = await response.json();
              if (data.success) {
                setClients(data.data);
                // Auto-select the newly created client (last in the list)
                if (data.data.length > 0) {
                  const newClient = data.data[data.data.length - 1];
                  handleChange('client_id', newClient.id.toString());
                }
              }
            }
          } catch (error) {
            console.error('Error refreshing clients:', error);
          }
        } } industries={[]}      />

      {/* Rate Card Dialog for creating new rate cards */}
      <RateCardDialog
        open={showRateCardDialog}
        onOpenChange={(open) => {
          setShowRateCardDialog(open);
          if (!open) {
            setRateCardContext(null);
            setEditMemberIndex(null);
            setAllowEmptyRates(false); // ✅ Reset when closing
          }
        }}
        mode="create"
        allowEmptyRates={allowEmptyRates} // ✅ Use state variable instead of hardcoded value
        prefilledUserId={
          rateCardContext === 'assigned_lawyer' && formData.assigned_lawyer
            ? Number(formData.assigned_lawyer)
            : rateCardContext === 'new_member' && newTeamMember.user_id
              ? newTeamMember.user_id
              : rateCardContext === 'edit_member' && editMemberIndex !== null
                ? teamMembers[editMemberIndex]?.user_id
                : undefined
        }
        onSuccess={() => {
          handleRateCardSuccess();
          setShowRateCardDialog(false);
        }}
      />
      
    </Dialog>
  );
}