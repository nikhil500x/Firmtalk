import { Document, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, WidthType, BorderStyle, ImageRun } from 'docx';
import { COMPANY_LOGO } from './logo-base64';
import { getLocation } from '@/lib/location-constants';
import { formatMatterId } from '@/lib/invoiceUtils';

interface LawyerFee {
  lawyerName: string;
  lawyerRole: string;
  hours: number;
  hourlyRate: number;
  fees: number;
}

interface TimesheetEntry {
  timesheetId?: number;
  date: string;
  lawyerName: string;
  lawyerRole: string;
  description?: string | null;
  hours: number;
  hourlyRate: number;
  fees: number;
  currency?: string;
  originalCurrency?: string;
  originalHours?: number;
  originalFees?: number;
  matterTitle?: string | null;
  matterId?: number | null;
  clientCode?: string | null;
  activityType?: string;
}

interface ExpenseEntry {
  category: string;
  subCategory?: string | null;
  description: string;
  originalAmount: number;
  billedAmount?: number; // Optional, API might use 'amount' instead
  amount?: number; // Fallback property name from API
  originalCurrency: string;
  currency: string;
  exchangeRate?: number | null;
}

interface PartnerShare {
  userId: number;
  userName: string;
  userEmail?: string;
  percentage: number;
}

interface Payment {
  id: number;
  paymentDate: string;
  amount: number;
  paymentMethod: string;
  transactionRef?: string | null;
  notes?: string | null;
}

interface Matter {
  id: number;
  title: string;
  currency?: string;
}

interface InvoiceWordData {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  clientName: string;
  clientAddress?: string;
  matterTitle?: string;
  matters?: Matter[];
  periodFrom?: string;
  periodTo?: string;
  amount: number;
  subtotal?: number;
  discountType?: 'percentage' | 'fixed' | null;
  discountValue?: number;
  discountAmount?: number;
  lawyerFees?: LawyerFee[];
  timesheetEntries?: TimesheetEntry[];
  expenseEntries?: ExpenseEntry[];
  partnerShares?: PartnerShare[];
  payments?: Payment[];
  disbursements?: number;
  companyName?: string;
  companyLogo?: string;
  companyAddress?: string;
  companyEmail?: string;
  billingLocation?: string;
  companyPhone?: string;
  matterCurrency?: string;
  invoiceCurrency?: string;
  userExchangeRate?: number | null;
  amountInINR?: number | null;
  exchangeRates?: Record<string, number>;
  description?: string;
  notes?: string;
  status: string;
  amountPaid: number;
  remainingAmount: number;
}

interface InvoiceWordDocumentProps {
  data: InvoiceWordData;
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
};

// formatYear removed - not used in current implementation

// ✅ Create a closure to capture data for currency formatting
const createFormatCurrency = (data: InvoiceWordData) => (amount: number): string => {
  const currencyCode = data.invoiceCurrency || data.matterCurrency || 'INR';
  // Currency symbols mapping
  const symbols: Record<string, string> = {
    INR: '₹',
    USD: '$',
    EUR: '€',
    GBP: '£',
    AED: 'د.إ',
    JPY: '¥',
  };
  const symbol = symbols[currencyCode] || currencyCode;
  return `${symbol} ${amount.toFixed(2)}`;
};

const formatNumber = (num: number): string => {
  return num.toFixed(2);
};

// Helper function to format currency for a specific currency code
const formatCurrencyForCode = (amount: number | null | undefined, currencyCode: string | null | undefined): string => {
  const safeAmount = amount ?? 0;
  const safeCurrency = currencyCode || 'INR';
  const symbols: Record<string, string> = {
    INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'د.إ', JPY: '¥',
  };
  const symbol = symbols[safeCurrency] || safeCurrency;
  return `${symbol} ${safeAmount.toFixed(2)}`;
};

const base64ToBuffer = (base64: string): Buffer => {
  const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
  return Buffer.from(base64Data, 'base64');
};

const createCompanyHeader = (data: InvoiceWordData): (Paragraph | Table)[] => {
  // const companyInfo = {
  //   name: data.companyName || 'Touchstone Partners',
  //   address: data.companyAddress || 'One BKC, 808 B, Tower C,\nBandra Kurla Complex,\nMumbai – 400051',
  //   email: data.companyEmail || 'accounts@touchstonepartners.com',
  //   phone: data.companyPhone || '+91 22 69134305',
  //   website: 'touchstonepartners.com',
  // };

  const location = getLocation(data.billingLocation);


  const headerElements: (Paragraph | Table)[] = [];
  const logoToUse = data.companyLogo || COMPANY_LOGO;

  // Create a table for side-by-side layout: logo on left, contact info on right
  const logoChildren = logoToUse
      ? [
          new ImageRun({
            type: 'png',
            data: base64ToBuffer(logoToUse),
            transformation: {
              width: 200,
              height: 100,
            },
          }),
        ]
      : [
          new TextRun({
            text: 'Firmtalk', // ✅ CHANGED: Use hardcoded name instead of companyInfo.name
            bold: true,
            size: 32,
          }),
        ];

  const contactInfoChildren = [
    ...location.addressLines.map(line => 
      new Paragraph({
        children: [
          new TextRun({
            text: line,
            size: 22,
          }),
        ],
        alignment: AlignmentType.RIGHT,
        spacing: { after: 50 },
      })
    ),
    new Paragraph({
      children: [
        new TextRun({
          text: `Tel: ${location.phone}`,
          size: 22,
        }),
      ],
      alignment: AlignmentType.RIGHT,
      spacing: { after: 50 },
    }),
    ...(location.fax ? [new Paragraph({
      children: [
        new TextRun({
          text: `F: ${location.fax}`,
          size: 22,
        }),
      ],
      alignment: AlignmentType.RIGHT,
      spacing: { after: 50 },
    })] : []),
    new Paragraph({
      children: [
        new TextRun({
          text: `E: ${location.email}`,
          size: 22,
        }),
      ],
      alignment: AlignmentType.RIGHT,
      spacing: { after: 50 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `W: ${location.website}`,
          size: 22,
        }),
      ],
      alignment: AlignmentType.RIGHT,
    }),
  ];

  

  // Create header table
  headerElements.push(
    new Table({
      width: {
        size: 100,
        type: WidthType.PERCENTAGE,
      },
      borders: {
        top: { style: BorderStyle.NONE, size: 0 },
        bottom: { style: BorderStyle.SINGLE, size: 15, color: '333333' },
        left: { style: BorderStyle.NONE, size: 0 },
        right: { style: BorderStyle.NONE, size: 0 },
        insideHorizontal: { style: BorderStyle.NONE, size: 0 },
        insideVertical: { style: BorderStyle.NONE, size: 0 },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: logoChildren })],
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE, size: 0 },
                bottom: { style: BorderStyle.NONE, size: 0 },
                left: { style: BorderStyle.NONE, size: 0 },
                right: { style: BorderStyle.NONE, size: 0 },
              },
              verticalAlign: 'top',
            }),
            new TableCell({
              children: contactInfoChildren,
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE, size: 0 },
                bottom: { style: BorderStyle.NONE, size: 0 },
                left: { style: BorderStyle.NONE, size: 0 },
                right: { style: BorderStyle.NONE, size: 0 },
              },
              verticalAlign: 'top',
            }),
          ],
        }),
      ],
    }),
    new Paragraph({
      text: '',
      spacing: { after: 300 },
    })
  );

  return headerElements;
};

// ============================================================================
// HELPER FUNCTIONS FOR EACH PAGE
// ============================================================================

/**
 * Create Page 1: Letter to client (existing format)
 */
const createLetterPage = (data: InvoiceWordData, formatCurrency: (amount: number) => string): (Paragraph | Table)[] => {
  return [
          ...createCompanyHeader(data),
          new Paragraph({
            children: [
              new TextRun({
                text: data.clientName,
                bold: true,
          size: 28,
              }),
            ],
            spacing: { after: 300 },
          }),
          ...(data.matterTitle ? [
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Matter name: ',
                  bold: true,
            size: 28,
                }),
                new TextRun({
                  text: data.matterTitle,
            size: 28,
          }),
        ],
      }),
    ] : []),
    ...(data.matters && data.matters.length > 0 && !data.matterTitle ? [
      new Paragraph({
        children: [
          new TextRun({
            text: 'Matter(s): ',
            bold: true,
            size: 28,
          }),
          new TextRun({
            text: data.matters.map(m => m.title).join(', '),
            size: 28,
                }),
              ],
            }),
          ] : []),
          ...(data.periodFrom && data.periodTo ? [
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Period from: ',
                  bold: true,
            size: 28,
                }),
                new TextRun({
                  text: `${formatDate(data.periodFrom)} to ${formatDate(data.periodTo)}`,
            size: 28,
                }),
              ],
              spacing: { after: 300 },
            }),
          ] : []),
          new Paragraph({
            children: [
              new TextRun({
                text: 'Dear',
          size: 28,
              }),
            ],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'Please find enclosed our draft invoice for legal services rendered.',
          size: 28,
              }),
            ],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'I should be grateful if you would arrange to have the amount remitted to our account with Standard Chartered Bank, Malcha Marg, Chanakyapuri, New Delhi, India (IFSC Code: SCBL0036031). The account name is Touchstone Partners and the account number is 524-0-509555-0. Our PAN no. is AASFP3948G.',
          size: 28,
              }),
            ],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'In the alternative, you could also have a cheque in the appropriate amount and in the name of "Touchstone Partners", to be dispatched to the above address.',
          size: 28,
              }),
            ],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'Please pay GST on the invoice value directly to government under Reverse Charge Mechanism in terms of Sr.No.2 of Notification No.13/2017-Central Tax (Rate) dt. 28 June 2017 read with section 20 of the IGST Act, 2017.',
          size: 28,
              }),
            ],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'I trust you find this to be in order.',
          size: 28,
              }),
            ],
            spacing: { after: 300 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'Yours faithfully',
          size: 28,
              }),
            ],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'Accounts Team, Touchstone Partners',
                bold: true,
          size: 28,
              }),
            ],
          }),
  ];
};

/**
 * Create Page 2: Invoice Details/Preview
 * Matches the InvoicePreview component structure exactly
 */
const createInvoiceDetailsPage = (data: InvoiceWordData, formatCurrency: (amount: number) => string): (Paragraph | Table)[] => {
  const subtotal = data.subtotal ?? data.amount;
  const discountAmount = data.discountAmount ?? 0;
  const totalAmount = data.amount;

  // Build return array
  const result: (Paragraph | Table)[] = [
    ...createCompanyHeader(data),
    
    // BILL TO / INVOICE DETAILS Section (2-column table)
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE, size: 0 },
        bottom: { style: BorderStyle.NONE, size: 0 },
        left: { style: BorderStyle.NONE, size: 0 },
        right: { style: BorderStyle.NONE, size: 0 },
        insideHorizontal: { style: BorderStyle.NONE, size: 0 },
        insideVertical: { style: BorderStyle.NONE, size: 0 },
      },
      rows: [
        new TableRow({
        children: [
            // Bill To column
            new TableCell({
              children: [
          new Paragraph({
            children: [
              new TextRun({
                      text: 'BILL TO',
                      size: 22,
                      color: '666666',
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                      text: data.clientName || 'Client Name',
                bold: true,
                      size: 28,
                    }),
                  ],
                  spacing: { after: 100 },
                }),
                ...(data.clientAddress ? [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: data.clientAddress,
                        size: 24,
                        color: '666666',
                      }),
                    ],
                  }),
                ] : []),
                ...(data.matterTitle ? [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `Matter: ${data.matterTitle}`,
                        size: 24,
                        color: '666666',
                      }),
                    ],
                    spacing: { before: 100 },
                  }),
                ] : []),
              ],
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE, size: 0 },
                bottom: { style: BorderStyle.NONE, size: 0 },
                left: { style: BorderStyle.NONE, size: 0 },
                right: { style: BorderStyle.NONE, size: 0 },
              },
            }),
            // Invoice Details column
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'INVOICE DETAILS',
                      size: 22,
                      color: '666666',
                    }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Invoice Date: ',
                      size: 24,
                      color: '666666',
                    }),
                    new TextRun({
                      text: data.invoiceDate ? formatDate(data.invoiceDate) : '-',
                      size: 24,
                    }),
                  ],
                  spacing: { after: 50 },
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Due Date: ',
                      size: 24,
                      color: '666666',
                    }),
                    new TextRun({
                      text: data.dueDate ? formatDate(data.dueDate) : '-',
                      size: 24,
                    }),
                  ],
                  spacing: { after: 50 },
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Invoice Number: ',
                      size: 24,
                      color: '666666',
                    }),
                    new TextRun({
                      text: `#${data.invoiceNumber || 'INV-XXXX'}`,
                      bold: true,
                      size: 24,
                    }),
                  ],
                }),
              ],
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE, size: 0 },
                bottom: { style: BorderStyle.NONE, size: 0 },
                left: { style: BorderStyle.NONE, size: 0 },
                right: { style: BorderStyle.NONE, size: 0 },
              },
            }),
          ],
        }),
      ],
    }),
    
    new Paragraph({
      text: '',
      spacing: { after: 400 },
    }),

    // DESCRIPTION OF SERVICES Section
    new Paragraph({
      children: [
        new TextRun({
          text: 'DESCRIPTION OF SERVICES',
                size: 22,
          color: '666666',
              }),
            ],
      spacing: { after: 100 },
          }),
    // Border line using a table
          new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        bottom: { style: BorderStyle.NONE, size: 0 },
        left: { style: BorderStyle.NONE, size: 0 },
        right: { style: BorderStyle.NONE, size: 0 },
        insideHorizontal: { style: BorderStyle.NONE, size: 0 },
        insideVertical: { style: BorderStyle.NONE, size: 0 },
            },
            rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ text: '' })],
              borders: {
                top: { style: BorderStyle.NONE, size: 0 },
                bottom: { style: BorderStyle.NONE, size: 0 },
                left: { style: BorderStyle.NONE, size: 0 },
                right: { style: BorderStyle.NONE, size: 0 },
              },
            }),
          ],
        }),
      ],
    }),
    
    new Paragraph({
      children: [
        new TextRun({
          text: data.description || 'Service description will appear here...',
          size: 24,
          color: data.description ? '000000' : '999999',
          italics: !data.description,
        }),
      ],
      spacing: { after: 400 },
    }),

    // AMOUNT SUMMARY Section (Grey box with rounded corners effect)
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
        left: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
        right: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
        insideHorizontal: { style: BorderStyle.NONE, size: 0 },
        insideVertical: { style: BorderStyle.NONE, size: 0 },
      },
      rows: [
        // Subtotal row
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                      text: 'Subtotal:',
                      size: 24,
                    }),
                  ],
                }),
              ],
              width: { size: 50, type: WidthType.PERCENTAGE },
              shading: { fill: 'F9FAFB' },
              borders: {
                top: { style: BorderStyle.NONE, size: 0 },
                bottom: { style: BorderStyle.NONE, size: 0 },
                left: { style: BorderStyle.NONE, size: 0 },
                right: { style: BorderStyle.NONE, size: 0 },
              },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: formatCurrency(subtotal),
                      size: 28,
                            bold: true,
                          }),
                        ],
                  alignment: AlignmentType.RIGHT,
                      }),
                    ],
              width: { size: 50, type: WidthType.PERCENTAGE },
              shading: { fill: 'F9FAFB' },
              borders: {
                top: { style: BorderStyle.NONE, size: 0 },
                bottom: { style: BorderStyle.NONE, size: 0 },
                left: { style: BorderStyle.NONE, size: 0 },
                right: { style: BorderStyle.NONE, size: 0 },
              },
                  }),
                ],
              }),
        // Discount row (if applicable)
        ...(discountAmount > 0 ? [
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                        text: data.discountType === 'percentage' 
                          ? `Discount (${data.discountValue}%):`
                          : 'Discount (Fixed):',
                        size: 24,
                          }),
                        ],
                      }),
                    ],
                width: { size: 50, type: WidthType.PERCENTAGE },
                shading: { fill: 'F9FAFB' },
                borders: {
                  top: { style: BorderStyle.NONE, size: 0 },
                  bottom: { style: BorderStyle.NONE, size: 0 },
                  left: { style: BorderStyle.NONE, size: 0 },
                  right: { style: BorderStyle.NONE, size: 0 },
                },
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                        text: `-${formatCurrency(discountAmount)}`,
                        size: 28,
                            bold: true,
                        color: 'DC2626', // Red color
                          }),
                        ],
                        alignment: AlignmentType.RIGHT,
                      }),
                    ],
                width: { size: 50, type: WidthType.PERCENTAGE },
                shading: { fill: 'F9FAFB' },
                borders: {
                  top: { style: BorderStyle.NONE, size: 0 },
                  bottom: { style: BorderStyle.NONE, size: 0 },
                  left: { style: BorderStyle.NONE, size: 0 },
                  right: { style: BorderStyle.NONE, size: 0 },
                },
              }),
            ],
          }),
        ] : []),
        // Separator row (border-top effect)
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ text: '' })],
              columnSpan: 2,
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
                bottom: { style: BorderStyle.NONE, size: 0 },
                left: { style: BorderStyle.NONE, size: 0 },
                right: { style: BorderStyle.NONE, size: 0 },
              },
            }),
          ],
        }),
        // Total Amount Due row
        new TableRow({
          children: [
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                      text: 'Total Amount Due:',
                      size: 28,
                            bold: true,
                    }),
                  ],
                }),
              ],
              width: { size: 50, type: WidthType.PERCENTAGE },
              shading: { fill: 'F9FAFB' },
              borders: {
                top: { style: BorderStyle.NONE, size: 0 },
                bottom: { style: BorderStyle.NONE, size: 0 },
                left: { style: BorderStyle.NONE, size: 0 },
                right: { style: BorderStyle.NONE, size: 0 },
              },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: formatCurrency(totalAmount),
                      size: 36,
                      bold: true,
                      color: '2563EB', // Blue color
                    }),
                  ],
                  alignment: AlignmentType.RIGHT,
                }),
              ],
              width: { size: 50, type: WidthType.PERCENTAGE },
              shading: { fill: 'F9FAFB' },
              borders: {
                top: { style: BorderStyle.NONE, size: 0 },
                bottom: { style: BorderStyle.NONE, size: 0 },
                left: { style: BorderStyle.NONE, size: 0 },
                right: { style: BorderStyle.NONE, size: 0 },
              },
            }),
          ],
        }),
        // INR equivalent row (if applicable)
        ...(data.invoiceCurrency && data.invoiceCurrency !== 'INR' && data.amountInINR ? [
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: 'Equivalent in INR:',
                        size: 20,
                        color: '666666',
                      }),
                    ],
                  }),
                ],
                width: { size: 50, type: WidthType.PERCENTAGE },
                shading: { fill: 'F9FAFB' },
                borders: {
                  top: { style: BorderStyle.NONE, size: 0 },
                  bottom: { style: BorderStyle.NONE, size: 0 },
                  left: { style: BorderStyle.NONE, size: 0 },
                  right: { style: BorderStyle.NONE, size: 0 },
                },
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: formatCurrencyForCode(data.amountInINR, 'INR'),
                        size: 22,
                        bold: true,
                        color: '666666',
                      }),
                    ],
                    alignment: AlignmentType.RIGHT,
                  }),
                ],
                width: { size: 50, type: WidthType.PERCENTAGE },
                shading: { fill: 'F9FAFB' },
                borders: {
                  top: { style: BorderStyle.NONE, size: 0 },
                  bottom: { style: BorderStyle.NONE, size: 0 },
                  left: { style: BorderStyle.NONE, size: 0 },
                  right: { style: BorderStyle.NONE, size: 0 },
                },
              }),
            ],
          }),
        ] : []),
      ],
    }),

    // NOTES Section (if applicable)
    ...(data.notes ? [
      new Paragraph({
        text: '',
        spacing: { after: 400 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: 'NOTES',
            size: 22,
            color: '666666',
          }),
        ],
        spacing: { after: 200 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: data.notes,
            size: 24,
            color: '333333',
          }),
        ],
      }),
    ] : []),
  ];

  return result;
};

/**
 * Create Page 3: Itemized Timesheet Entries
 */
const createItemizedTimesheetEntriesPage = (data: InvoiceWordData, formatCurrency: (amount: number) => string): (Paragraph | Table)[] => {
  if (!data.timesheetEntries || data.timesheetEntries.length === 0) {
    return [
      new Paragraph({
        children: [
          new TextRun({
            text: 'Itemized Timesheet Entries',
            bold: true,
            size: 28,
          }),
        ],
        spacing: { after: 200 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: 'No timesheet entries available.',
            size: 28,
          }),
        ],
      }),
    ];
  }

  // Group entries by date
  const groupedByDate: Record<string, TimesheetEntry[]> = {};
  for (const entry of data.timesheetEntries) {
    const date = entry.date || 'Unknown';
    if (!groupedByDate[date]) {
      groupedByDate[date] = [];
    }
    groupedByDate[date].push(entry);
  }

  const sortedDates = Object.keys(groupedByDate).sort();
  const invoiceCurrency = data.invoiceCurrency || data.matterCurrency || 'INR';

  const tableRows: TableRow[] = [];

  // Header row
  tableRows.push(
                      new TableRow({
                        children: [
                          new TableCell({
                            children: [
                              new Paragraph({
                                children: [
                                  new TextRun({
                  text: 'Date',
                  bold: true,
                  size: 28,
                                  }),
                                ],
                              }),
                            ],
          width: { size: 12, type: WidthType.PERCENTAGE },
          shading: { fill: 'E5E7EB' },
                          }),
                          new TableCell({
                            children: [
                              new Paragraph({
                                children: [
                                  new TextRun({
                  text: 'Matter',
                  bold: true,
                  size: 28,
                }),
              ],
            }),
          ],
          width: { size: 15, type: WidthType.PERCENTAGE },
          shading: { fill: 'E5E7EB' },
        }),
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Lawyer',
                  bold: true,
                  size: 28,
                }),
              ],
            }),
          ],
          width: { size: 18, type: WidthType.PERCENTAGE },
          shading: { fill: 'E5E7EB' },
        }),
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Role',
                  bold: true,
                  size: 28,
                }),
              ],
            }),
          ],
          width: { size: 10, type: WidthType.PERCENTAGE },
          shading: { fill: 'E5E7EB' },
        }),
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Hours',
                  bold: true,
                  size: 28,
                                  }),
                                ],
                                alignment: AlignmentType.RIGHT,
                              }),
                            ],
          width: { size: 8, type: WidthType.PERCENTAGE },
          shading: { fill: 'E5E7EB' },
                          }),
                          new TableCell({
                            children: [
                              new Paragraph({
                                children: [
                                  new TextRun({
                  text: 'Rate',
                  bold: true,
                  size: 28,
                                  }),
                                ],
                                alignment: AlignmentType.RIGHT,
                              }),
                            ],
          width: { size: 10, type: WidthType.PERCENTAGE },
          shading: { fill: 'E5E7EB' },
                          }),
                          new TableCell({
                            children: [
                              new Paragraph({
                                children: [
                                  new TextRun({
                  text: 'Fees',
                  bold: true,
                  size: 28,
                                  }),
                                ],
                                alignment: AlignmentType.RIGHT,
                              }),
                            ],
          width: { size: 12, type: WidthType.PERCENTAGE },
          shading: { fill: 'E5E7EB' },
        }),
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Currency',
                  bold: true,
                  size: 28,
                }),
              ],
              alignment: AlignmentType.CENTER,
            }),
          ],
          width: { size: 8, type: WidthType.PERCENTAGE },
          shading: { fill: 'E5E7EB' },
        }),
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Description',
                  bold: true,
                  size: 28,
                }),
              ],
            }),
          ],
          width: { size: 7, type: WidthType.PERCENTAGE },
          shading: { fill: 'E5E7EB' },
                          }),
                        ],
                      })
  );

  // Add entries grouped by date
  for (const date of sortedDates) {
    const entries = groupedByDate[date];
    let dayTotalFees = 0;
    const dayCurrency = entries[0]?.currency || invoiceCurrency;

    // Date header row
    tableRows.push(
                      new TableRow({
                        children: [
                          new TableCell({
                            children: [
                              new Paragraph({
                                children: [
                                  new TextRun({
                    text: formatDate(date),
                    bold: true,
                    size: 28,
                                  }),
                                ],
                              }),
                            ],
            columnSpan: 9,
            shading: { fill: 'F3F4F6' },
          }),
        ],
      })
    );

    // Entry rows for this date
    for (const entry of entries) {
      const matterDisplay = entry.matterTitle
        ? `${formatMatterId(entry.clientCode, entry.matterId)} - ${entry.matterTitle}`
        : (entry.matterId ? formatMatterId(entry.clientCode, entry.matterId) : 'N/A');

      dayTotalFees += entry.fees;

      tableRows.push(
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ text: '' })],
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: matterDisplay,
                      size: 32,
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: entry.lawyerName,
                      size: 32,
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: entry.lawyerRole,
                      size: 32,
                    }),
                  ],
                }),
              ],
                          }),
                          new TableCell({
                            children: [
                              new Paragraph({
                                children: [
                                  new TextRun({
                                    text: formatNumber(entry.hours),
                      size: 32,
                                  }),
                                ],
                                alignment: AlignmentType.RIGHT,
                              }),
                            ],
                          }),
                          new TableCell({
                            children: [
                              new Paragraph({
                                children: [
                                  new TextRun({
                      text: formatCurrencyForCode(entry.hourlyRate, entry.currency || invoiceCurrency),
                      size: 32,
                                  }),
                                ],
                                alignment: AlignmentType.RIGHT,
                              }),
                            ],
                          }),
                          new TableCell({
                            children: [
                              new Paragraph({
                                children: [
                                  new TextRun({
                      text: formatCurrencyForCode(entry.fees, entry.currency || invoiceCurrency),
                      size: 32,
                                  }),
                                ],
                                alignment: AlignmentType.RIGHT,
                              }),
                            ],
                          }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: entry.currency || invoiceCurrency,
                      size: 32,
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: entry.description || '-',
                      size: 32,
                    }),
                  ],
                }),
              ],
            }),
          ],
        })
      );
    }

    // Day total row
    tableRows.push(
                    new TableRow({
                      children: [
                        new TableCell({
                          children: [
                            new Paragraph({
                              children: [
                                new TextRun({
                    text: 'Day Total',
                    bold: true,
                    size: 32,
                                }),
                              ],
                alignment: AlignmentType.RIGHT,
                            }),
                          ],
            columnSpan: 5,
            shading: { fill: 'F3F4F6' },
                        }),
                        new TableCell({
                          children: [
                            new Paragraph({
                              children: [
                                new TextRun({
                    text: formatCurrencyForCode(dayTotalFees, dayCurrency),
                    bold: true,
                    size: 32,
                                }),
                              ],
                              alignment: AlignmentType.RIGHT,
                            }),
                          ],
            shading: { fill: 'F3F4F6' },
                        }),
                        new TableCell({
                          children: [
                            new Paragraph({
                              children: [
                                new TextRun({
                    text: dayCurrency,
                    bold: true,
                    size: 32,
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
            shading: { fill: 'F3F4F6' },
          }),
          new TableCell({
            children: [new Paragraph({ text: '' })],
            columnSpan: 2,
            shading: { fill: 'F3F4F6' },
          }),
        ],
      })
    );
  }

  return [
    new Paragraph({
        children: [
          new TextRun({
            text: 'Itemized Timesheet Entries',
            bold: true,
            size: 32,
          }),
        ],
      spacing: { after: 300 },
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: tableRows,
    }),
  ];
};

/**
 * Create Page 4: Timesheets - Fees Summary
 */
const createTimesheetsSummaryPage = (data: InvoiceWordData, formatCurrency: (amount: number) => string): (Paragraph | Table)[] => {
  if (!data.lawyerFees || data.lawyerFees.length === 0) {
    return [
      new Paragraph({
        children: [
          new TextRun({
            text: 'Timesheets - Fees Summary',
            bold: true,
            size: 28,
          }),
        ],
        spacing: { after: 200 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: 'No timesheet data available.',
            size: 28,
          }),
        ],
      }),
    ];
  }

  const totalHours = data.lawyerFees.reduce((sum, l) => sum + l.hours, 0);
  const totalFees = data.lawyerFees.reduce((sum, l) => sum + l.fees, 0);
  const invoiceCurrency = data.invoiceCurrency || data.matterCurrency || 'INR';

  const matterHeader = data.matters && data.matters.length > 0
    ? data.matters.map(m => m.title).join(', ')
    : (data.matterTitle || 'Matter Name');
  
  const periodText = data.periodFrom && data.periodTo
    ? `Period from ${formatDate(data.periodFrom)}`
    : '';

  return [
    new Paragraph({
      children: [
        new TextRun({
          text: 'Timesheets - Fees Summary',
          bold: true,
                      size: 22,
        }),
      ],
      spacing: { after: 300 },
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `${matterHeader}\n${periodText}`,
                      bold: true,
                      size: 28,
                    }),
                  ],
                }),
              ],
              columnSpan: 4,
              shading: { fill: 'F3F4F6' },
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Lawyer(s)',
                      bold: true,
                      size: 28,
                    }),
                  ],
                }),
              ],
              width: { size: 35, type: WidthType.PERCENTAGE },
              shading: { fill: 'E5E7EB' },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Hours',
                      bold: true,
                      size: 28,
                                }),
                              ],
                              alignment: AlignmentType.RIGHT,
                            }),
                          ],
              width: { size: 20, type: WidthType.PERCENTAGE },
              shading: { fill: 'E5E7EB' },
                        }),
                        new TableCell({
                          children: [
                            new Paragraph({
                              children: [
                                new TextRun({
                      text: 'Hourly Rate',
                      bold: true,
                      size: 28,
                                }),
                              ],
                              alignment: AlignmentType.RIGHT,
                            }),
                          ],
              width: { size: 25, type: WidthType.PERCENTAGE },
              shading: { fill: 'E5E7EB' },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Fees',
                      bold: true,
                      size: 28,
                        }),
                      ],
                  alignment: AlignmentType.RIGHT,
                }),
              ],
              width: { size: 20, type: WidthType.PERCENTAGE },
              shading: { fill: 'E5E7EB' },
            }),
          ],
        }),
        ...data.lawyerFees.map(
          (lawyer) =>
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: `${lawyer.lawyerName} (${lawyer.lawyerRole})`,
                          size: 28,
                        }),
                      ],
                    }),
                  ],
                }),
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: formatNumber(lawyer.hours),
                          size: 28,
                        }),
                      ],
                      alignment: AlignmentType.RIGHT,
                    }),
                  ],
                }),
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: formatCurrencyForCode(lawyer.hourlyRate, invoiceCurrency),
                          size: 28,
                        }),
                      ],
                      alignment: AlignmentType.RIGHT,
                    }),
                  ],
                }),
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: formatCurrencyForCode(lawyer.fees, invoiceCurrency),
                          size: 28,
                        }),
                      ],
                      alignment: AlignmentType.RIGHT,
                    }),
                  ],
                }),
              ],
            })
        ),
              // Sub-Total Row
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: 'Sub-Total',
                            bold: true,
                      size: 28,
                          }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: formatNumber(totalHours),
                            bold: true,
                      size: 28,
                          }),
                        ],
                        alignment: AlignmentType.RIGHT,
                      }),
                    ],
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: '' })],
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                      text: formatCurrencyForCode(totalFees, invoiceCurrency),
                            bold: true,
                      size: 28,
                          }),
                        ],
                        alignment: AlignmentType.RIGHT,
                      }),
                    ],
                  }),
                ],
              }),
              // Total Fees Row
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ text: '' })],
                    borders: {
                      top: { style: BorderStyle.DOUBLE, size: 3 },
                      bottom: { style: BorderStyle.DOUBLE, size: 3 },
                    },
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: '' })],
                    borders: {
                      top: { style: BorderStyle.DOUBLE, size: 3 },
                      bottom: { style: BorderStyle.DOUBLE, size: 3 },
                    },
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: 'Total Fees',
                            bold: true,
                      size: 28,
                          }),
                        ],
                        alignment: AlignmentType.RIGHT,
                      }),
                    ],
                    borders: {
                      top: { style: BorderStyle.DOUBLE, size: 3 },
                      bottom: { style: BorderStyle.DOUBLE, size: 3 },
                    },
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                      text: formatCurrencyForCode(totalFees, invoiceCurrency),
                            bold: true,
                      size: 28,
                          }),
                        ],
                        alignment: AlignmentType.RIGHT,
                      }),
                    ],
                    borders: {
                      top: { style: BorderStyle.DOUBLE, size: 3 },
                      bottom: { style: BorderStyle.DOUBLE, size: 3 },
                    },
                  }),
                ],
              }),
            ],
          }),
  ];
};

/**
 * Create Page 5: Expenses
 */
const createExpensesPage = (data: InvoiceWordData, formatCurrency: (amount: number) => string): (Paragraph | Table)[] => {
  if (!data.expenseEntries || data.expenseEntries.length === 0) {
    return [
          new Paragraph({
            children: [
              new TextRun({
            text: 'Expenses',
                bold: true,
            size: 28,
              }),
            ],
        spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({
            text: 'No expenses recorded.',
            size: 28,
          }),
        ],
      }),
    ];
  }

  const invoiceCurrency = data.invoiceCurrency || data.matterCurrency || 'INR';
  const totalOriginalAmount = data.expenseEntries.reduce((sum, e) => sum + (e.originalAmount || 0), 0);
  const totalBilledAmount = data.expenseEntries.reduce((sum, e) => sum + (e.billedAmount || e.amount || 0), 0);
  const originalCurrency = data.expenseEntries[0]?.originalCurrency || 'INR';

  return [
    new Paragraph({
      children: [
        new TextRun({
          text: 'Expenses',
                bold: true,
                size: 22,
              }),
            ],
      spacing: { after: 300 },
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Category',
                      bold: true,
                      size: 28,
          }),
        ],
                }),
              ],
              width: { size: 15, type: WidthType.PERCENTAGE },
              shading: { fill: 'E5E7EB' },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Sub-Category',
                      bold: true,
                      size: 28,
                    }),
                  ],
                }),
              ],
              width: { size: 15, type: WidthType.PERCENTAGE },
              shading: { fill: 'E5E7EB' },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Description',
                      bold: true,
                      size: 28,
                    }),
                  ],
                }),
              ],
              width: { size: 25, type: WidthType.PERCENTAGE },
              shading: { fill: 'E5E7EB' },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Original Amount',
                      bold: true,
                      size: 28,
                    }),
                  ],
                  alignment: AlignmentType.RIGHT,
                }),
              ],
              width: { size: 12, type: WidthType.PERCENTAGE },
              shading: { fill: 'E5E7EB' },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Original Currency',
                      bold: true,
                      size: 28,
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              width: { size: 10, type: WidthType.PERCENTAGE },
              shading: { fill: 'E5E7EB' },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Billed Amount',
                      bold: true,
                      size: 28,
                    }),
                  ],
                  alignment: AlignmentType.RIGHT,
                }),
              ],
              width: { size: 12, type: WidthType.PERCENTAGE },
              shading: { fill: 'E5E7EB' },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Invoice Currency',
                      bold: true,
                      size: 28,
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              width: { size: 8, type: WidthType.PERCENTAGE },
              shading: { fill: 'E5E7EB' },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Exchange Rate',
                      bold: true,
                      size: 28,
                    }),
                  ],
                  alignment: AlignmentType.RIGHT,
                }),
              ],
              width: { size: 3, type: WidthType.PERCENTAGE },
              shading: { fill: 'E5E7EB' },
            }),
          ],
        }),
        ...data.expenseEntries.map(
          (expense) =>
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: expense.category,
                          size: 32,
                        }),
                      ],
                    }),
                  ],
                }),
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: expense.subCategory || '-',
                          size: 32,
                        }),
                      ],
                    }),
                  ],
                }),
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: expense.description,
                          size: 32,
                        }),
                      ],
                    }),
                  ],
                }),
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: formatCurrencyForCode(expense.originalAmount || 0, expense.originalCurrency || 'INR'),
                          size: 32,
                        }),
                      ],
                      alignment: AlignmentType.RIGHT,
                    }),
                  ],
                }),
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: expense.originalCurrency,
                          size: 32,
                        }),
                      ],
                      alignment: AlignmentType.CENTER,
                    }),
                  ],
                }),
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: formatCurrencyForCode(expense.billedAmount || expense.amount || 0, expense.currency || 'INR'),
                          size: 32,
                        }),
                      ],
                      alignment: AlignmentType.RIGHT,
                    }),
                  ],
                }),
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: expense.currency || 'INR',
                          size: 32,
                        }),
                      ],
                      alignment: AlignmentType.CENTER,
                    }),
                  ],
                }),
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: expense.exchangeRate ? (typeof expense.exchangeRate === 'number' ? expense.exchangeRate.toFixed(4) : String(expense.exchangeRate)) : '-',
                          size: 32,
                        }),
                      ],
                      alignment: AlignmentType.RIGHT,
                    }),
                  ],
                }),
              ],
            })
        ),
        // Total row
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Total',
                      bold: true,
                      size: 28,
                    }),
                  ],
                }),
              ],
              columnSpan: 3,
              shading: { fill: 'E5E7EB' },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: formatCurrencyForCode(totalOriginalAmount, originalCurrency),
                      bold: true,
                      size: 28,
                    }),
                  ],
                  alignment: AlignmentType.RIGHT,
                }),
              ],
              shading: { fill: 'E5E7EB' },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: originalCurrency,
                      bold: true,
                      size: 28,
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              shading: { fill: 'E5E7EB' },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: formatCurrencyForCode(totalBilledAmount, invoiceCurrency),
                      bold: true,
                      size: 28,
                    }),
                  ],
                  alignment: AlignmentType.RIGHT,
                }),
              ],
              shading: { fill: 'E5E7EB' },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: invoiceCurrency,
                      bold: true,
                      size: 28,
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              shading: { fill: 'E5E7EB' },
            }),
            new TableCell({
              children: [new Paragraph({ text: '' })],
              shading: { fill: 'E5E7EB' },
            }),
          ],
        }),
      ],
    }),
  ];
};

/**
 * Create Page 6: Partners & Split
 */
const createPartnersSplitPage = (data: InvoiceWordData, formatCurrency: (amount: number) => string): (Paragraph | Table)[] => {
  if (!data.partnerShares || data.partnerShares.length === 0) {
    return [
      new Paragraph({
        children: [
          new TextRun({
            text: 'Partners & Split',
            bold: true,
            size: 28,
          }),
        ],
        spacing: { after: 200 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: 'No partner shares assigned to this invoice.',
            size: 28,
          }),
        ],
      }),
    ];
  }

  const invoiceCurrency = data.invoiceCurrency || data.matterCurrency || 'INR';
  const totalPercentage = data.partnerShares.reduce((sum, p) => sum + p.percentage, 0);
  const totalAmount = data.partnerShares.reduce((sum, p) => sum + (data.amount * p.percentage / 100), 0);

  return [
    new Paragraph({
      children: [
        new TextRun({
          text: 'Partners & Split',
          bold: true,
                      size: 22,
        }),
      ],
      spacing: { after: 300 },
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Partner Name',
                      bold: true,
                      size: 28,
                    }),
                  ],
                }),
              ],
              width: { size: 25, type: WidthType.PERCENTAGE },
              shading: { fill: 'E5E7EB' },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Email',
                      bold: true,
                      size: 28,
                    }),
                  ],
                }),
              ],
              width: { size: 30, type: WidthType.PERCENTAGE },
              shading: { fill: 'E5E7EB' },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Share %',
                      bold: true,
                      size: 28,
                    }),
                  ],
                  alignment: AlignmentType.RIGHT,
                }),
              ],
              width: { size: 15, type: WidthType.PERCENTAGE },
              shading: { fill: 'E5E7EB' },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Share Amount',
                      bold: true,
                      size: 28,
                    }),
                  ],
                  alignment: AlignmentType.RIGHT,
                }),
              ],
              width: { size: 20, type: WidthType.PERCENTAGE },
              shading: { fill: 'E5E7EB' },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Currency',
                      bold: true,
                      size: 28,
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              width: { size: 10, type: WidthType.PERCENTAGE },
              shading: { fill: 'E5E7EB' },
            }),
          ],
        }),
        ...data.partnerShares.map(
          (partner) =>
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: partner.userName,
                          size: 32,
                        }),
                      ],
                    }),
                  ],
                }),
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: partner.userEmail || '-',
                          size: 32,
                        }),
                      ],
                    }),
                  ],
                }),
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: `${partner.percentage}%`,
                          size: 32,
                        }),
                      ],
                      alignment: AlignmentType.RIGHT,
                    }),
                  ],
                }),
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: formatCurrencyForCode(data.amount * partner.percentage / 100, invoiceCurrency),
                          size: 32,
                        }),
                      ],
                      alignment: AlignmentType.RIGHT,
                    }),
                  ],
                }),
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: invoiceCurrency,
                          size: 32,
                        }),
                      ],
                      alignment: AlignmentType.CENTER,
                    }),
                  ],
                }),
              ],
            })
        ),
        // Total row
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Total',
                      bold: true,
                      size: 28,
                    }),
                  ],
                }),
              ],
              columnSpan: 2,
              shading: { fill: 'E5E7EB' },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `${totalPercentage}%`,
                      bold: true,
                      size: 28,
                    }),
                  ],
                  alignment: AlignmentType.RIGHT,
                }),
              ],
              shading: { fill: 'E5E7EB' },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: formatCurrencyForCode(totalAmount, invoiceCurrency),
                      bold: true,
                      size: 28,
                    }),
                  ],
                  alignment: AlignmentType.RIGHT,
                }),
              ],
              shading: { fill: 'E5E7EB' },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: invoiceCurrency,
                      bold: true,
                      size: 28,
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              shading: { fill: 'E5E7EB' },
            }),
          ],
        }),
      ],
    }),
  ];
};

/**
 * Create Page 7: Summary
 */
const createSummaryPage = (data: InvoiceWordData, formatCurrency: (amount: number) => string): (Paragraph | Table)[] => {
  const invoiceCurrency = data.invoiceCurrency || data.matterCurrency || 'INR';
  const totalHours = data.lawyerFees ? data.lawyerFees.reduce((sum, l) => sum + l.hours, 0) : 0;
  const numberOfEntries = data.timesheetEntries ? data.timesheetEntries.length : 0;

  return [
    new Paragraph({
      children: [
        new TextRun({
          text: 'Invoice Summary',
          bold: true,
                      size: 22,
        }),
      ],
      spacing: { after: 400 },
    }),
    // Two-column layout using tables
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            // Left column
            new TableCell({
              children: [
                // Invoice Information box
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Invoice Information',
                      bold: true,
                      size: 28,
                    }),
                  ],
                  spacing: { after: 200 },
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Invoice Number: ${data.invoiceNumber}`,
                      size: 28,
                    }),
                  ],
                  spacing: { after: 100 },
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Invoice Date: ${formatDate(data.invoiceDate)}`,
                      size: 28,
                    }),
                  ],
                  spacing: { after: 100 },
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Due Date: ${formatDate(data.dueDate)}`,
                      size: 28,
                    }),
                  ],
                  spacing: { after: 100 },
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Status: ${data.status.charAt(0).toUpperCase() + data.status.slice(1).replace('_', ' ')}`,
                      size: 28,
                    }),
                  ],
                  spacing: { after: 100 },
                }),
                ...(data.billingLocation ? [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `Billing Location: ${data.billingLocation}`,
                        size: 28,
                      }),
                    ],
                    spacing: { after: 200 },
                  }),
                ] : []),
                // Client & Matter(s) box
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Client & Matter(s)',
                      bold: true,
                      size: 28,
                    }),
                  ],
                  spacing: { before: 200, after: 200 },
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Client: ${data.clientName}`,
                      size: 28,
                    }),
                  ],
                  spacing: { after: 100 },
                }),
                ...(data.matters && data.matters.length > 0 ? [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `Matter(s): ${data.matters.map(m => m.title).join(', ')}`,
                        size: 28,
                      }),
                    ],
                  }),
                ] : data.matterTitle ? [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `Matter: ${data.matterTitle}`,
                        size: 28,
                      }),
                    ],
                  }),
                ] : []),
              ],
              width: { size: 48, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1 },
                bottom: { style: BorderStyle.SINGLE, size: 1 },
                left: { style: BorderStyle.SINGLE, size: 1 },
                right: { style: BorderStyle.SINGLE, size: 1 },
              },
            }),
            // Right column
            new TableCell({
              children: [
                // Financial Summary box
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Financial Summary',
                      bold: true,
                      size: 28,
                    }),
                  ],
                  spacing: { after: 200 },
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Subtotal: ${formatCurrency(data.subtotal ?? data.amount)}`,
                      size: 28,
                    }),
                  ],
                  spacing: { after: 100 },
                }),
                ...(data.discountAmount && data.discountAmount > 0 ? [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `Discount: ${formatCurrency(data.discountAmount)}`,
                        size: 28,
                      }),
                    ],
                    spacing: { after: 100 },
                  }),
                ] : []),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Final Amount: ${formatCurrency(data.amount)}`,
                      bold: true,
                      size: 28,
                    }),
                  ],
                  spacing: { after: 100 },
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Amount Paid: ${formatCurrency(data.amountPaid)}`,
                      size: 28,
                    }),
                  ],
                  spacing: { after: 100 },
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Remaining: ${formatCurrency(data.remainingAmount)}`,
                      bold: true,
                      size: 28,
                      color: data.remainingAmount > 0 ? 'DC2626' : '16A34A',
                    }),
                  ],
                  spacing: { after: 200 },
                }),
                // Currency Breakdown box (if multi-currency)
                ...(data.exchangeRates && Object.keys(data.exchangeRates).length > 0 ? [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: 'Currency Breakdown',
                        bold: true,
                        size: 28,
                      }),
                    ],
                    spacing: { before: 200, after: 200 },
                  }),
                  ...Object.entries(data.exchangeRates).map(([currency, rate]) =>
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: `${currency}: ${rate.toFixed(4)}`,
                          size: 28,
                        }),
                      ],
                      spacing: { after: 100 },
                    })
                  ),
                ] : []),
              ],
              width: { size: 48, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1 },
                bottom: { style: BorderStyle.SINGLE, size: 1 },
                left: { style: BorderStyle.SINGLE, size: 1 },
                right: { style: BorderStyle.SINGLE, size: 1 },
              },
            }),
          ],
        }),
      ],
    }),
    // Timesheet Summary box
    ...(data.timesheetEntries && data.timesheetEntries.length > 0 ? [
      new Paragraph({
        children: [
          new TextRun({
            text: 'Timesheet Summary',
            bold: true,
            size: 28,
          }),
        ],
        spacing: { before: 300, after: 200 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `Total Hours: ${formatNumber(totalHours)}`,
            size: 28,
          }),
        ],
        spacing: { after: 100 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `Number of Entries: ${numberOfEntries}`,
            size: 28,
          }),
        ],
        spacing: { after: 100 },
      }),
      ...(data.periodFrom && data.periodTo ? [
        new Paragraph({
          children: [
            new TextRun({
              text: `Date Range: ${formatDate(data.periodFrom)} to ${formatDate(data.periodTo)}`,
              size: 28,
            }),
          ],
        }),
      ] : []),
    ] : []),
    // Partner Attribution box (if exists)
    ...(data.partnerShares && data.partnerShares.length > 0 ? [
      new Paragraph({
        children: [
          new TextRun({
            text: 'Partner Attribution',
            bold: true,
            size: 28,
          }),
        ],
        spacing: { before: 300, after: 200 },
      }),
      ...data.partnerShares.map((partner) =>
        new Paragraph({
          children: [
            new TextRun({
              text: `${partner.userName}: ${partner.percentage}%`,
              size: 28,
            }),
          ],
          spacing: { after: 100 },
        })
      ),
    ] : []),
    // Payment History table (if payments exist)
    ...(data.payments && data.payments.length > 0 ? [
      new Paragraph({
        children: [
          new TextRun({
            text: 'Payment History',
            bold: true,
            size: 28,
          }),
        ],
        spacing: { before: 300, after: 200 },
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: 'Payment Date',
                        bold: true,
                        size: 28,
                      }),
                    ],
                  }),
                ],
                width: { size: 25, type: WidthType.PERCENTAGE },
                shading: { fill: 'E5E7EB' },
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: 'Amount',
                        bold: true,
                        size: 28,
                      }),
                    ],
                    alignment: AlignmentType.RIGHT,
                  }),
                ],
                width: { size: 20, type: WidthType.PERCENTAGE },
                shading: { fill: 'E5E7EB' },
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: 'Method',
                        bold: true,
                        size: 28,
                      }),
                    ],
                    alignment: AlignmentType.CENTER,
                  }),
                ],
                width: { size: 15, type: WidthType.PERCENTAGE },
                shading: { fill: 'E5E7EB' },
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: 'Transaction Ref',
                        bold: true,
                        size: 28,
                      }),
                    ],
                  }),
                ],
                width: { size: 25, type: WidthType.PERCENTAGE },
                shading: { fill: 'E5E7EB' },
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: 'Notes',
                        bold: true,
                        size: 28,
                      }),
                    ],
                  }),
                ],
                width: { size: 15, type: WidthType.PERCENTAGE },
                shading: { fill: 'E5E7EB' },
              }),
            ],
          }),
          ...data.payments.map(
            (payment) =>
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: formatDate(payment.paymentDate),
                            size: 32,
                          }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: formatCurrencyForCode(payment.amount, invoiceCurrency),
                            size: 32,
                          }),
                        ],
                        alignment: AlignmentType.RIGHT,
                      }),
                    ],
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: payment.paymentMethod.replace('_', ' ').toUpperCase(),
                            size: 32,
                          }),
                        ],
                        alignment: AlignmentType.CENTER,
                      }),
                    ],
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: payment.transactionRef || '-',
                            size: 32,
                          }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: payment.notes || '-',
                            size: 32,
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              })
          ),
        ],
      }),
    ] : []),
  ];
};

export const createInvoiceWordDocument = ({ data }: InvoiceWordDocumentProps): Document => {
  // ✅ Create formatCurrency function with data closure for currency support
  const formatCurrency = createFormatCurrency(data);

  return new Document({
    sections: [
      {
        children: createLetterPage(data, formatCurrency),
      },
      {
        children: createInvoiceDetailsPage(data, formatCurrency),
      },
      {
        children: createItemizedTimesheetEntriesPage(data, formatCurrency),
      },
      {
        children: createTimesheetsSummaryPage(data, formatCurrency),
      },
      {
        children: createExpensesPage(data, formatCurrency),
      },
      {
        children: createPartnersSplitPage(data, formatCurrency),
      },
      {
        children: createSummaryPage(data, formatCurrency),
      },
    ],
  });
};

export default createInvoiceWordDocument;
