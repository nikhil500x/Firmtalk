import * as XLSX from 'xlsx';
import prisma from '../prisma-client';

interface ParsedRow {
  groupName: string;
  clientName: string;
  clientIndustry?: string;
  clientWebsite?: string;
  clientAddress?: string;
  clientCode?: string;
  clientNotes?: string;
  tspContact?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactDesignation?: string;
  isPrimary: boolean;
  contactNotes?: string;
  linkedinUrl?: string;
  twitterHandle?: string;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface PreviewData {
  groups: Array<{
    name: string;
    description?: string;
    exists: boolean;
    existingId?: number;
  }>;
  clients: Array<{
    name: string;
    industry?: string;
    website?: string;
    address?: string;
    code?: string;
    notes?: string;
    tspContact?: string;
    tspContactUsers?: Array<{
      id: number;
      name: string;
      email: string;
    }>;
    groupName: string;
    exists: boolean;
    existingId?: number;
  }>;
  contacts: Array<{
    name: string;
    email?: string;
    phone?: string;
    designation?: string;
    isPrimary: boolean;
    notes?: string;
    linkedinUrl?: string;
    twitterHandle?: string;
    clientName: string;
    groupName: string;
    rowNumber: number;
  }>;
  errors: ValidationError[];
  warnings: Array<{
    row: number;
    message: string;
  }>;
}

interface UploadResult {
  groupsCreated: number;
  groupsExisting: number;
  clientsCreated: number;
  clientsExisting: number;
  contactsCreated: number;
  errors: Array<{ row: number; message: string }>;
  warnings: Array<{ row: number; message: string }>;
  createdGroups: Array<{ id: number; name: string }>;
  createdClients: Array<{ id: number; name: string; groupName: string }>;
  createdContacts: Array<{ id: number; name: string; email: string; clientName: string }>;
}

export class BulkUploadService {
  /**
   * Parse Excel file and extract data
   */
  static parseExcelFile(buffer: Buffer): ParsedRow[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON with header row
    const rows = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1,
      defval: null,
      blankrows: false
    }) as any[][];

    if (rows.length < 2) {
      throw new Error('Excel file must have at least a header row and one data row');
    }

    // Limit row count to prevent memory issues (max 10,000 data rows)
    const MAX_ROWS = 10000;
    if (rows.length > MAX_ROWS + 1) { // +1 for header
      throw new Error(`Excel file exceeds maximum row limit of ${MAX_ROWS}. Please split into smaller files.`);
    }

    // Get header row (first row)
    const headers = rows[0].map((h: any) => String(h || '').trim().toLowerCase());
    
    // Find column indices
    const colIndices = {
      groupName: this.findColumnIndex(headers, ['group name', 'group', 'groupname']),
      clientName: this.findColumnIndex(headers, ['client name', 'client', 'clientname', 'company name', 'company']),
      clientIndustry: this.findColumnIndex(headers, ['industry', 'client industry']),
      clientWebsite: this.findColumnIndex(headers, ['website', 'client website', 'url', 'website url']),
      clientAddress: this.findColumnIndex(headers, ['address', 'client address']),
      clientCode: this.findColumnIndex(headers, ['client code', 'code', 'clientcode']),
      clientNotes: this.findColumnIndex(headers, ['client notes', 'notes']),
      tspContact: this.findColumnIndex(headers, ['tsp contact', 'tspcontact', 'partner id', 'partner ids', 'tsp']),
      contactName: this.findColumnIndex(headers, ['contact name', 'contact', 'name', 'contactname']),
      contactEmail: this.findColumnIndex(headers, ['email', 'contact email', 'e-mail']),
      contactPhone: this.findColumnIndex(headers, ['phone', 'contact phone', 'number', 'phone number', 'mobile']),
      contactDesignation: this.findColumnIndex(headers, ['designation', 'title', 'job title', 'position']),
      isPrimary: this.findColumnIndex(headers, ['is primary', 'primary', 'isprimary', 'primary contact']),
      contactNotes: this.findColumnIndex(headers, ['contact notes']),
      linkedinUrl: this.findColumnIndex(headers, ['linkedin', 'linkedin url', 'linkedinurl']),
      twitterHandle: this.findColumnIndex(headers, ['twitter', 'twitter handle', 'twitterhandle']),
    };

    // Validate required columns (only Group Name and Client Name are required)
    if (colIndices.groupName === -1 || colIndices.clientName === -1) {
      throw new Error('Missing required columns: Group Name, Client Name');
    }

    // Parse data rows (skip header)
    const parsedRows: ParsedRow[] = [];
    let currentGroup = '';
    let currentClient = '';
    let currentTSPContact = '';

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      // Handle merged cells - if cell is empty, use previous value
      const groupName = this.getCellValue(row, colIndices.groupName) || currentGroup;
      const clientName = this.getCellValue(row, colIndices.clientName) || currentClient;
      const tspContact = this.getCellValue(row, colIndices.tspContact) || currentTSPContact;

      if (groupName) currentGroup = groupName;
      if (clientName) currentClient = clientName;
      if (tspContact) currentTSPContact = tspContact;

      if (!groupName || !clientName) {
        continue; // Skip rows without group or client
      }

      // Get contact field values (may be empty for client-only rows)
      const contactNameRaw = this.getCellValue(row, colIndices.contactName);
      const contactEmailRaw = this.getCellValue(row, colIndices.contactEmail);
      const contactPhoneRaw = this.getCellValue(row, colIndices.contactPhone);
      const contactDesignationRaw = this.getCellValue(row, colIndices.contactDesignation);
      const isPrimaryStr = this.getCellValue(row, colIndices.isPrimary);

      // Prepare client data (same for all contacts in this row)
      const clientData = {
        groupName: this.normalizeString(groupName, 255),
        clientName: this.normalizeString(clientName, 255),
        clientIndustry: this.normalizeString(this.getCellValue(row, colIndices.clientIndustry), 255),
        clientWebsite: this.normalizeString(this.getCellValue(row, colIndices.clientWebsite), 500),
        clientAddress: this.normalizeString(this.getCellValue(row, colIndices.clientAddress), 1000),
        clientCode: this.normalizeString(this.getCellValue(row, colIndices.clientCode), 50),
        clientNotes: this.normalizeString(this.getCellValue(row, colIndices.clientNotes)),
        tspContact: tspContact || undefined,
        contactNotes: this.normalizeString(this.getCellValue(row, colIndices.contactNotes)),
        linkedinUrl: this.normalizeString(this.getCellValue(row, colIndices.linkedinUrl), 500),
        twitterHandle: this.normalizeString(this.getCellValue(row, colIndices.twitterHandle), 100),
      };

      // Check if we have any contact data
      const hasContactData = !!(contactNameRaw || contactEmailRaw || contactPhoneRaw);

      if (!hasContactData) {
        // Client-only row: create one ParsedRow with empty contact fields
        parsedRows.push({
          ...clientData,
          contactName: undefined,
          contactEmail: undefined,
          contactPhone: undefined,
          contactDesignation: undefined,
          isPrimary: false,
        });
      } else {
        // Split contact fields by comma/newline
        const contactNames = this.splitContactFields(contactNameRaw);
        const contactEmails = this.splitContactFields(contactEmailRaw);
        const contactPhones = this.splitContactFields(contactPhoneRaw);
        const contactDesignations = this.splitContactFields(contactDesignationRaw);

        // Determine maximum count across all contact fields
        const maxCount = Math.max(
          contactNames.length,
          contactEmails.length,
          contactPhones.length,
          contactDesignations.length,
          1 // At least 1 contact if any field has data
        );

        // Create multiple ParsedRow objects (one per contact)
        for (let contactIndex = 0; contactIndex < maxCount; contactIndex++) {
          const contactName = contactNames[contactIndex] ? this.normalizeString(contactNames[contactIndex], 255) : undefined;
          const contactEmail = contactEmails[contactIndex] ? contactEmails[contactIndex].trim().toLowerCase() : undefined;
          const contactPhone = contactPhones[contactIndex] ? String(contactPhones[contactIndex]).trim() : undefined;
          const contactDesignation = contactDesignations[contactIndex] ? this.normalizeString(contactDesignations[contactIndex], 255) : undefined;

          // Only first contact gets isPrimary = true (if marked as primary)
          const isPrimary = contactIndex === 0 && isPrimaryStr && ['y', 'yes', 'true', '1'].includes(String(isPrimaryStr).toLowerCase().trim());

          parsedRows.push({
            ...clientData,
            contactName,
            contactEmail,
            contactPhone,
            contactDesignation,
            isPrimary,
          });
        }
      }
    }

    return parsedRows;
  }

  /**
   * Find column index by header name variations
   */
  private static findColumnIndex(headers: string[], variations: string[]): number {
    for (const variation of variations) {
      const index = headers.findIndex(h => h.includes(variation));
      if (index !== -1) return index;
    }
    return -1;
  }

  /**
   * Get cell value safely
   */
  private static getCellValue(row: any[], index: number): string | undefined {
    if (index === -1 || !row[index]) return undefined;
    const value = row[index];
    if (value === null || value === undefined) return undefined;
    const trimmed = String(value).trim();
    return trimmed || undefined;
  }

  /**
   * Validate and normalize string field
   */
  private static normalizeString(value: string | undefined, maxLength?: number): string | undefined {
    if (!value) return undefined;
    let normalized = value.trim().replace(/\s+/g, ' '); // Replace multiple spaces with single space
    if (maxLength && normalized.length > maxLength) {
      normalized = normalized.substring(0, maxLength);
    }
    return normalized || undefined;
  }

  /**
   * Validate email format
   */
  private static isValidEmail(email: string): boolean {
    // More robust email validation
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return emailRegex.test(email) && email.length <= 255; // Database VARCHAR limit
  }

  /**
   * Validate URL format
   */
  private static isValidUrl(url: string): boolean {
    if (!url) return false;
    try {
      // Add protocol if missing
      let urlToCheck = url;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        urlToCheck = `https://${url}`;
      }
      new URL(urlToCheck);
      return url.length <= 500; // Reasonable URL length limit
    } catch {
      return false;
    }
  }

  /**
   * Validate phone number format
   */
  private static isValidPhone(phone: string): boolean {
    if (!phone) return false;
    // Allow digits, +, -, spaces, parentheses, and common separators
    const phoneRegex = /^[\d\s\+\-\(\)\.]+$/;
    const cleaned = phone.replace(/\s/g, '');
    return phoneRegex.test(phone) && cleaned.length >= 7 && cleaned.length <= 20;
  }

  /**
   * Parse TSP Contact string (e.g., "18" or "18/20") into array of user IDs
   */
  private static parseTSPContact(tspContact: string): number[] {
    if (!tspContact || typeof tspContact !== 'string') return [];
    return tspContact
      .split('/')
      .map(id => parseInt(id.trim()))
      .filter(id => !isNaN(id) && id > 0);
  }

  /**
   * Split contact field values by comma and newline, returning array of trimmed values
   * Handles \r\n, \n, \r line breaks
   * Keeps empty strings to maintain alignment (they become undefined when used)
   */
  private static splitContactFields(value: string | undefined): string[] {
    if (!value) return [];
    // Split by commas, newlines, and forward slashes (handle all line break variants)
    // Filter out empty parts after trimming
    const parts = value
      .split(/\r\n|\n|\r|,|\//) // Split by newlines, commas, and forward slashes
      .map(part => part.trim()) // Trim whitespace
      .filter(part => part.length > 0); // Remove empty parts
    
    return parts;
  }

  /**
   * Validate and create preview data
   */
  static async createPreview(parsedRows: ParsedRow[], userId: number): Promise<PreviewData> {
    const errors: ValidationError[] = [];
    const warnings: Array<{ row: number; message: string }> = [];
    const groupsMap = new Map<string, { name: string; description?: string; exists: boolean; existingId?: number }>();
    const clientsMap = new Map<string, { 
      name: string; 
      industry?: string; 
      website?: string; 
      address?: string; 
      code?: string; 
      notes?: string; 
      tspContact?: string;
      tspContactUsers?: Array<{
        id: number;
        name: string;
        email: string;
      }>;
      groupName: string; 
      exists: boolean; 
      existingId?: number;
    }>();
    const contacts: PreviewData['contacts'] = [];

    // Validate and collect unique groups
    for (let i = 0; i < parsedRows.length; i++) {
      const row = parsedRows[i];
      const rowNum = i + 2; // +2 because Excel rows start at 1 and we skip header

      // Validate group
      if (!row.groupName || !row.groupName.trim()) {
        errors.push({ row: rowNum, field: 'Group Name', message: 'Group name is required' });
        continue;
      }

      // Validate client
      if (!row.clientName || !row.clientName.trim()) {
        errors.push({ row: rowNum, field: 'Client Name', message: 'Client name is required' });
        continue;
      }

      if (!row.clientIndustry || !row.clientIndustry.trim()) {
        errors.push({ row: rowNum, field: 'Client Industry', message: 'Client industry is required' });
      }

      // Validate contact fields only if contact data is present
      // Only contact name is required; email and phone are optional
      const rowHasContactData = !!(row.contactName || row.contactEmail || row.contactPhone);
      if (rowHasContactData) {
        // Contact name is required if contact data is present
        if (!row.contactName || !row.contactName.trim()) {
          errors.push({ row: rowNum, field: 'Contact Name', message: 'Contact name is required when contact data is present' });
        }
        // Email is optional, but validate format if provided
        if (row.contactEmail && row.contactEmail.trim()) {
          if (!this.isValidEmail(row.contactEmail)) {
            errors.push({ row: rowNum, field: 'Contact Email', message: 'Invalid email format' });
          }
        }
        // Phone is optional, but validate format if provided
        if (row.contactPhone && row.contactPhone.trim()) {
          if (!this.isValidPhone(row.contactPhone)) {
            errors.push({ row: rowNum, field: 'Contact Phone', message: 'Invalid phone number format' });
          }
        }
      }

      // Validate URLs if provided
      if (row.clientWebsite && !this.isValidUrl(row.clientWebsite)) {
        errors.push({ row: rowNum, field: 'Client Website', message: 'Invalid website URL format' });
      }
      if (row.linkedinUrl && !this.isValidUrl(row.linkedinUrl)) {
        errors.push({ row: rowNum, field: 'LinkedIn URL', message: 'Invalid LinkedIn URL format' });
      }

      // Validate field lengths (database constraints)
      if (row.clientName && row.clientName.length > 255) {
        errors.push({ row: rowNum, field: 'Client Name', message: 'Client name exceeds maximum length of 255 characters' });
      }
      if (row.contactName && row.contactName.length > 255) {
        errors.push({ row: rowNum, field: 'Contact Name', message: 'Contact name exceeds maximum length of 255 characters' });
      }
      if (row.contactEmail && row.contactEmail.length > 255) {
        errors.push({ row: rowNum, field: 'Contact Email', message: 'Email exceeds maximum length of 255 characters' });
      }

      // Collect groups (will check existence later)
      if (!groupsMap.has(row.groupName)) {
        groupsMap.set(row.groupName, {
          name: row.groupName,
          exists: false,
          existingId: undefined
        });
      }

      // Collect clients (key: groupName + clientName) with merging logic
      const clientKey = `${row.groupName}|||${row.clientName}`;
      if (!clientsMap.has(clientKey)) {
        clientsMap.set(clientKey, {
          name: row.clientName,
          industry: row.clientIndustry,
          website: row.clientWebsite,
          address: row.clientAddress,
          code: row.clientCode,
          notes: row.clientNotes,
          tspContact: row.tspContact,
          groupName: row.groupName,
          exists: false,
          existingId: undefined
        });
      } else {
        // Merge client data: prefer non-empty over empty, but don't overwrite existing non-empty
        const existingClient = clientsMap.get(clientKey)!;
        
        // Merge industry (prefer non-empty, use first if both non-empty)
        if (!existingClient.industry && row.clientIndustry) {
          existingClient.industry = row.clientIndustry;
        } else if (existingClient.industry && row.clientIndustry && existingClient.industry !== row.clientIndustry) {
          warnings.push({
            row: rowNum,
            message: `Client "${row.clientName}" has conflicting industry values. Using first occurrence: "${existingClient.industry}"`
          });
        }
        
        // Merge website
        if (!existingClient.website && row.clientWebsite) {
          existingClient.website = row.clientWebsite;
        } else if (existingClient.website && row.clientWebsite && existingClient.website !== row.clientWebsite) {
          warnings.push({
            row: rowNum,
            message: `Client "${row.clientName}" has conflicting website values. Using first occurrence: "${existingClient.website}"`
          });
        }
        
        // Merge address
        if (!existingClient.address && row.clientAddress) {
          existingClient.address = row.clientAddress;
        } else if (existingClient.address && row.clientAddress && existingClient.address !== row.clientAddress) {
          warnings.push({
            row: rowNum,
            message: `Client "${row.clientName}" has conflicting address values. Using first occurrence.`
          });
        }
        
        // Merge notes (concatenate if both exist)
        if (row.clientNotes) {
          if (existingClient.notes) {
            existingClient.notes = `${existingClient.notes} | ${row.clientNotes}`;
          } else {
            existingClient.notes = row.clientNotes;
          }
        }
        
        // Merge TSP Contact (use first, show warning if different)
        if (!existingClient.tspContact && row.tspContact) {
          existingClient.tspContact = row.tspContact;
        } else if (existingClient.tspContact && row.tspContact && existingClient.tspContact !== row.tspContact) {
          warnings.push({
            row: rowNum,
            message: `Client "${row.clientName}" has conflicting TSP Contact values. Using first occurrence: "${existingClient.tspContact}"`
          });
        }
        
        // Client code: show error if different (unique constraint)
        if (existingClient.code && row.clientCode && existingClient.code !== row.clientCode) {
          errors.push({
            row: rowNum,
            field: 'Client Code',
            message: `Client "${row.clientName}" has conflicting client code values. Code "${existingClient.code}" was used first, but "${row.clientCode}" was found. Client code must be unique.`
          });
        } else if (!existingClient.code && row.clientCode) {
          existingClient.code = row.clientCode;
        }
      }

      // Collect contacts (skip if all contact fields are empty - client-only rows)
      const hasContactData = !!(row.contactName || row.contactEmail || row.contactPhone);
      if (hasContactData) {
        contacts.push({
          name: row.contactName || '',
          email: row.contactEmail || '',
          phone: row.contactPhone || '',
          designation: row.contactDesignation,
          isPrimary: row.isPrimary,
          notes: row.contactNotes,
          linkedinUrl: row.linkedinUrl,
          twitterHandle: row.twitterHandle,
          clientName: row.clientName,
          groupName: row.groupName,
          rowNumber: rowNum
        });
      }
    }

    // Check existing groups in batch
    const uniqueGroupNames = Array.from(groupsMap.keys());
    const existingGroups = await prisma.client_groups.findMany({
      where: {
        name: { in: uniqueGroupNames }
      }
    });

    // Create a case-insensitive map
    const groupNameMap = new Map<string, string>();
    uniqueGroupNames.forEach(gn => {
      groupNameMap.set(gn.toLowerCase(), gn);
    });

    for (const group of existingGroups) {
      const normalizedName = group.name.toLowerCase();
      const originalName = groupNameMap.get(normalizedName);
      if (originalName) {
        const groupData = groupsMap.get(originalName);
        if (groupData) {
          groupData.exists = true;
          groupData.existingId = group.group_id;
        }
      }
    }

    // Batch validate TSP Contacts - collect all unique user IDs first
    const allTspContactIds = new Set<number>();
    const clientTspContactMap = new Map<string, number[]>();
    
    for (const [clientKey, client] of clientsMap.entries()) {
      if (client.tspContact) {
        const tspContactIds = this.parseTSPContact(client.tspContact);
        if (tspContactIds.length > 0) {
          tspContactIds.forEach(id => allTspContactIds.add(id));
          clientTspContactMap.set(clientKey, tspContactIds);
        } else {
          // Invalid format - will be handled below
          clientTspContactMap.set(clientKey, []);
        }
      }
    }

    // Fetch all users in a single query
    const allExistingUsers = allTspContactIds.size > 0 
      ? await prisma.users.findMany({
          where: { user_id: { in: Array.from(allTspContactIds) } },
          select: { 
            user_id: true,
            name: true,
            email: true
          }
        })
      : [];
    
    const existingUserIds = new Set(allExistingUsers.map(u => u.user_id));
    const userMap = new Map(allExistingUsers.map(u => [u.user_id, u]));

    // Batch collect client codes for validation
    const clientCodes = new Set<string>();
    for (const client of clientsMap.values()) {
      if (client.code) {
        clientCodes.add(client.code);
      }
    }

    // Batch check client codes in a single query
    const existingCodes = clientCodes.size > 0
      ? await prisma.clients.findMany({
          where: { client_code: { in: Array.from(clientCodes) } },
          select: { client_code: true, client_id: true }
        })
      : [];
    const existingCodeMap = new Map(existingCodes.map(c => [c.client_code!, c.client_id]));

    // Check existing clients sequentially (to avoid connection pool issues)
    const uniqueClientKeys = Array.from(clientsMap.keys());
    for (const clientKey of uniqueClientKeys) {
      const client = clientsMap.get(clientKey)!;
      const group = groupsMap.get(client.groupName);
      const groupId = group?.existingId || null;
      
      // Validate TSP Contact if provided
      const tspContactIds = clientTspContactMap.get(clientKey);
      if (tspContactIds !== undefined) {
        if (tspContactIds.length === 0) {
          // Invalid format
          const contactRow = contacts.find(c => 
            c.groupName === client.groupName && c.clientName === client.name
          );
          if (contactRow) {
            errors.push({ 
              row: contactRow.rowNumber, 
              field: 'TSP Contact', 
              message: 'Invalid TSP Contact format. Expected partner IDs separated by "/" (e.g., "18" or "18/20")' 
            });
          }
        } else {
          // Validate all partner IDs exist
          const invalidIds = tspContactIds.filter(id => !existingUserIds.has(id));
          if (invalidIds.length > 0) {
            const contactRow = contacts.find(c => 
              c.groupName === client.groupName && c.clientName === client.name
            );
            if (contactRow) {
              errors.push({ 
                row: contactRow.rowNumber, 
                field: 'TSP Contact', 
                message: `Invalid partner ID(s): ${invalidIds.join(', ')}. These user IDs do not exist.` 
              });
            }
          } else {
            // Store user information for display in preview
            client.tspContactUsers = tspContactIds
              .map(id => userMap.get(id))
              .filter((u): u is typeof allExistingUsers[0] => u !== undefined)
              .map(u => ({
                id: u.user_id,
                name: u.name,
                email: u.email
              }));
          }
        }
      }
      
      // Check if client exists (sequential to avoid connection pool issues)
      const existingClient = await prisma.clients.findFirst({
        where: {
          client_name: { equals: client.name, mode: 'insensitive' },
          ...(groupId ? { group_id: groupId } : {})
        },
        include: { group: true }
      });

      // Check for duplicate client code if provided
      if (client.code) {
        const existingCodeClientId = existingCodeMap.get(client.code);
        if (existingCodeClientId && (!existingClient || existingClient.client_id !== existingCodeClientId)) {
          const contactRow = contacts.find(c => 
            c.groupName === client.groupName && c.clientName === client.name
          );
          if (contactRow) {
            errors.push({ 
              row: contactRow.rowNumber, 
              field: 'Client Code', 
              message: `Client code "${client.code}" already exists for another client` 
            });
          }
        }
      }

      if (existingClient) {
        client.exists = true;
        client.existingId = existingClient.client_id;
      }
    }

    // Check for duplicate contacts (only check by email if email is provided)
    const contactsByClient = new Map<number, Set<string>>();
    for (const contact of contacts) {
      const client = clientsMap.get(`${contact.groupName}|||${contact.clientName}`);
      if (client?.existingId && contact.email) {
        if (!contactsByClient.has(client.existingId)) {
          contactsByClient.set(client.existingId, new Set());
        }
        const clientContacts = contactsByClient.get(client.existingId)!;
        
        if (clientContacts.has(contact.email)) {
          warnings.push({
            row: contact.rowNumber,
            message: `Contact with email "${contact.email}" already exists for this client - will be skipped`
          });
        } else {
          clientContacts.add(contact.email);
        }
      }
    }

    // Check for primary contacts (only for clients that have contacts)
    const clientsWithContacts = new Set<string>();
    for (const contact of contacts) {
      const clientKey = `${contact.groupName}|||${contact.clientName}`;
      clientsWithContacts.add(clientKey);
    }
    
    const clientsWithoutPrimary = new Set<string>();
    for (const contact of contacts) {
      const clientKey = `${contact.groupName}|||${contact.clientName}`;
      if (!contact.isPrimary) {
        clientsWithoutPrimary.add(clientKey);
      }
    }

    for (const contact of contacts) {
      const clientKey = `${contact.groupName}|||${contact.clientName}`;
      if (contact.isPrimary) {
        clientsWithoutPrimary.delete(clientKey);
      }
    }

    // Only warn for clients that have contacts but no primary
    for (const clientKey of clientsWithoutPrimary) {
      if (clientsWithContacts.has(clientKey)) {
        const [groupName, clientName] = clientKey.split('|||');
        warnings.push({
          row: 0,
          message: `Client "${clientName}" in group "${groupName}" has no primary contact - first contact will be set as primary`
        });
      }
    }

    return {
      groups: Array.from(groupsMap.values()),
      clients: Array.from(clientsMap.values()),
      contacts,
      errors,
      warnings
    };
  }

  /**
   * Process bulk upload and create records
   */
  static async processBulkUpload(previewData: PreviewData, userId: number): Promise<UploadResult> {
    const result: UploadResult = {
      groupsCreated: 0,
      groupsExisting: 0,
      clientsCreated: 0,
      clientsExisting: 0,
      contactsCreated: 0,
      errors: [],
      warnings: [...previewData.warnings],
      createdGroups: [],
      createdClients: [],
      createdContacts: []
    };

    // Map to track created groups and clients
    const groupIdMap = new Map<string, number>();
    const clientIdMap = new Map<string, number>();

    // Pre-validate all TSP Contact IDs before transaction to avoid transaction timeout
    const allTspContactIds = new Set<number>();
    for (const client of previewData.clients) {
      if (client.tspContact) {
        const tspContactIds = this.parseTSPContact(client.tspContact);
        tspContactIds.forEach(id => allTspContactIds.add(id));
      }
    }

    // Validate all TSP Contact IDs exist (batch query outside transaction)
    let validTspContactIds: Set<number> = new Set();
    if (allTspContactIds.size > 0) {
      try {
        const existingUsers = await prisma.users.findMany({
          where: { user_id: { in: Array.from(allTspContactIds) } },
          select: { user_id: true }
        });
        validTspContactIds = new Set(existingUsers.map(u => u.user_id));
        
        // Check for invalid IDs
        const invalidIds = Array.from(allTspContactIds).filter(id => !validTspContactIds.has(id));
        if (invalidIds.length > 0) {
          result.errors.push({
            row: 0,
            message: `Invalid TSP Contact partner ID(s): ${invalidIds.join(', ')}`
          });
        }
      } catch (error: any) {
        result.errors.push({
          row: 0,
          message: `Failed to validate TSP Contact IDs: ${error.message}`
        });
      }
    }

    // Process in batches to avoid transaction timeout
    const BATCH_SIZE = 50; // Process 50 records at a time
    
    // Step 1: Create or get groups in batches
    try {
      const groupsToCreate = previewData.groups.filter(g => !g.exists || !g.existingId);
      const existingGroups = previewData.groups.filter(g => g.exists && g.existingId);
      
      // Add existing groups to map
      for (const group of existingGroups) {
        if (group.existingId) {
          groupIdMap.set(group.name, group.existingId);
          result.groupsExisting++;
        }
      }
      
      // Create new groups in batches
      for (let i = 0; i < groupsToCreate.length; i += BATCH_SIZE) {
        const batch = groupsToCreate.slice(i, i + BATCH_SIZE);
        await prisma.$transaction(async (tx) => {
          for (const group of batch) {
            const newGroup = await tx.client_groups.create({
              data: {
                name: group.name,
                description: group.description || null,
                active_status: true,
                created_by: userId
              }
            });
            groupIdMap.set(group.name, newGroup.group_id);
            result.groupsCreated++;
            result.createdGroups.push({ id: newGroup.group_id, name: newGroup.name });
          }
        }, {
          timeout: 30000, // 30 seconds per batch
          isolationLevel: 'ReadCommitted'
        });
      }
    } catch (error: any) {
      result.errors.push({
        row: 0,
        message: `Failed to create groups: ${error.message}`
      });
    }

    // Step 2: Create or get clients in batches
    try {
      const clientsToCreate = previewData.clients.filter(c => !c.exists || !c.existingId);
      const existingClients = previewData.clients.filter(c => c.exists && c.existingId);
      
      // Add existing clients to map
      for (const client of existingClients) {
        if (client.existingId) {
          clientIdMap.set(`${client.groupName}|||${client.name}`, client.existingId);
          result.clientsExisting++;
        }
      }
      
      // Create new clients in batches
      for (let i = 0; i < clientsToCreate.length; i += BATCH_SIZE) {
        const batch = clientsToCreate.slice(i, i + BATCH_SIZE);
        await prisma.$transaction(async (tx) => {
          for (const client of batch) {
            const groupId = groupIdMap.get(client.groupName);
            if (!groupId) {
              result.errors.push({
                row: 0,
                message: `Group "${client.groupName}" not found for client "${client.name}"`
              });
              continue;
            }

            // Check if client code is unique if provided
            if (client.code) {
              const codeExists = await tx.clients.findFirst({
                where: { client_code: client.code }
              });
              if (codeExists) {
                result.errors.push({
                  row: 0,
                  message: `Client code "${client.code}" already exists - client "${client.name}" skipped`
                });
                continue;
              }
            }

            // Handle TSP Contact
            let internalReferenceId: number | null = null;
            let notes = client.notes || null;
            
            if (client.tspContact) {
              const tspContactIds = this.parseTSPContact(client.tspContact);
              if (tspContactIds.length > 0) {
                // Validate all partner IDs exist (already validated outside transaction)
                const invalidIds = tspContactIds.filter(id => !validTspContactIds.has(id));
                
                if (invalidIds.length > 0) {
                  result.errors.push({
                    row: 0,
                    message: `Invalid TSP Contact partner ID(s) for client "${client.name}": ${invalidIds.join(', ')}`
                  });
                  continue;
                }
                
                // Use first partner ID as internal_reference_id
                internalReferenceId = tspContactIds[0];
                
                // If multiple partners, add to notes
                if (tspContactIds.length > 1) {
                  const tspNote = `TSP Contacts: ${tspContactIds.join(', ')}`;
                  notes = notes ? `${notes} | ${tspNote}` : tspNote;
                }
              }
            }

            const newClient = await tx.clients.create({
              data: {
                user_id: userId,
                client_name: client.name,
                industry: client.industry || null,
                website_url: client.website || null,
                address: client.address || null,
                group_id: groupId,
                client_code: client.code || null,
                notes: notes,
                internal_reference_id: internalReferenceId,
                active_status: true
              }
            });
            clientIdMap.set(`${client.groupName}|||${client.name}`, newClient.client_id);
            result.clientsCreated++;
            result.createdClients.push({ 
              id: newClient.client_id, 
              name: newClient.client_name, 
              groupName: client.groupName 
            });
          }
        }, {
          timeout: 30000, // 30 seconds per batch
          isolationLevel: 'ReadCommitted'
        });
      }
    } catch (error: any) {
      result.errors.push({
        row: 0,
        message: `Failed to create clients: ${error.message}`
      });
    }

    // Step 3: Create contacts in batches
    try {
      // Group contacts by client to ensure at least one primary
      const contactsByClient = new Map<string, typeof previewData.contacts>();
      for (const contact of previewData.contacts) {
        const clientKey = `${contact.groupName}|||${contact.clientName}`;
        if (!contactsByClient.has(clientKey)) {
          contactsByClient.set(clientKey, []);
        }
        contactsByClient.get(clientKey)!.push(contact);
      }

      // Process contacts in batches
      const clientKeys = Array.from(contactsByClient.keys());
      for (let i = 0; i < clientKeys.length; i += BATCH_SIZE) {
        const batchKeys = clientKeys.slice(i, i + BATCH_SIZE);
        await prisma.$transaction(async (tx) => {
          for (const clientKey of batchKeys) {
            const contacts = contactsByClient.get(clientKey);
            if (!contacts || contacts.length === 0) continue;
            
            const clientId = clientIdMap.get(clientKey);
            if (!clientId) {
              result.errors.push({
                row: contacts[0].rowNumber,
                message: `Client not found for contact "${contacts[0].name}"`
              });
              continue;
            }

            // Ensure at least one primary contact, but only ONE primary
            const primaryContacts = contacts.filter(c => c.isPrimary);
            let hasPrimary = primaryContacts.length > 0;
            let isFirst = true;
            let primarySet = false;

            for (const contact of contacts) {
              // Check for duplicate email
              const existingContact = await tx.contacts.findFirst({
                where: {
                  client_id: clientId,
                  email: contact.email
                }
              });

              if (existingContact) {
                result.warnings.push({
                  row: contact.rowNumber,
                  message: `Contact with email "${contact.email}" already exists - skipped`
                });
                continue;
              }

              // Set first contact as primary if none marked
              let isPrimary = false;
              if (!hasPrimary && isFirst) {
                isPrimary = true;
                hasPrimary = true;
                primarySet = true;
              } else if (contact.isPrimary && !primarySet) {
                isPrimary = true;
                primarySet = true;
              } else if (contact.isPrimary && primarySet) {
                result.warnings.push({
                  row: contact.rowNumber,
                  message: `Multiple contacts marked as primary for client "${contact.clientName}". Only the first one will be set as primary.`
                });
              }
              isFirst = false;

              try {
                const newContact = await tx.contacts.create({
                  data: {
                    client_id: clientId,
                    name: contact.name,
                    email: contact.email,
                    number: contact.phone,
                    designation: contact.designation || null,
                    is_primary: isPrimary,
                    notes: contact.notes || null,
                    linkedin_url: contact.linkedinUrl || null,
                    twitter_handle: contact.twitterHandle || null,
                    created_by: userId
                  }
                });
                result.contactsCreated++;
                result.createdContacts.push({
                  id: newContact.contact_id,
                  name: newContact.name,
                  email: newContact.email,
                  clientName: contact.clientName
                });
              } catch (error: any) {
                result.errors.push({
                  row: contact.rowNumber,
                  message: `Failed to create contact "${contact.name}": ${error.message}`
                });
              }
            }
          }
        }, {
          timeout: 30000, // 30 seconds per batch
          isolationLevel: 'ReadCommitted'
        });
      }
    } catch (error: any) {
      result.errors.push({
        row: 0,
        message: `Failed to create contacts: ${error.message}`
      });
    }

    return result;
  }

  /**
   * Generate Excel file with bulk upload results
   */
  static generateResultsFile(result: UploadResult): Buffer {
    const workbook = XLSX.utils.book_new();
    
    // Sheet 1: Summary
    const summaryHeaders = ['Metric', 'Count'];
    const summaryData = [
      ['Groups Created', result.groupsCreated],
      ['Groups Existing', result.groupsExisting],
      ['Clients Created', result.clientsCreated],
      ['Clients Existing', result.clientsExisting],
      ['Contacts Created', result.contactsCreated],
      ['Total Errors', result.errors.length],
      ['Total Warnings', result.warnings.length],
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryData]);
    summarySheet['!cols'] = [{ wch: 25 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
    
    // Sheet 2: Created Groups
    if (result.createdGroups.length > 0) {
      const groupsHeaders = ['ID', 'Group Name'];
      const groupsData = result.createdGroups.map(g => [g.id, g.name]);
      const groupsSheet = XLSX.utils.aoa_to_sheet([groupsHeaders, ...groupsData]);
      groupsSheet['!cols'] = [{ wch: 10 }, { wch: 40 }];
      XLSX.utils.book_append_sheet(workbook, groupsSheet, 'Created Groups');
    }
    
    // Sheet 3: Created Clients
    if (result.createdClients.length > 0) {
      const clientsHeaders = ['ID', 'Client Name', 'Group Name'];
      const clientsData = result.createdClients.map(c => [c.id, c.name, c.groupName]);
      const clientsSheet = XLSX.utils.aoa_to_sheet([clientsHeaders, ...clientsData]);
      clientsSheet['!cols'] = [{ wch: 10 }, { wch: 40 }, { wch: 40 }];
      XLSX.utils.book_append_sheet(workbook, clientsSheet, 'Created Clients');
    }
    
    // Sheet 4: Created Contacts
    if (result.createdContacts.length > 0) {
      const contactsHeaders = ['ID', 'Name', 'Email', 'Client Name'];
      const contactsData = result.createdContacts.map(c => [c.id, c.name, c.email, c.clientName]);
      const contactsSheet = XLSX.utils.aoa_to_sheet([contactsHeaders, ...contactsData]);
      contactsSheet['!cols'] = [{ wch: 10 }, { wch: 30 }, { wch: 35 }, { wch: 40 }];
      XLSX.utils.book_append_sheet(workbook, contactsSheet, 'Created Contacts');
    }
    
    // Sheet 5: Errors
    if (result.errors.length > 0) {
      const errorsHeaders = ['Row', 'Error Message'];
      const errorsData = result.errors.map(e => [e.row || 'N/A', e.message]);
      const errorsSheet = XLSX.utils.aoa_to_sheet([errorsHeaders, ...errorsData]);
      errorsSheet['!cols'] = [{ wch: 10 }, { wch: 80 }];
      XLSX.utils.book_append_sheet(workbook, errorsSheet, 'Errors');
    }
    
    // Sheet 6: Warnings
    if (result.warnings.length > 0) {
      const warningsHeaders = ['Row', 'Warning Message'];
      const warningsData = result.warnings.map(w => [w.row || 'N/A', w.message]);
      const warningsSheet = XLSX.utils.aoa_to_sheet([warningsHeaders, ...warningsData]);
      warningsSheet['!cols'] = [{ wch: 10 }, { wch: 80 }];
      XLSX.utils.book_append_sheet(workbook, warningsSheet, 'Warnings');
    }
    
    // Convert to buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return buffer;
  }

  /**
   * Generate Excel file from preview data (after fixes)
   */
  static generatePreviewExcel(previewData: PreviewData): Buffer {
    const workbook = XLSX.utils.book_new();
    
    // Define headers (same as template)
    const headers = [
      'Group Name',
      'Client Name',
      'Client Industry',
      'Client Website',
      'Client Address',
      'Client Code',
      'Client Notes',
      'TSP Contact',
      'Contact Name',
      'Contact Email',
      'Contact Phone',
      'Contact Designation',
      'Is Primary',
      'Contact Notes'
    ];

    // Convert preview data to rows
    const rows: any[][] = [headers];
    
    // Group contacts by client
    const contactsByClient = new Map<string, typeof previewData.contacts>();
    for (const contact of previewData.contacts) {
      const key = `${contact.groupName}|||${contact.clientName}`;
      if (!contactsByClient.has(key)) {
        contactsByClient.set(key, []);
      }
      contactsByClient.get(key)!.push(contact);
    }

    // Create rows: one row per contact, with client data repeated
    for (const client of previewData.clients) {
      const clientKey = `${client.groupName}|||${client.name}`;
      const contacts = contactsByClient.get(clientKey) || [];
      
      // Format TSP Contact from tspContactUsers array
      let tspContactValue = '';
      if (client.tspContactUsers && client.tspContactUsers.length > 0) {
        tspContactValue = client.tspContactUsers.map(u => u.id).join('/');
      } else if (client.tspContact) {
        tspContactValue = client.tspContact;
      }

      if (contacts.length === 0) {
        // Client-only row (no contacts)
        rows.push([
          client.groupName,
          client.name,
          client.industry || '',
          client.website || '',
          client.address || '',
          client.code || '',
          client.notes || '',
          tspContactValue,
          '', // Contact Name
          '', // Contact Email
          '', // Contact Phone
          '', // Contact Designation
          '', // Is Primary
          ''  // Contact Notes
        ]);
      } else {
        // One row per contact
        for (const contact of contacts) {
          rows.push([
            client.groupName,
            client.name,
            client.industry || '',
            client.website || '',
            client.address || '',
            client.code || '',
            client.notes || '',
            tspContactValue,
            contact.name || '',
            contact.email || '',
            contact.phone || '',
            contact.designation || '',
            contact.isPrimary ? 'Y' : 'N',
            contact.notes || ''
          ]);
        }
      }
    }

    // Create worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(rows);

    // Set column widths
    const colWidths = [
      { wch: 15 }, // Group Name
      { wch: 20 }, // Client Name
      { wch: 15 }, // Client Industry
      { wch: 20 }, // Client Website
      { wch: 30 }, // Client Address
      { wch: 12 }, // Client Code
      { wch: 20 }, // Client Notes
      { wch: 15 }, // TSP Contact
      { wch: 20 }, // Contact Name
      { wch: 25 }, // Contact Email
      { wch: 18 }, // Contact Phone
      { wch: 18 }, // Contact Designation
      { wch: 12 }, // Is Primary
      { wch: 20 }  // Contact Notes
    ];
    worksheet['!cols'] = colWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Bulk Upload Data');

    // Convert to buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return buffer;
  }

  /**
   * Generate Excel template
   */
  static generateTemplate(): Buffer {
    const workbook = XLSX.utils.book_new();
    
    // Define headers
    const headers = [
      'Group Name',
      'Client Name',
      'Client Industry',
      'Client Website',
      'Client Address',
      'Client Code',
      'Client Notes',
      'TSP Contact',
      'Contact Name',
      'Contact Email',
      'Contact Phone',
      'Contact Designation',
      'Is Primary',
      'Contact Notes'
    ];

    // Example data rows
    const exampleRows = [
      ['TATA', 'TCS', 'Technology', 'www.tcs.com', 'Mumbai, Maharashtra, India', 'TCS001', 'Major IT client', '18', 'John Doe', 'john.doe@tcs.com', '+91 98765 43210', 'CEO', 'Y', 'Primary contact'],
      ['TATA', 'TCS', 'Technology', 'www.tcs.com', 'Mumbai, Maharashtra, India', 'TCS001', 'Major IT client', '18/20', 'Jane Smith', 'jane.smith@tcs.com', '+91 98765 43211', 'CTO', 'N', ''],
      ['TATA', 'TATA Steel', 'Manufacturing', 'www.tatasteel.com', 'Jamshedpur, Jharkhand, India', 'TS001', 'Steel manufacturing', '20', 'Bob Johnson', 'bob.johnson@tatasteel.com', '+91 98765 43212', 'Director', 'Y', '']
    ];

    // Create worksheet
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...exampleRows]);

    // Set column widths
    const colWidths = [
      { wch: 15 }, // Group Name
      { wch: 20 }, // Client Name
      { wch: 15 }, // Client Industry
      { wch: 20 }, // Client Website
      { wch: 30 }, // Client Address
      { wch: 12 }, // Client Code
      { wch: 20 }, // Client Notes
      { wch: 15 }, // TSP Contact
      { wch: 20 }, // Contact Name
      { wch: 25 }, // Contact Email
      { wch: 18 }, // Contact Phone
      { wch: 18 }, // Contact Designation
      { wch: 12 }, // Is Primary
      { wch: 20 }  // Contact Notes
    ];
    worksheet['!cols'] = colWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Bulk Upload Template');

    // Convert to buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return buffer;
  }
}

