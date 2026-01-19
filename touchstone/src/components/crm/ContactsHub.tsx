'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useMemo, useEffect } from 'react';
import { Search, Pencil, Trash2, ChevronsUpDown, Check, Eye, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';import MoreActionsMenu, { MenuItem } from '@/components/MoreActionsMenu';
import { useRouter } from 'next/navigation';
import { API_ENDPOINTS } from '@/lib/api';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import Pagination, { usePagination } from '@/components/Pagination';
import ReferredBy from '@/components/crm/ReferredBy';

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
import { toast } from 'react-toastify';


/**
 * Contact Interface Definition
 */
interface Contact {
  id: number;
  name: string;
  clientName: string;
  clientId: number; // Added to store client ID
  designation: string;
  createdBy: string;
  internalReference?: {
    id: number;
    name: string;
    email: string;
    phone?: string;
  } | null;
  externalReferenceName?: string | null;
  phone: string;
  email: string;
  employmentStatus: 'Current' | 'Former';
  lastInteraction: string;
  createdAt: Date;
}

interface Client {
  id: number;
  companyName: string;
  industry?: string;
}

interface ContactsHubProps {
  refreshKey?: number;
}

export default function ContactsHub({ refreshKey }: ContactsHubProps) {
  const router = useRouter();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastInteractionFilter, setLastInteractionFilter] = useState('All');
  const [employmentStatusFilter, setEmploymentStatusFilter] = useState('All');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null); 
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCell, setEditingCell] = useState<{
    contactId: number;
    field: keyof Contact;
  } | null>(null);

  const [editingValue, setEditingValue] = useState("");
  const startEditing = (contactId: number, field: keyof Contact, currentValue: string) => {
    setEditingCell({ contactId, field });

    if (field === "clientName") {
      const contact = contacts.find(c => c.id === contactId);
      setEditingClientId(contact?.clientId?.toString() || "");
      setClientDropdownOpen(true);
    } else {
      setEditingValue(currentValue);
    }
  };

  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const [editingClientId, setEditingClientId] = useState("");
  // Sorting state
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Contact | null;
    direction: 'asc' | 'desc' | null;
  }>({ key: 'createdAt', direction: 'asc' });



  const saveInlineEdit = async () => {
    if (!editingCell) return;

    const { contactId, field } = editingCell;
    const payload: any = {};

    if (field === "clientName") {
      payload.client_id = parseInt(editingClientId);
    } else {
      payload[field] = editingValue;
    }

    try {
      const response = await fetch(API_ENDPOINTS.contacts.update(contactId), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Update failed");

      setContacts(prev =>
        prev.map(c =>
          c.id === contactId
            ? field === "clientName"
              ? {
                  ...c,
                  clientId: parseInt(editingClientId),
                  clientName:
                    clients.find(cl => cl.id === parseInt(editingClientId))
                      ?.companyName || "",
                }
              : { ...c, [field]: editingValue }
            : c
        )
      );
    } catch (err) {
      // alert("Update failed");
      toast.error("Update failed");
    }

    setEditingCell(null);
    setClientDropdownOpen(false);
  };



  const cancelInlineEdit = () => {
    setEditingCell(null);
    setEditingValue("");
  };



  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    email: '',
    designation: '',
    clientId: '',
  });

  const {
    currentPage,
    itemsPerPage,
    setCurrentPage,
    setItemsPerPage,
    resetToFirstPage,
    getPaginatedData,
  } = usePagination(10); // default 10 per page



  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const fetchClients = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.clients.list, {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setClients(data.data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    }
  };

  const fetchContacts = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(API_ENDPOINTS.contacts.list, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Transform API data to match Contact interface
          const transformedContacts = data.data.map((contact: {
            id: number;
            name: string;
            clientName?: string;
            clientId?: number;
            designation?: string;
            createdBy?: string;
            internalReference?: {
              id: number;
              name: string;
              email: string;
              phone?: string;
            } | null;
            externalReferenceName?: string | null;
            email?: string;
            phone?: string;
            number?: string;
            updatedAt?: string | Date;
            createdAt?: string | Date;
            [key: string]: unknown;
          }) => ({
            id: contact.id,
            name: contact.name,
            clientName: contact.clientName || '',
            clientId: contact.clientId, // Store client ID
            designation: contact.designation || 'N/A',
            createdBy: contact.createdBy || 'N/A',
            internalReference: contact.internalReference || null,
            externalReferenceName: contact.externalReferenceName || null,
            phone: contact.number || contact.phone || '',
            email: contact.email || '',
            employmentStatus: 'Current' as const,
            lastInteraction: contact.updatedAt ? new Date(contact.updatedAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            }) : 'N/A',
            createdAt: contact.createdAt? new Date(contact.createdAt) : new Date(),
          }));
          setContacts(transformedContacts);
        }
      }
    } catch (error) {
      console.error('Failed to fetch contacts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch contacts and clients on mount
  useEffect(() => {
    fetchContacts();
    fetchClients();
  }, []);

  // Refetch when refreshTrigger changes
  useEffect(() => {
    if (refreshKey !== undefined && refreshKey > 0) {
      fetchContacts();
    }
  }, [refreshKey]);


  // ============================================================================
  // FILTERING
  // ============================================================================

  // ============================================================================
// FILTERING AND SORTING
// ============================================================================

  const filteredContacts = useMemo(() => {
    return contacts.filter((contact) => {
      const matchesSearch =
        contact.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        contact.clientName.toLowerCase().includes(searchQuery.toLowerCase().trim());

      const matchesEmploymentStatus =
        employmentStatusFilter === 'All' ||
        contact.employmentStatus === employmentStatusFilter;

      return matchesSearch && matchesEmploymentStatus;
    });
  }, [contacts, searchQuery, employmentStatusFilter]);

  // ✅ FIRST: Define sortedContacts
  const sortedContacts = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) {
      return filteredContacts;
    }

    const sorted = [...filteredContacts].sort((a, b) => {
      const aValue = a[sortConfig.key!];
      const bValue = b[sortConfig.key!];

      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      // Date sorting for lastInteraction
      if (sortConfig.key === 'lastInteraction') {
        const aDate = new Date(String(aValue));
        const bDate = new Date(String(bValue));
        
        if (String(aValue).includes('N/A')) return 1;
        if (String(bValue).includes('N/A')) return -1;
        
        return aDate.getTime() - bDate.getTime();
      }

      // Date sorting for createdAt
      if (sortConfig.key === 'createdAt') {
        const aDate = new Date(String(a.createdAt));
        const bDate = new Date(String(b.createdAt));
        return bDate.getTime() - aDate.getTime(); // Descending: newest first
      }

      // Alphabetical sorting for text fields
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();

      if (aStr < bStr) return -1;
      if (aStr > bStr) return 1;
      return 0;
    });

    return sortConfig.direction === 'desc' ? sorted.reverse() : sorted;
  }, [filteredContacts, sortConfig]);

  // ✅ SECOND: Then use sortedContacts in paginatedContacts
  const paginatedContacts = useMemo(() => {
    return getPaginatedData(sortedContacts);  // ✅ Now sortedContacts exists!
  }, [sortedContacts, currentPage, itemsPerPage, getPaginatedData]);

  useEffect(() => {
    resetToFirstPage();
  }, [searchQuery]);

  



  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleLastInteractionFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLastInteractionFilter(e.target.value);
  };

  const handleEmploymentStatusFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setEmploymentStatusFilter(e.target.value);
  };

  const handleViewProfile = (contact: Contact) => {
    router.push(`/crm/contacts/${contact.id}`);
  };

  const handleDeleteContact = (contact: Contact) => {
    setSelectedContact(contact);
    setShowDeleteModal(true);
  };

  const confirmDeleteContact = async () => {
    if (!selectedContact) return;
    try {
      const response = await fetch(API_ENDPOINTS.contacts.delete(selectedContact.id), {
        method: "DELETE",
        credentials: "include",
      });

      if (response.ok) {
        setShowDeleteModal(false);
        setSelectedContact(null);
        fetchContacts();
      } else {
        // alert("Failed to delete contact");
        toast.error("Failed to delete contact");
      }
    } catch (error) {
      console.error("Delete contact error:", error);
      // alert("Failed to delete contact");
      toast.error("Failed to delete contact");
    }
  };

  const handleEditContact = (contact: Contact) => {
    setSelectedContact(contact);
    setEditForm({
      name: contact.name,
      phone: contact.phone,
      email: contact.email,
      designation: contact.designation,
      clientId: contact.clientId ? contact.clientId.toString() : '',
    });
    setShowEditModal(true);
  };

  const handleEditFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleUpdateContact = async () => {
    if (!selectedContact) return;

    try {
      const response = await fetch(API_ENDPOINTS.contacts.update(selectedContact.id), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          number: editForm.phone,
          email: editForm.email,
          designation: editForm.designation,
          client_id: parseInt(editForm.clientId),
        }),
        credentials: "include",
      });

      if (response.ok) {
        setShowEditModal(false);
        fetchContacts();
      } else {
        // alert("Failed to update contact");
        toast.error("Failed to update contact");
      }
    } catch (error) {
      console.error("Update contact error:", error);
      // alert("Failed to update contact");
      toast.error("Failed to update contact");
    }
  };


  const handleSort = (key: keyof Contact) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        if (prev.direction === 'asc') {
          return { key, direction: 'desc' };
        } else if (prev.direction === 'desc') {
          return { key: null, direction: null };
        }
      }
      return { key, direction: 'asc' };
    });
  };

  const getSortIcon = (key: keyof Contact) => {
    if (sortConfig.key !== key) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    }
    if (sortConfig.direction === 'asc') {
      return <ArrowUp className="h-4 w-4 text-blue-600" />;
    }
    return <ArrowDown className="h-4 w-4 text-blue-600" />;
  };

  const getSortLabel = (key: keyof Contact) => {
    if (sortConfig.key !== key) {
      return 'Click to sort';
    }
    
    if (key === 'lastInteraction') {
      return sortConfig.direction === 'asc' 
        ? 'Sorted: Earliest to Latest' 
        : 'Sorted: Latest to Earliest';
    }
    
    return sortConfig.direction === 'asc' 
      ? 'Sorted: A to Z' 
      : 'Sorted: Z to A';
  };


  // ============================================================================
  // MORE ACTIONS MENU CONFIGURATION
  // ============================================================================

  const getContactActions = (contact: Contact): MenuItem[] => [
    {
      icon: Pencil,
      label: 'Edit Contact',
      onClick: () => handleEditContact(contact),
    },
    {
      icon: Trash2,
      label: 'Remove Contact',
      onClick: () => handleDeleteContact(contact),
      danger: true,
    },
  ];


  // ============================================================================
  // RENDER
  // ============================================================================

  const EditableCell = ({
    contact,
    field,
    children,
  }: {
    contact: Contact;
    field: keyof Contact;
    children: React.ReactNode;
  }) => {
    const isEditing =
      editingCell?.contactId === contact.id && editingCell.field === field;

  const handleClientSelection = async (contactId: number, newClientId: string) => {
    try {
      // Update backend immediately
      const response = await fetch(API_ENDPOINTS.contacts.update(contactId), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          client_id: parseInt(newClientId),
        }),
      });

      if (!response.ok) throw new Error("Update failed");

      // Update UI instantly
      setContacts(prev =>
        prev.map(c =>
          c.id === contactId
            ? {
                ...c,
                clientId: parseInt(newClientId),
                clientName:
                  clients.find(cl => cl.id === parseInt(newClientId))?.companyName || "",
              }
            : c
        )
      );
    } catch (err) {
      // alert("Failed to update client");
      toast.error("Failed to update client");
    }

    // Close dropdown + stop editing mode
    setClientDropdownOpen(false);
    setEditingCell(null);
  };


    return (
      <td
        className="px-3 py-3 text-sm text-gray-800 cursor-pointer hover:bg-blue-50 relative"
        onDoubleClick={() => startEditing(contact.id, field, String(contact[field] || ""))}
      >
        {!isEditing ? (
          <div className="w-full h-full">
            {children}
          </div>
        ) : field === "clientName" ? (
          <div className="flex items-center gap-2 w-full relative">

            {/* SEARCHABLE CLIENT DROPDOWN */}
            <Popover open={clientDropdownOpen} onOpenChange={setClientDropdownOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between bg-white border border-gray-300"
                >
                  {clients.find(c => c.id.toString() === editingClientId)?.companyName || "Select client"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>

              <PopoverContent className="w-[300px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search clients..." />
                  <CommandList>
                    <CommandEmpty>No clients found.</CommandEmpty>

                    <CommandGroup>
                      {clients.map(client => (
                        <CommandItem
                          key={client.id}
                          value={`${client.companyName} ${client.industry || ""}`}
                          onSelect={() => handleClientSelection(contact.id, client.id.toString())}
                        >
                          <div className="flex flex-col">
                            <span>{client.companyName}</span>
                            {client.industry && (
                              <span className="text-gray-500 text-xs">{client.industry}</span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>


            {/* ✓ Save
            <button
              onClick={saveInlineEdit}
              className="text-green-600 font-bold text-lg"
            >
              ✓
            </button>

            <button
              onClick={cancelInlineEdit}
              className="text-red-600 font-bold text-lg"
            >
              ✗
            </button> */}

          </div>
        ) : (
          // YOUR EXISTING INPUT LOGIC FOR OTHER FIELDS
          <div className="flex items-center gap-2">
            <input
              className="border border-gray-300 rounded px-2 py-1 w-full text-sm"
              value={editingValue}
              autoFocus
              onChange={(e) => setEditingValue(e.target.value)}
            />
            <button
              onClick={saveInlineEdit}
              className="p-1 text-green-600 hover:bg-green-50 rounded"
              title="Save"
            >
              ✓
            </button>

            <button
              onClick={cancelInlineEdit}
              className="p-1 text-red-600 hover:bg-red-50 rounded"
              title="Cancel"
            >
              ✕
            </button>
          </div>
        )}

      </td>
    );
  };


  return (
    <>
      {/* FILTERS BAR */}
      <div className="px-6 py-4 flex items-center gap-4">
        {/* SEARCH INPUT */}
        <div className="flex-1 max-w-md relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search by Contact name or Client name"
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full pl-10 pr-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 bg-white border border-gray-300 rounded-md focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
            suppressHydrationWarning
          />
        </div>

        {/* LAST INTERACTION FILTER */}
        {/* <div className="flex items-center gap-2">
          <label htmlFor="last-interaction-filter" className="text-sm font-medium text-gray-600">
            Last Interaction:
          </label>
          <div className="relative">
            <select
              id="last-interaction-filter"
              value={lastInteractionFilter}
              onChange={handleLastInteractionFilterChange}
              className="appearance-none px-3 py-2 text-sm text-gray-800 bg-white border border-gray-300 rounded-md cursor-pointer focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
              suppressHydrationWarning
            >
              <option value="All">All</option>
              <option value="Today">Today</option>
              <option value="This Week">This Week</option>
              <option value="This Month">This Month</option>
            </select>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
              ▼
            </span>
          </div>
        </div> */}
      </div>

      {/* CONTACTS TABLE */}
      <div className="overflow-x-auto">
        <table className="w-full">
          {/* TABLE HEADER */}
          <thead className="bg-white border-t border-b border-gray-200">
            <tr>
              {/* Contact Name - Sortable */}
              <th 
                className="px-3 py-3 text-left text-sm font-medium text-gray-500 cursor-pointer hover:bg-gray-50 select-none" 
                scope="col"
                onClick={() => handleSort('name')}
                title={getSortLabel('name')}
              >
                <div className="flex items-center gap-2">
                  Contact Name
                  {getSortIcon('name')}
                </div>
              </th>

              {/* Client Name - Sortable */}
              <th 
                className="px-3 py-3 text-left text-sm font-medium text-gray-500 cursor-pointer hover:bg-gray-50 select-none" 
                scope="col"
                onClick={() => handleSort('clientName')}
                title={getSortLabel('clientName')}
              >
                <div className="flex items-center gap-2">
                  Client Name
                  {getSortIcon('clientName')}
                </div>
              </th>

              {/* Designation - Sortable */}
              <th 
                className="px-3 py-3 text-left text-sm font-medium text-gray-500 cursor-pointer hover:bg-gray-50 select-none" 
                scope="col"
                onClick={() => handleSort('designation')}
                title={getSortLabel('designation')}
              >
                <div className="flex items-center gap-2">
                  Designation
                  {getSortIcon('designation')}
                </div>
              </th>

              {/* Contact No. - Non-sortable */}
              {/* <th className="px-3 py-3 text-left text-sm font-medium text-gray-500" scope="col">
                Contact No.
              </th> */}

              {/* Email - Sortable */}
              {/* <th 
                className="px-3 py-3 text-left text-sm font-medium text-gray-500 cursor-pointer hover:bg-gray-50 select-none" 
                scope="col"
                onClick={() => handleSort('email')}
                title={getSortLabel('email')}
              >
                <div className="flex items-center gap-2">
                  Email
                  {getSortIcon('email')}
                </div>
              </th> */}

              {/* Referred By - Sortable */}
              <th 
                className="px-3 py-3 text-left text-sm font-medium text-gray-500 cursor-pointer hover:bg-gray-50 select-none" 
                scope="col"
                onClick={() => handleSort('createdBy')}
                title={getSortLabel('createdBy')}
              >
                <div className="flex items-center gap-2">
                  Referred By
                  {getSortIcon('createdBy')}
                </div>
              </th>

              {/* Last Interaction - Sortable */}
              <th 
                className="px-3 py-3 text-left text-sm font-medium text-gray-500 cursor-pointer hover:bg-gray-50 select-none" 
                scope="col"
                onClick={() => handleSort('lastInteraction')}
                title={getSortLabel('lastInteraction')}
              >
                <div className="flex items-center gap-2">
                  Last Interaction
                  {getSortIcon('lastInteraction')}
                </div>
              </th>

              {/* Actions - Non-sortable */}
              <th className="px-3 py-3 text-left text-sm font-medium text-gray-500" scope="col">
                Actions
              </th>
            </tr>
          </thead>

          {/* TABLE BODY */}
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="text-sm">Loading contacts...</p>
                  </div>
                </td>
              </tr>
            ) : filteredContacts.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <Search size={48} className="text-gray-300" />
                    <p className="text-lg font-medium">No contacts found</p>
                    <p className="text-sm">Try adjusting your search or filters</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedContacts.map((contact) => (
                <tr key={contact.id} className="transition-colors">
                  <EditableCell contact={contact} field="name">
                    {contact.name}
                  </EditableCell>

                  <EditableCell contact={contact} field="clientName">
                    {contact.clientName}
                  </EditableCell>

                  <EditableCell contact={contact} field="designation">
                    {contact.designation}
                  </EditableCell>

                  {/* <EditableCell contact={contact} field="phone">
                    {contact.phone}
                  </EditableCell>

                  <EditableCell contact={contact} field="email">
                    {contact.email}
                  </EditableCell> */}

                  <td className="px-3 py-3 whitespace-nowrap">
                    <ReferredBy
                      internalReference={contact.internalReference}
                      externalReferenceName={contact.externalReferenceName}
                      className="text-xs font-medium"
                    />
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-800 whitespace-nowrap">
                    {contact.lastInteraction}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewProfile(contact)}
                        className="text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors"
                        suppressHydrationWarning
                      >
                        <Eye className="w-6 h-6" />
                      </button>
                      <MoreActionsMenu items={getContactActions(contact)} label={`More actions for ${contact.name}`} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        
        {!isLoading  && filteredContacts.length > 0 && (
          <div className="px-6 py-4">
            <Pagination
              currentPage={currentPage}
              totalItems={sortedContacts.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={setItemsPerPage}
              itemsPerPageOptions={[10, 25, 50, 100]}
            />
          </div>
        )}


      </div>

      {/* DELETE MODAL */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="sm:max-w-[340px] rounded-xl p-6 flex flex-col items-center text-center">
          <DialogHeader className="p-0">
            <DialogTitle className="text-base font-semibold text-gray-900 text-center w-full">
              Are you sure?
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600 mt-1 text-center">
              Do you want to delete the contact{" "}
              <span className="font-medium text-gray-900">
                {selectedContact?.name}
              </span>
              ?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex justify-center gap-3 mt-5 w-full p-0">
            <Button
              variant="outline"
              onClick={() => setShowDeleteModal(false)}
              className="min-w-[120px] px-5 py-2.5 text-[15px] text-gray-700"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteContact}
              className="min-w-[150px] px-5 py-2.5 text-[15px] bg-red-600 hover:bg-red-700 text-white"
            >
              Remove contact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT MODAL */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-[480px] rounded-xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-gray-900 text-center">
              Edit Contact Detail
            </DialogTitle>
          </DialogHeader>

          {/* Basic Details */}
          <div className="mt-4 space-y-3">
            <p className="text-sm text-gray-500 font-medium">Basic Details</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  name="name"
                  value={editForm.name}
                  onChange={handleEditFormChange}
                  placeholder="Enter name"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Phone Number</label>
                <input
                  type="text"
                  name="phone"
                  value={editForm.phone}
                  onChange={handleEditFormChange}
                  placeholder="Enter phone number"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Job Title</label>
                <input
                  type="text"
                  name="designation"
                  value={editForm.designation}
                  onChange={handleEditFormChange}
                  placeholder="Enter job title"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  name="email"
                  value={editForm.email}
                  onChange={handleEditFormChange}
                  placeholder="Enter email"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
            </div>
          </div>

          {/* Client Details */}
          <div className="mt-5 space-y-3">
            <p className="text-sm text-gray-500 font-medium">Client Details</p>
            <div>
              <label className="text-sm font-medium text-gray-700">Client name (Organisation)</label>
              <Popover open={clientDropdownOpen} onOpenChange={setClientDropdownOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={clientDropdownOpen}
                    className="w-full justify-between bg-white border border-gray-300 rounded-md mt-1"
                  >
                    {editForm.clientId
                      ? clients.find(
                          (client) => client.id.toString() === editForm.clientId
                        )?.companyName
                      : "Select client..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput placeholder="Search client..." />
                    <CommandList>
                      <CommandEmpty>No client found.</CommandEmpty>
                      <CommandGroup>
                        {clients.map((client) => (
                          <CommandItem
                            key={client.id}
                            value={`${client.companyName} ${client.industry || ""}`}
                            onSelect={() => {
                              setEditForm({ ...editForm, clientId: client.id.toString() });
                              setClientDropdownOpen(false);
                            }}
                          >
                            <div className="flex flex-col">
                              <span>{client.companyName}</span>
                              {client.industry && (
                                <span className="text-gray-500 text-xs">
                                  {client.industry}
                                </span>
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
          </div>

          {/* Footer Buttons */}
          <DialogFooter className="flex justify-center gap-4 mt-8 w-full">
            <Button
              variant="outline"
              onClick={() => setShowEditModal(false)}
              className="min-w-[220px] py-3 text-[18px] border-2 border-blue-500 text-blue-600 hover:bg-blue-50 rounded-lg"
            >
              Cancel
            </Button>

            <Button
              onClick={handleUpdateContact}
              className="min-w-[200px] py-3 text-[16px] bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg"
            >
              Update Contact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}