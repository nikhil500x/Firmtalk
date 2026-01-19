'use client';

import { useState, useEffect } from 'react';
import { API_ENDPOINTS } from '@/lib/api';
import { Search, Plus, Edit2, Trash2, X, Check, ChevronDown, ChevronUp, Settings } from 'lucide-react';
import { toast } from 'react-toastify';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import RateCardDialog from '@/components/invoice/RateCardDialog';
import SetMatterRateDialog from '@/components/matter/SetMatterRateDialog';
import { type CurrencyCode } from '@/lib/currencyUtils';


interface MatterTeamData {
  assignedLawyer?: {
    id: number;
    [key: string]: unknown;
  };
  teamMembers?: Array<{
    userId: number;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

interface MatterTeamProps {
  matterId: number;
  matterData?: MatterTeamData;
}

interface TeamMember {
  id?: number;
  userId?: number;
  originalUserId?: number;
  originalServiceType?: string;
  name: string;
  email: string;
  phone?: string;
  practiceArea?: string;
  role: string;
  serviceType?: string;
  hourlyRate?: number;
  assignedAt?: string;
  isExisting?: boolean;
  isEditing?: boolean;
  isAssignedLawyer?: boolean;
  rateCardStatus?: RateCardStatus;
}

interface RateCardStatus {
  exists: boolean;
  hasRates: boolean;
  minRate: number | null;
  maxRate: number | null;
  isEmptyRateCard: boolean;
  rateCardId?: number;
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

interface User {
  id: number;  // ✅ Changed from user_id to id
  user_id?: number; // ✅ Keep as optional for backward compatibility
  name: string;
  email: string;
  phone?: string;
  practice_area?: string;
  role?: string | {  // ✅ Can be string or object
    name: string;
  };
  roleId?: number;
}

// Helper function to safely get user ID from user object
const getUserId = (user: User | null | undefined): number | undefined => {
  if (!user) return undefined;
  return user.user_id ?? user.id;
};

export default function MatterTeam({ matterId, matterData }: MatterTeamProps) {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [originalTeamMembers, setOriginalTeamMembers] = useState<TeamMember[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newMemberHourlyRate, setNewMemberHourlyRate] = useState<string>('');
  const [newMemberRateRange, setNewMemberRateRange] = useState<{min: number, max: number} | null>(null);
  const [availableServiceTypes, setAvailableServiceTypes] = useState<string[]>([]);
  const [selectedServiceType, setSelectedServiceType] = useState<string>('');
  const [fetchingRate, setFetchingRate] = useState(false);
  const [assignedLawyer, setAssignedLawyer] = useState<TeamMember | null>(null);
  const [pastTeamMembers, setPastTeamMembers] = useState<PastTeamMember[]>([]);
  const [isLoadingPastMembers, setIsLoadingPastMembers] = useState(false);
  const [showPastMembers, setShowPastMembers] = useState(false);
  const [showLawyerDropdown, setShowLawyerDropdown] = useState(false);
  const [lawyerSearch, setLawyerSearch] = useState('');
  const [rateCardStatuses, setRateCardStatuses] = useState<Map<string, RateCardStatus>>(new Map());
  const [matterCurrency, setMatterCurrency] = useState<string>('INR');
  
  // Two-step rate setting flow
  const [showRateCardDialog, setShowRateCardDialog] = useState(false);
  const [showSetMatterRateDialog, setShowSetMatterRateDialog] = useState(false);
  const [selectedMemberForRates, setSelectedMemberForRates] = useState<TeamMember | null>(null);
  const [updatedRateCardInfo, setUpdatedRateCardInfo] = useState<{min: number, max: number} | null>(null);
  
  useEffect(() => {
    loadTeamData(true);
    loadPastTeamMembers();
  }, [matterId]);

  const loadPastTeamMembers = async () => {
    try {
      setIsLoadingPastMembers(true);
      console.log('🔍 Fetching past team members for matter:', matterId);
      
      const response = await fetch(API_ENDPOINTS.matters.team.history(matterId), {
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
      setPastTeamMembers([]);
    } finally {
      setIsLoadingPastMembers(false);
    }
  };

  const fetchRateCardStatus = async (userId: number, serviceType: string): Promise<RateCardStatus | null> => {
    try {
      const encodedServiceType = encodeURIComponent(serviceType);
      const response = await fetch(
        API_ENDPOINTS.rateCards.activeByService(userId, encodedServiceType),
        { credentials: 'include' }
      );
      
      if (!response.ok) {
        return null;
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        const rateCard = result.data;
        const hasRates = rateCard.min_hourly_rate !== null && rateCard.max_hourly_rate !== null;
        
        return {
          exists: true,
          hasRates,
          minRate: rateCard.min_hourly_rate,
          maxRate: rateCard.max_hourly_rate,
          isEmptyRateCard: !hasRates,
          rateCardId: rateCard.ratecard_id,
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching rate card status:', error);
      return null;
    }
  };

  // Handler for "Set Rates" button - starts two-step flow
  const handleSetRatesClick = async (member: TeamMember) => {
    
    if (!member.userId || !member.serviceType) {
      console.error('❌ Missing userId or serviceType');
      return;
    }
    
    const key = `${member.userId}-${member.serviceType}`;
    const status = rateCardStatuses.get(key);
    
    console.log('📊 Rate card status:', status);
    
    if (!status) {
      toast.error('Rate card status not found');
      return;
    }

    setSelectedMemberForRates(member);

    if (status.isEmptyRateCard && status.rateCardId) {
      // Step 1: Open rate card dialog to update rates
      // console.log('📝 Opening Rate Card Dialog for empty rate card');
      setShowRateCardDialog(true);
    } else if (status.hasRates && !member.hourlyRate) {
      // Skip step 1, go directly to step 2 (set matter rate)
      // console.log('💰 Opening Set Matter Rate Dialog directly');
      setUpdatedRateCardInfo({
        min: status.minRate!,
        max: status.maxRate!,
      });
      setShowSetMatterRateDialog(true);
    } else {
      console.log('⚠️ Unhandled case:', { isEmptyRateCard: status.isEmptyRateCard, hasRates: status.hasRates, hourlyRate: member.hourlyRate });
    }
  };

  // Handler for rate card dialog success - move to step 2
  const handleRateCardUpdateSuccess = async () => {
    console.log('Rate card updated successfully');
    
    // Close rate card dialog
    setShowRateCardDialog(false);

    // Fetch the updated rate card to get the rate information
    if (selectedMemberForRates?.userId && selectedMemberForRates?.serviceType) {
      try {
        const rateCardId = rateCardStatuses.get(`${selectedMemberForRates.userId}-${selectedMemberForRates.serviceType}`)?.rateCardId;
        if (rateCardId) {
          const response = await fetch(API_ENDPOINTS.rateCards.byId(rateCardId), {
            credentials: 'include',
          });
          const data = await response.json();
          if (data.success && data.data) {
            const rateCard = data.data;
            const minRate = rateCard.min_hourly_rate;
            const maxRate = rateCard.max_hourly_rate;

            if (minRate && maxRate) {
              setUpdatedRateCardInfo({
                min: minRate,
                max: maxRate,
              });

              // Open set matter rate dialog (step 2)
              setShowSetMatterRateDialog(true);
            } else {
              toast.error('Rate card updated but no rate information found');
            }
          }
        }
      } catch (error) {
        console.error('Error fetching updated rate card:', error);
        toast.error('Failed to get updated rate card information');
      }
    }
  };

  // Handler for set matter rate dialog success - refresh team data
  const handleSetMatterRateSuccess = () => {
    setShowSetMatterRateDialog(false);
    setSelectedMemberForRates(null);
    setUpdatedRateCardInfo(null);
    
    // Refresh team data to show updated rates
    loadTeamData(true);
    toast.success('Rates updated successfully');
  };

  const loadTeamData = async (forceRefresh = false) => {
    try {
      setLoading(true);
      
      let members: TeamMember[] = [];
      let assignedLawyerData = null;
      
      if (forceRefresh || !matterData?.teamMembers) {
        console.log('🔄 Fetching fresh team data from API...');
        const response = await fetch(API_ENDPOINTS.matters.byId(matterId), {
          credentials: 'include',
        });
        const result = await response.json();
        console.log('📥 API Response:', result);
        
        if (result.success && result.data) {
          assignedLawyerData = result.data.assignedLawyer;
          
          // Extract matter currency
          if (result.data.currency) {
            setMatterCurrency(result.data.currency);
          }
          
          if (result.data.teamMembers) {
            members = result.data.teamMembers.map((m: {
              userId: number;
              [key: string]: unknown;
            }) => ({
              userId: m.userId,
              originalUserId: m.userId,
              originalServiceType: m.serviceType,
              name: m.name,
              email: m.email,
              phone: m.phone,
              practiceArea: m.practiceArea,
              role: m.userRole || m.matterRole || 'Associate',
              serviceType: m.serviceType,
              hourlyRate: m.hourlyRate,
              assignedAt: m.assignedAt,
              isExisting: true,
              isEditing: false,
            }));
          }
        }
      } else {
        console.log('📋 Using initial matterData');
        assignedLawyerData = matterData.assignedLawyer;
        
        members = matterData.teamMembers
          .filter((m: {
            userId: number;
            [key: string]: unknown;
          }) => m.userId !== matterData.assignedLawyer?.id) // ✅ Remove assigned lawyer here too
          .map((m: {
            userId: number;
            name?: string;
            email?: string;
            phone?: string;
            practiceArea?: string;
            userRole?: string;
            matterRole?: string;
            role?: string;
            serviceType?: string;
            hourlyRate?: number | string;
            assignedAt?: string;
            [key: string]: unknown;
          }) => ({
          userId: m.userId,
          originalUserId: m.userId,
          originalServiceType: typeof m.serviceType === 'string' ? m.serviceType : '',
          name: typeof m.name === 'string' ? m.name : '',
          email: typeof m.email === 'string' ? m.email : '',
          phone: typeof m.phone === 'string' ? m.phone : '',
          practiceArea: typeof m.practiceArea === 'string' ? m.practiceArea : '',
          role: (typeof m.userRole === 'string' ? m.userRole : typeof m.matterRole === 'string' ? m.matterRole : typeof m.role === 'string' ? m.role : 'Associate'),
          serviceType: typeof m.serviceType === 'string' ? m.serviceType : '',
          hourlyRate: typeof m.hourlyRate === 'number' || typeof m.hourlyRate === 'string' ? (typeof m.hourlyRate === 'number' ? m.hourlyRate : parseFloat(String(m.hourlyRate)) || 0) : 0,
          assignedAt: typeof m.assignedAt === 'string' ? m.assignedAt : '',
          isExisting: true,
          isEditing: false,
        }));
      }
      

      
     if (assignedLawyerData) {
      members = members.filter(m => m.userId !== assignedLawyerData.id);
    }

    setTeamMembers(members);
    setOriginalTeamMembers(JSON.parse(JSON.stringify(members)));
      
      if (assignedLawyerData) {
        setAssignedLawyer({
          userId: assignedLawyerData.id,
          name: assignedLawyerData.name,
          email: assignedLawyerData.email,
          phone: assignedLawyerData.phone,
          practiceArea: assignedLawyerData.practiceArea,
          role: 'Lead',
          serviceType: assignedLawyerData.serviceType,
          hourlyRate: assignedLawyerData.hourlyRate,
          isAssignedLawyer: true,
        });
      }

      // Fetch rate card statuses for all members (including assigned lawyer)
      // console.log('🔍 Fetching rate card statuses for team members...');
      const statusMap = new Map<string, RateCardStatus>();
      const allMembers = [...members];
      if (assignedLawyerData && assignedLawyerData.serviceType) {
        allMembers.push({
          userId: assignedLawyerData.id,
          serviceType: assignedLawyerData.serviceType,
        } as TeamMember);
      }

      for (const member of allMembers) {
        if (member.userId && member.serviceType) {
          const status = await fetchRateCardStatus(member.userId, member.serviceType);
          const key = `${member.userId}-${member.serviceType}`;
          if (status) {
            // console.log(`✅ Rate card status for ${key}:`, status);
            statusMap.set(key, status);
          } else {
            console.log(`⚠️ No rate card found for ${key}`);
          }
        }
      }
      // console.log('📊 Final rate card statuses map:', statusMap);
      setRateCardStatuses(statusMap);
    } catch (error) {
      console.error('Error loading team data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadServiceTypesForUser = async (userId: number) => {
    try {
      setAvailableServiceTypes([]);
      setSelectedServiceType('');
      setNewMemberHourlyRate('');
      
      // ✅ Add validation
      if (!userId || userId === undefined) {
        console.error('Invalid userId:', userId);
        return;
      }
      
      const response = await fetch(API_ENDPOINTS.rateCards.userServiceTypes(userId), {
        credentials: 'include',
      });
      const result = await response.json();
      
      if (result.success && result.data) {
        setAvailableServiceTypes(result.data);
      }
    } catch (error) {
      console.error('Error loading service types:', error);
    }
  };

  const fetchHourlyRateForService = async (userId: number, serviceType: string) => {
    try {
      setFetchingRate(true);
      
      console.log('🔍 Fetching rate range for userId:', userId, 'serviceType:', serviceType);
      
      const encodedServiceType = encodeURIComponent(serviceType);
      const url = API_ENDPOINTS.rateCards.activeByService(userId, encodedServiceType);
      
      console.log('📡 Fetching from URL:', url);
      
      const response = await fetch(url, { credentials: 'include' });
      const result = await response.json();
      
      console.log('📥 Rate card response:', result);
      
      if (result.success && result.data) {
        // Backend now returns min_hourly_rate and max_hourly_rate
        const rateRange = {
          min: result.data.min_hourly_rate,
          max: result.data.max_hourly_rate
        };
        console.log('✅ Rate range found:', rateRange);
        setNewMemberRateRange(rateRange);
        
        // Set suggested rate (midpoint) as default
        const suggestedRate = ((rateRange.min + rateRange.max) / 2).toString();
        setNewMemberHourlyRate(suggestedRate);
      } else {
        console.warn('⚠ No rate card found in response');
        setNewMemberHourlyRate('');
        setNewMemberRateRange(null);
      }
    } catch (error) {
      console.error('❌ Error fetching rate range:', error);
      setNewMemberHourlyRate('');
      setNewMemberRateRange(null);
    } finally {
      setFetchingRate(false);
    }
  };

  const addTeamMemberToList = () => {
    if (!selectedUser) return;

    const selectedUserId = getUserId(selectedUser); // ✅ Use helper function
    
    if (!selectedUserId) {
      // alert('Invalid user selected');
      toast.error('Invalid user selected');
      return;
    }
    
    // Check if this user+serviceType combination already exists
    if (teamMembers.some(m => m.userId === selectedUserId && m.serviceType === selectedServiceType)) {
      // alert('This user is already a team member with this service type');
      toast.error('This user is already a team member with this service type');
      return;
    }

    if (!selectedServiceType) {
      // alert('Please select a service type');
      toast.error('Please select a service type');
      return;
    }

    // Validate hourly rate is within range if range exists
    if (newMemberRateRange && newMemberHourlyRate) {
      const enteredRate = parseFloat(newMemberHourlyRate);
      if (enteredRate < newMemberRateRange.min || enteredRate > newMemberRateRange.max) {
        // alert(`Hourly rate must be between ₹${newMemberRateRange.min} and ₹${newMemberRateRange.max}`);
        toast.error(`Hourly rate must be between ₹${newMemberRateRange.min} and ₹${newMemberRateRange.max}`);
        return;
      }
    }

    // ✅ Fix role extraction
    const userRole = typeof selectedUser.role === 'object' && selectedUser.role?.name
      ? selectedUser.role.name
      : typeof selectedUser.role === 'string'
      ? selectedUser.role
      : 'Associate';
    
    if (!userRole || userRole.trim() === '') {
      // alert('User must have a valid role');
      toast.error('User must have a valid role');
      return;
    }

    const newMember: TeamMember = {
      userId: selectedUserId,
      name: selectedUser.name,
      email: selectedUser.email,
      phone: selectedUser.phone,
      practiceArea: selectedUser.practice_area,
      role: userRole.trim(),
      serviceType: selectedServiceType,
      hourlyRate: newMemberHourlyRate ? parseFloat(newMemberHourlyRate) : undefined,
      isExisting: false,
      isEditing: false,
    };

    console.log('➕ Adding team member to list:', newMember);
    console.log('   Role value:', newMember.role, 'Type:', typeof newMember.role);
    console.log('   Service Type:', newMember.serviceType);
    console.log('   Hourly Rate:', newMember.hourlyRate);
      
    setTeamMembers([...teamMembers, newMember]);
    setShowAddModal(false);
    setSelectedUser(null);
    setSelectedServiceType('');
    setAvailableServiceTypes([]);
    setNewMemberHourlyRate('');
  };

  const removeTeamMemberFromList = (userId: number, serviceType?: string) => {
    if (!confirm('Are you sure you want to remove this team member?')) {
      return;
    }

    console.log('🗑 Removing team member from list:', userId, serviceType);
    // Filter by both userId and serviceType to allow same user with different service types
    setTeamMembers(teamMembers.filter(m => !(m.userId === userId && m.serviceType === serviceType)));
  };

  const toggleEdit = (userId: number, serviceType?: string) => {
    setTeamMembers(teamMembers.map(m => 
      (m.userId === userId && m.serviceType === serviceType) ? { ...m, isEditing: !m.isEditing } : m
    ));
  };

  const updateTeamMember = (userId: number, serviceType: string | undefined, field: keyof TeamMember, value: string | number | undefined) => {
    setTeamMembers(teamMembers.map(m => {
      if (m.userId === userId && m.serviceType === serviceType) {
        if (field === 'userId' && typeof value === 'number') {
          const selectedUser = allUsers.find(u => getUserId(u) === value); // ✅ Use helper function
          return {
            ...m,
            userId: value,
            name: selectedUser?.name || m.name,
            email: selectedUser?.email || m.email,
            phone: selectedUser?.phone || m.phone,
            practiceArea: selectedUser?.practice_area || m.practiceArea,
            role: typeof selectedUser?.role === 'object' ? selectedUser.role.name : selectedUser?.role || m.role,
          };
        }
        return { ...m, [field]: value };
      }
      return m;
    }));
  };

  const cancelEdit = (userId: number, serviceType?: string) => {
    // Restore from original if it was existing (match by userId+serviceType)
    const original = originalTeamMembers.find(m => 
      ((m.originalUserId === userId) || (m.userId === userId)) &&
      ((m.originalServiceType === serviceType) || (m.serviceType === serviceType))
    );
    if (original) {
      setTeamMembers(teamMembers.map(m => 
        (m.userId === userId && m.serviceType === serviceType) ? { ...original, isEditing: false } : m
      ));
    } else {
      // If it was a new member, just toggle edit off
      setTeamMembers(teamMembers.map(m => 
        (m.userId === userId && m.serviceType === serviceType) ? { ...m, isEditing: false } : m
      ));
    }
  };

  const saveChanges = async () => {
    try {
      setSaving(true);
      console.log('💾 Saving team changes...');
      console.log('📋 Current team members:', teamMembers);
      console.log('📋 Original team members:', originalTeamMembers);

      // Get existing user+serviceType combinations from original state
      const existingCombinations = originalTeamMembers.map(m => ({
        userId: m.originalUserId || m.userId,
        serviceType: m.originalServiceType || m.serviceType
      }));
      const currentCombinations = teamMembers.map(m => ({
        userId: m.userId,
        serviceType: m.serviceType
      }));

      // 1. DELETE removed members (by userId+serviceType combination)
      const combinationsToDelete = existingCombinations.filter(existing => 
        !currentCombinations.some(current => 
          current.userId === existing.userId && current.serviceType === existing.serviceType
        )
      );
      console.log('🗑 Combinations to delete:', combinationsToDelete);

      for (const combo of combinationsToDelete) {
        if (!combo.userId || !combo.serviceType) continue;
        try {
          const response = await fetch(API_ENDPOINTS.matters.team.remove(matterId, combo.userId, combo.serviceType), {
            method: 'DELETE',
            credentials: 'include',
          });
          const result = await response.json();
          if (!result.success) {
            console.error('Failed to delete user:', combo, result.message);
            throw new Error(`Failed to delete user ${combo.userId} with service type ${combo.serviceType}: ${result.message}`);
          } else {
            console.log('✅ Deleted team member:', combo);
          }
        } catch (error) {
          console.error('❌ Error deleting team member:', combo, error);
          throw error;
        }
      }
      
      // ✅ FIX: Update originalTeamMembers after deletions to reflect current database state
      const updatedOriginalMembers = originalTeamMembers.filter(m => 
        !combinationsToDelete.some(combo => 
          combo.userId === (m.originalUserId || m.userId) && 
          combo.serviceType === (m.originalServiceType || m.serviceType)
        )
      );

      // 2. UPDATE or ADD members
      console.log('📤 Processing team members:', teamMembers);
      for (const member of teamMembers) {
        console.log('🔍 Processing member:', {
          userId: member.userId,
          role: member.role,
          roleType: typeof member.role,
          isExisting: member.isExisting
        });

        // Validate member has required fields
        if (!member.userId) {
          console.error('⚠ Skipping member - missing userId:', member);
          // alert(`Skipping invalid team member: ${member.name} - missing user ID`);
          toast.error(`Skipping invalid team member: ${member.name} - missing user ID`);
          continue;
        }

        if (!member.role || member.role.trim() === '') {
          console.error('⚠ Skipping member - missing or empty role:', member);
          // alert(`Skipping invalid team member: ${member.name} - missing role`);
          toast.error(`Skipping invalid team member: ${member.name} - missing role`);
          continue;
        }

        const memberPayload = {
          user_id: member.userId,
          role: member.role.trim(),
          service_type: member.serviceType || null,
          hourly_rate: member.hourlyRate ? parseFloat(member.hourlyRate.toString()) : null,
        };

        console.log('📦 Member payload:', memberPayload);

        try {
          // ✅ FIX: Check if member was in original list (before deletions) by userId+serviceType
          const wasOriginalMember = updatedOriginalMembers.some(m => 
            ((m.originalUserId && m.originalUserId === member.userId) || (m.userId === member.userId)) &&
            ((m.originalServiceType && m.originalServiceType === member.serviceType) || (m.serviceType === member.serviceType))
          );

          if (wasOriginalMember) {
            // UPDATE existing member
            const userIdForUrl = member.originalUserId || member.userId;
            const serviceTypeForUrl = member.originalServiceType || member.serviceType;
            
            if (!serviceTypeForUrl) {
              console.error('⚠ Cannot update member without service type:', member);
              // alert(`Cannot update ${member.name} - missing service type`);
              toast.error(`Cannot update ${member.name} - missing service type`);
              continue;
            }
            
            console.log('🔄 Updating team member - Matter:', matterId, 'User:', userIdForUrl, 'ServiceType:', serviceTypeForUrl, '→', member.userId, member.serviceType);

            const response = await fetch(
              API_ENDPOINTS.matters.team.update(matterId, userIdForUrl),
              {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(memberPayload),
              }
            );
            const result = await response.json();
            console.log('🔄 Update response:', result);
            
            if (!result.success) {
              throw new Error(result.message || 'Failed to update member');
            }
            console.log('✅ Update successful:', result);
          } else {
            // ADD new member
            console.log('➕ Adding new team member - Matter:', matterId, 'Payload:', memberPayload);

            const response = await fetch(
              API_ENDPOINTS.matters.team.add(matterId),
              {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(memberPayload),
              }
            );
            const result = await response.json();
            console.log('➕ Add response:', result);
            
            if (!result.success) {
              throw new Error(result.message || 'Failed to add member');
            }
            console.log('✅ Add successful:', result);
          }
        } catch (error) {
          console.error('❌ Error saving team member:', member, error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          // alert(`Failed to save team member ${member.name}: ${errorMessage}`);
          toast.error(`Failed to save team member ${member.name}: ${errorMessage}`);
          throw error;
        }
      }
      
      // ✅ Update both teamMembers to mark all as existing, and originalTeamMembers
      const updatedMembers = teamMembers.map(m => ({
        ...m,
        originalUserId: m.userId,
        isExisting: true,
      }));
      
      // Update state to reflect backend changes
      setTeamMembers(updatedMembers);
      setOriginalTeamMembers(JSON.parse(JSON.stringify(updatedMembers)));

      setSaving(false);

      console.log('✅ Team updated successfully');
      // alert('Team changes saved successfully!');
      toast.success('Team changes saved successfully!');

    } catch (error) {
      console.error('❌ Error saving team changes:', error);
      const errorMessage = error instanceof Error ? error.message : 'Please try again.';
      // alert(`Failed to save team changes: ${errorMessage}`);
      toast.error(`Failed to save team changes: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };



  const hasChanges = () => {
    // Check if there are any differences between current and original state
    if (teamMembers.length !== originalTeamMembers.length) return true;
    
    return teamMembers.some(current => {
      const original = originalTeamMembers.find(o => 
        (o.originalUserId && o.originalUserId === current.originalUserId) ||
        (o.userId === current.userId)
      );
      if (!original) return true; // New member
      return (
        current.userId !== original.userId ||
        current.role !== original.role ||
        current.serviceType !== original.serviceType ||
        current.hourlyRate !== original.hourlyRate
      );
    });
  };

  const getAvailableUsers = () => {
    const teamMemberIds = teamMembers.map(m => m.userId);
    const assignedLawyerId = assignedLawyer?.userId;

    return allUsers.filter(user => {
      const userId = getUserId(user); // ✅ Use helper function
      // Exclude both team members and assigned lawyer
      return userId && !teamMemberIds.includes(userId) && userId !== assignedLawyerId;
    });
  };

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const res = await fetch(API_ENDPOINTS.users.list, {
          credentials: 'include',
        });
        const result = await res.json();

        if (result.success) {
          setAllUsers(result.data);
        }
      } catch (e) {
        console.error('Failed to load users', e);
      }
    };

    loadUsers();
  }, []);


  const filteredMembers = teamMembers.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         member.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'All' || member.role.toLowerCase().includes(statusFilter.toLowerCase());
    return matchesSearch && matchesStatus;
  });

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getAvatarColor = (index: number) => {
    const colors = [
      'bg-blue-500',
      'bg-indigo-500', 
      'bg-purple-500',
      'bg-pink-500',
      'bg-green-500',
      'bg-yellow-500',
      'bg-red-500',
      'bg-cyan-500',
    ];
    return colors[index % colors.length];
  };

  const getRoleDisplayName = (role: string) => {
    if (!role) return 'Associate';
    return role.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-3 text-sm text-gray-600">Loading team members...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 flex items-center gap-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by Name"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option>All</option>
                <option>Partner</option>
                <option>Associate</option>
                <option>Sr. Associate</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {hasChanges() && (
              <button
                onClick={saveChanges}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            )}
            <button
              onClick={() => setShowAddModal(true)}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              Add Lawyer
            </button>
          </div>
        </div>
      </div>

      {/* Team Members List */}
      <div className="p-6">
        {assignedLawyer && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Assigned Lawyer</h3>
            <div className="relative group border-2 border-blue-200 bg-blue-50 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                  {getInitials(assignedLawyer.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-gray-900 truncate">{assignedLawyer.name}</h4>
                    <span className="px-2 py-0.5 text-xs font-bold text-blue-700 bg-blue-200 rounded-full">
                      LEAD
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">{getRoleDisplayName(assignedLawyer.role)}</p>
                  {assignedLawyer.serviceType && (
                    <p className="text-xs text-gray-500 mt-1">
                      Service: {assignedLawyer.serviceType}
                    </p>
                  )}

                  {/* Rate Card Status Display */}
                  {assignedLawyer.serviceType && (() => {
                    const key = `${assignedLawyer.userId}-${assignedLawyer.serviceType}`;
                    const status = rateCardStatuses.get(key);
                    
                    return (
                      <div className="mt-2 space-y-1">
                        {/* Rate Card Status */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600 font-medium">Rate Card:</span>
                          {status?.isEmptyRateCard ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
                              ⚠️ Empty Rate Card
                            </span>
                          ) : status?.hasRates ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 border border-green-200 rounded text-xs text-green-700">
                              ✓ Rates: ₹{status.minRate?.toLocaleString()} - ₹{status.maxRate?.toLocaleString()}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                              ❌ No Rate Card
                            </span>
                          )}
                        </div>
                        
                        {/* Matter Rate Status */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600 font-medium">Matter Rate:</span>
                          {assignedLawyer.hourlyRate ? (
                            <span className="text-xs text-green-700 font-semibold">
                              ₹{assignedLawyer.hourlyRate.toLocaleString()}/hr
                            </span>
                          ) : (
                            <span className="text-xs text-gray-500 italic">Not Set</span>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="flex items-center gap-1.5 mt-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-xs text-gray-500">Active</span>
                  </div>
                </div>
              </div>

              <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Are you sure you want to remove the assigned lawyer?')) {
                      setAssignedLawyer(null);
                    }
                  }}
                  disabled={saving}
                  className="p-1.5 bg-white border border-gray-200 rounded hover:bg-red-50 hover:border-red-300 transition-colors disabled:opacity-50"
                  title="Remove Assigned Lawyer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-600" />
                </button>
              </div>
            </div>
          </div>
        )}

        <h3 className="text-sm font-semibold text-gray-700 mb-3">Team Members</h3>
        {filteredMembers.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <p className="text-sm text-gray-500 font-medium">No team members found</p>
            <p className="text-xs text-gray-400 mt-1">Add lawyers to this matter</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMembers.map((member, index) => (
              <div
                key={`${member.userId}-${index}`}
                className="relative group border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all"
              >
                {member.isEditing ? (
                  // Edit Mode
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-600 block mb-1">Select User</label>
                      <select
                        value={member.userId}
                        onChange={(e) => member.userId !== undefined && updateTeamMember(member.userId, member.serviceType, 'userId', Number(e.target.value))}
                        className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {allUsers
                          .filter(u => getUserId(u) === member.userId || !teamMembers.some(tm => tm.userId === getUserId(u)))
                          .map(user => {
                            const uid = getUserId(user);
                            return (
                              <option key={uid ?? user.name} value={uid ?? ''}>
                                {user.name}
                              </option>
                            );
                          })}
                    </select>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => member.userId !== undefined && toggleEdit(member.userId, member.serviceType)}
                        disabled={saving}
                        className="flex-1 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => member.userId !== undefined && cancelEdit(member.userId, member.serviceType)}
                        disabled={saving}
                        className="flex-1 px-3 py-1.5 bg-gray-200 text-gray-700 text-xs font-medium rounded hover:bg-gray-300 transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <>
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 ${getAvatarColor(index)} rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0`}>
                        {getInitials(member.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-gray-900 truncate">{member.name}</h4>
                        <p className="text-xs text-gray-600 mt-0.5">{getRoleDisplayName(member.role)}</p>
                        {member.serviceType && (
                          <p className="text-xs text-gray-500 mt-1">Service: {member.serviceType}</p>
                        )}
                        
                        {/* Rate Card Status Display */}
                        {member.serviceType && (() => {
                          const key = `${member.userId}-${member.serviceType}`;
                          const status = rateCardStatuses.get(key);
                          const showSetRates = (status?.isEmptyRateCard || (status?.hasRates && !member.hourlyRate));
                          
                          return (
                            <div className="mt-2 space-y-2">
                              <div className="space-y-1">
                                {/* Rate Card Status */}
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-600 font-medium">Rate Card:</span>
                                  {status?.isEmptyRateCard ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
                                      ⚠️ Empty Rate Card
                                    </span>
                                  ) : status?.hasRates ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 border border-green-200 rounded text-xs text-green-700">
                                      ✓ Rates: ₹{status.minRate?.toLocaleString()} - ₹{status.maxRate?.toLocaleString()}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                                      ❌ No Rate Card
                                    </span>
                                  )}
                                </div>
                                
                                {/* Matter Rate Status */}
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-600 font-medium">Matter Rate:</span>
                                  {member.hourlyRate ? (
                                    <span className="text-xs text-green-700 font-semibold">
                                      ₹{member.hourlyRate.toLocaleString()}/hr
                                    </span>
                                  ) : (
                                    <span className="text-xs text-gray-500 italic">Not Set</span>
                                  )}
                                </div>
                              </div>
                              
                              {/* Set Rates Button (inline) */}
                              {showSetRates && (
                                <button
                                  type="button"
                                  onClick={() => handleSetRatesClick(member)}
                                  disabled={saving}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white text-xs font-medium rounded hover:bg-blue-600 transition-colors disabled:opacity-50 shadow-sm"
                                >
                                  <Settings className="w-3.5 h-3.5" />
                                  Set Rates
                                </button>
                              )}
                            </div>
                          );
                        })()}
                    
                        <div className="flex items-center gap-1.5 mt-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-xs text-gray-500">Active</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    {(() => {
                      const key = `${member.userId}-${member.serviceType}`;
                      const status = rateCardStatuses.get(key);
                      const showSetRates = (status?.isEmptyRateCard || (status?.hasRates && !member.hourlyRate));
                      
                      return (
                        <div className={`absolute top-3 right-3 flex items-center gap-1 transition-opacity ${showSetRates ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                          <button
                            type="button"
                            onClick={() => member.userId !== undefined && removeTeamMemberFromList(member.userId, member.serviceType)}
                            disabled={saving}
                            className="p-1.5 bg-white border border-gray-200 rounded hover:bg-red-50 hover:border-red-300 transition-colors disabled:opacity-50"
                            title="Remove"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-600" />
                          </button>
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Past Team Members Section */}
      {pastTeamMembers.length > 0 && (
        <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200">
          <button
            type="button"
            onClick={() => setShowPastMembers(!showPastMembers)}
            className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors rounded-t-xl"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="text-left">
                <h3 className="text-lg font-semibold text-gray-900">
                  Past Team Members
                </h3>
                <p className="text-sm text-gray-500">
                  {pastTeamMembers.length} {pastTeamMembers.length === 1 ? 'member' : 'members'} previously worked on this matter
                </p>
              </div>
            </div>
            {showPastMembers ? (
              <ChevronUp className="h-5 w-5 text-gray-500" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-500" />
            )}
          </button>

          {showPastMembers && (
            <div className="border-t border-gray-200">
              {isLoadingPastMembers ? (
                <div className="py-12 text-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
                  <p className="text-sm text-gray-500">Loading past members...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Member Name
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Role
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Service Type
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Period
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Duration
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {pastTeamMembers.map((member, index) => (
                        <tr key={index} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-gray-900">{member.memberName}</span>
                              <span className="text-xs text-gray-500 mt-1">
                                Removed by {member.removedBy}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                              {member.role || 'Team Member'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {member.serviceType 
                              ? member.serviceType.replace('_', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                              : '—'
                            }
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col text-sm">
                              <span className="text-gray-900 font-medium">
                                {new Date(member.addedDate).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                              <span className="text-gray-400 text-xs my-0.5">to</span>
                              <span className="text-gray-900 font-medium">
                                {new Date(member.removedDate).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              {member.durationDays} {member.durationDays === 1 ? 'day' : 'days'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Add Lawyer Modal */}
      {showAddModal && (
        <>
          <div 
            className="fixed inset-0  backdrop-sm z-40 transition-all"
            onClick={() => {
              setShowAddModal(false);
              setSelectedUser(null);
              setNewMemberHourlyRate('');
              setSelectedServiceType('');
              setAvailableServiceTypes([]);
            }}
          ></div>

          <div className="fixed inset-0 flex items-center justify-center z-50 p-2 pointer-events-none">
            <div className="bg-white rounded-md shadow-lg max-w-lg w-full h-[75vh] flex flex-col pointer-events-auto transition-all">
              <div className="px-6 py-5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-t-2xl flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white">Add Lawyer to Team</h3>
                  <p className="text-blue-100 text-sm mt-1">Select a lawyer from the list below</p>
                </div>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setSelectedUser(null);
                    setNewMemberHourlyRate(''); // ✅ Add this line
                    setSelectedServiceType('');
                    setAvailableServiceTypes([]);
                  }}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                <div className="mb-4 relative">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Available Lawyers
                  </label>

                  {/* SELECT-LIKE INPUT */}
                  <button
                    type="button"
                    onClick={() => setShowLawyerDropdown((v) => !v)}
                    className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm hover:border-blue-500"
                  >
                    <span className={selectedUser ? 'text-gray-900' : 'text-gray-400'}>
                      {selectedUser ? selectedUser.name : 'Select lawyer'}
                    </span>
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  </button>

                  {/* DROPDOWN */}
                  {showLawyerDropdown && (
                    <div className="absolute z-100 mt-1 w-[20vw] h-[50vh] bg-white border border-gray-200 rounded-xl shadow-lg">
                      {getAvailableUsers().length === 0 ? (
                        <div className="p-6 text-center text-sm text-gray-500">
                          No available lawyers
                        </div>
                      ) : (
                        <Command>
                          {/* SEARCH */}
                          <div className="p-0">
                            <CommandInput
                              placeholder="Search lawyers..."
                              value={lawyerSearch}
                              onValueChange={setLawyerSearch}
                            />
                          </div>

                          {/* LIST */}
                          <CommandList className="max-h-[250px] overflow-y-auto">
                            <CommandEmpty>No lawyers found.</CommandEmpty>

                            <CommandGroup>
                              {(lawyerSearch
                                ? getAvailableUsers().filter(user =>
                                    `${user.name} ${user.email}`
                                      .toLowerCase()
                                      .includes(lawyerSearch.toLowerCase())
                                  )
                                : getAvailableUsers().slice(0, 5)
                              ).map((user) =>  {
                                const userId = getUserId(user);
                                const isSelected = userId === getUserId(selectedUser);

                                return (
                                  <CommandItem
                                    key={userId}
                                    value={`${user.name} ${user.email}`}
                                    onSelect={() => {
                                      if (!userId) return;

                                      setSelectedUser(user);
                                      setSelectedServiceType('');
                                      setNewMemberHourlyRate('');
                                      loadServiceTypesForUser(userId);
                                      setShowLawyerDropdown(false); // ✅ close dropdown
                                    }}
                                    className="cursor-pointer"
                                  >
                                    <div className="flex items-start gap-3 w-full">
                                      {/* CHECK */}
                                      <div className="mt-1 w-4">
                                        {isSelected && (
                                          <Check className="w-4 h-4 text-blue-600" />
                                        )}
                                      </div>

                                      {/* TEXT */}
                                      <div className="flex flex-col">
                                        <span className="text-sm font-medium">
                                          {user.name}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                          {user.practice_area || user.email}
                                        </span>
                                      </div>
                                    </div>
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                          {getAvailableUsers().length > 5 && (
                            <div className="px-4 py-2 text-md text-gray-500 italic border-t bg-gray-50">
                              + {getAvailableUsers().length - 5} more lawyers (use search to find them)
                            </div>
                          )}
                        </Command>
                      )}
                    </div>
                  )}
                </div>


                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Service Type
                  </label>

                  <Command
                    className={`bg-white rounded-lg border border-gray-300 ${
                      !selectedUser ? 'opacity-50 pointer-events-none' : ''
                    }`}
                  >
                    <CommandInput placeholder="Search service types..." />

                    <CommandList className="max-h-[240px] overflow-y-auto">
                      <CommandEmpty>
                        {selectedUser
                          ? 'No service types found.'
                          : 'Select a lawyer first'}
                      </CommandEmpty>

                      <CommandGroup>
                        {availableServiceTypes.map((type) => {
                          const isSelected = selectedServiceType === type;

                          return (
                            <CommandItem
                              key={type}
                              value={type}
                              onSelect={() => {
                                setSelectedServiceType(type);

                                const userId = getUserId(selectedUser);
                                if (userId) {
                                  fetchHourlyRateForService(userId, type);
                                }
                              }}
                              className="cursor-pointer"
                            >
                              <div className="flex items-center justify-between w-full">
                                <span className="text-sm capitalize">
                                  {type.replace('_', ' ')}
                                </span>

                                {isSelected && (
                                  <Check className="w-4 h-4 text-blue-600" />
                                )}
                              </div>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                  
                </div>
                
                {/* Hourly Rate Input */}
                {selectedUser && selectedServiceType && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Hourly Rate for {selectedUser.name}
                      {newMemberRateRange && (
                        <span className="text-xs text-gray-500 ml-1">
                          (Range: ₹{newMemberRateRange.min} - ₹{newMemberRateRange.max})
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                        ₹
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min={newMemberRateRange?.min || 0}
                        max={newMemberRateRange?.max}
                        value={newMemberHourlyRate}
                        onChange={(e) => setNewMemberHourlyRate(e.target.value)}
                        placeholder={
                          fetchingRate 
                            ? "Fetching rate..." 
                            : newMemberRateRange 
                              ? `Enter rate between ${newMemberRateRange.min} and ${newMemberRateRange.max}`
                              : "Enter hourly rate"
                        }
                        disabled={fetchingRate}
                        className={`w-full pl-8 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          fetchingRate ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
                        }`}
                      />
                    </div>
                    {/* <p className="text-xs text-gray-500 mt-1">
                      {fetchingRate 
                        ? 'Fetching rate range from rate card...' 
                        : newMemberRateRange 
                          ? `Suggested rate: ₹${((newMemberRateRange.min + newMemberRateRange.max) / 2).toFixed(2)}`
                          : 'No rate card found for this service type'}
                    </p> */}
                  </div>
                )}

              </div>

             <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-2xl flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  {selectedUser ? 'Click "Add Lawyer" to add to team (remember to save changes)' : 'Select a lawyer to continue'}
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setShowAddModal(false);
                      setSelectedUser(null);
                      setNewMemberHourlyRate(''); // ✅ Add this line
                      setSelectedServiceType('');
                      setAvailableServiceTypes([]);
                    }}
                    disabled={saving}
                    className="px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={addTeamMemberToList}
                    disabled={!selectedUser || saving}
                    className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
                  >
                    Add Lawyer
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Rate Card Dialog - Step 1 */}
      {showRateCardDialog && selectedMemberForRates && (
        <RateCardDialog
          open={showRateCardDialog}
          onOpenChange={setShowRateCardDialog}
          mode="edit"
          rateCardId={rateCardStatuses.get(`${selectedMemberForRates.userId}-${selectedMemberForRates.serviceType}`)?.rateCardId}
          onSuccess={handleRateCardUpdateSuccess}
        />
      )}

      {/* Set Matter Rate Dialog - Step 2 */}
      {showSetMatterRateDialog && selectedMemberForRates && updatedRateCardInfo && (
        <SetMatterRateDialog
          open={showSetMatterRateDialog}
          onOpenChange={setShowSetMatterRateDialog}
          matterId={matterId}
          userId={selectedMemberForRates.userId!}
          userName={selectedMemberForRates.name}
          matterTitle={`Matter #${matterId}`}
          serviceType={selectedMemberForRates.serviceType!}
          rateRange={updatedRateCardInfo}
          matterCurrency={matterCurrency as CurrencyCode}
          onSuccess={handleSetMatterRateSuccess}
        />
      )}
    </div>
  );
}