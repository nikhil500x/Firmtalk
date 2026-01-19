// Location-specific billing information for Firmtalk

export interface LocationInfo {
  id: string;
  name: string;
  displayName: string;
  address: string;
  addressLines: string[]; // For multi-line display
  phone: string;
  fax?: string;
  email: string;
  website: string;
}

export const LOCATIONS: Record<string, LocationInfo> = {
  delhi: {
    id: 'delhi',
    name: 'Delhi',
    displayName: 'Delhi',
    address: '2nd Floor, Block - E, The MIRA, Plot - 1 & 2, Ishwar Nagar, Mathura Road, New Delhi - 110 065',
    addressLines: [
      '2nd Floor, Block - E, The MIRA,',
      'Plot - 1 & 2, Ishwar Nagar,',
      'Mathura Road, New Delhi - 110 065',
    ],
    phone: '+91 11 4260 3045/6/7',
    fax: '+91 11 4260 3049',
    email: 'accounts@touchstonepartners.com',
    website: 'touchstonepartners.com',
  },
  delhi_litigation: {
    id: 'delhi_litigation',
    name: 'Delhi – Litigation',
    displayName: 'Delhi – Litigation',
    address: '2nd Floor, Block A-2A, The MIRA, Plot - 1 & 2, Ishwar Nagar, Mathura Road, New Delhi - 110 065',
    addressLines: [
      '2nd Floor, Block A-2A, The MIRA,',
      'Plot - 1 & 2, Ishwar Nagar,',
      'Mathura Road, New Delhi - 110 065',
    ],
    phone: '+91 11 4831 1000',
    fax: '+91 11 4260 3049',
    email: 'accounts@touchstonepartners.com',
    website: 'touchstonepartners.com',
  },
  mumbai: {
    id: 'mumbai',
    name: 'Mumbai',
    displayName: 'Mumbai',
    address: 'One BKC, 808 B, Tower C, Bandra Kurla Complex, Mumbai – 400 051',
    addressLines: [
      'One BKC, 808 B, Tower C,',
      'Bandra Kurla Complex,',
      'Mumbai – 400 051',
    ],
    phone: '+91 22 6913 4305',
    email: 'accounts@touchstonepartners.com',
    website: 'touchstonepartners.com',
  },
  bangalore: {
    id: 'bangalore',
    name: 'Bangalore',
    displayName: 'Bangalore',
    address: '8th Floor, Vayudooth Chambers, 15/16, M.G. Road, Bangalore - 560001',
    addressLines: [
      '8th Floor, Vayudooth Chambers,',
      '15/16, M.G. Road, Bangalore - 560001',
    ],
    phone: '+91 80 4336 8900',
    fax: '+91 80 4336 8901',
    email: 'pavithra.sanjeev@touchstonepartners.com',
    website: 'touchstonepartners.com',
  },
};

// Default location (Mumbai as per current implementation)
export const DEFAULT_LOCATION_ID = 'mumbai';

// Get location by ID with fallback to default
export const getLocation = (locationId?: string): LocationInfo => {
  if (!locationId) return LOCATIONS[DEFAULT_LOCATION_ID];
  return LOCATIONS[locationId] || LOCATIONS[DEFAULT_LOCATION_ID];
};

// Get all locations as array for dropdown
export const getLocationOptions = (): LocationInfo[] => {
  return Object.values(LOCATIONS);
};