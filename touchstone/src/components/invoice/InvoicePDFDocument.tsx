'use client';

import React from 'react';
import { getLocation } from '@/lib/location-constants';
import { Document, Page, Text, View, StyleSheet,Image } from '@react-pdf/renderer';

// Define styles for PDF
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },
  headerImage: {
    width: '30%',
    height: 'auto',
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 30,
    paddingBottom: 20,
    borderBottom: '2 solid #333333',
  },
  companyInfo: {
    flex: 1,
  },
  companyName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1a1a1a',
  },
  companyDetails: {
    fontSize: 9,
    lineHeight: 1.4,
    color: '#555555',
  },
  invoiceTitle: {
    textAlign: 'right',
    flex: 1,
  },
  companyContactInfo: {
    textAlign: 'right',
    fontSize: 9,
    lineHeight: 1.6,
    color: '#555555',
  },
  invoiceTitleText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2563eb',
    marginBottom: 8,
  },
  invoiceNumber: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#333333',
  },
  detailsSection: {
    flexDirection: 'row',
    marginBottom: 30,
  },
  billTo: {
    flex: 1,
    marginRight: 20,
  },
  invoiceDetails: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#666666',
    textTransform: 'uppercase',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  clientName: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#1a1a1a',
  },
  detailText: {
    fontSize: 9,
    lineHeight: 1.4,
    color: '#555555',
    marginBottom: 2,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    fontSize: 9,
  },
  detailLabel: {
    color: '#666666',
  },
  detailValue: {
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  descriptionSection: {
    marginBottom: 30,
  },
  descriptionTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#666666',
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottom: '1 solid #e5e7eb',
  },
  descriptionText: {
    fontSize: 10,
    lineHeight: 1.6,
    color: '#333333',
    marginTop: 10,
  },
  amountSection: {
    marginBottom: 30,
    backgroundColor: '#f9fafb',
    padding: 20,
    borderRadius: 8,
    border: '1 solid #e5e7eb',
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  amountLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#333333',
  },
  amountValue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    marginTop: 12,
    borderTop: '1 solid #d1d5db',
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  notesSection: {
    marginBottom: 20,
  },
  notesTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#666666',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  notesText: {
    fontSize: 9,
    lineHeight: 1.5,
    color: '#555555',
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 4,
    border: '1 solid #e5e7eb',
  },
  paymentTerms: {
    marginTop: 30,
    paddingTop: 20,
    borderTop: '2 solid #e5e7eb',
  },
  paymentTermsTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#666666',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  paymentTermsList: {
    fontSize: 9,
    lineHeight: 1.6,
    color: '#555555',
  },
  footer: {
    marginTop: 40,
    paddingTop: 20,
    borderTop: '1 solid #e5e7eb',
    textAlign: 'center',
  },
  footerText: {
    fontSize: 8,
    color: '#888888',
    lineHeight: 1.5,
  },
  // Second page styles
  pageTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 20,
    textTransform: 'uppercase',
    color: '#1a1a1a',
  },
  table: {
    marginTop: 10,
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    padding: 8,
    borderBottom: '1 solid #d1d5db',
    fontWeight: 'bold',
    fontSize: 9,
  },
  tableRow: {
    flexDirection: 'row',
    padding: 8,
    borderBottom: '1 solid #e5e7eb',
    fontSize: 9,
  },
  tableRowBold: {
    flexDirection: 'row',
    padding: 8,
    borderTop: '2 solid #333333',
    borderBottom: '2 solid #333333',
    fontWeight: 'bold',
    fontSize: 9,
  },
  colLawyer: {
    width: '35%',
  },
  colHours: {
    width: '20%',
    textAlign: 'right',
  },
  colRate: {
    width: '25%',
    textAlign: 'right',
  },
  colFees: {
    width: '20%',
    textAlign: 'right',
  },
  sectionHeading: {
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
    color: '#1a1a1a',
  },
});

interface LawyerFee {
  lawyerName: string;
  lawyerRole: string; // Partner, Senior Associate, Associate, etc.
  hours: number;
  hourlyRate: number;
  fees: number;
}

interface TimesheetEntry {
  timesheetId: number;
  date: string;
  lawyerName: string;
  lawyerRole: string;
  description: string;
  hours: number;
  hourlyRate: number;
  fees: number;
}

interface InvoicePDFData {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  clientName: string;
  clientAddress?: string;
  matterTitle?: string;
  periodFrom?: string; // Matter start_date
  periodTo?: string; // Matter estimated_deadline
  amount: number;
  lawyerFees?: LawyerFee[]; // Optional: breakdown by lawyer (old format)
  timesheetEntries?: TimesheetEntry[]; // New: individual timesheet entries
  disbursements?: number; // Optional: disbursements/expenses
  companyName?: string;
  companyAddress?: string;
  companyEmail?: string;
  companyPhone?: string;
  billingLocation?: string; // ✅ ADD THIS LINE
  headerImageUrl?: string; // Add this line
  // ✅ Currency fields
  matterCurrency?: string;
  invoiceCurrency?: string;
  userExchangeRate?: number | null;
  amountInINR?: number | null;
}

interface InvoicePDFDocumentProps {
  data: InvoicePDFData;
}

const InvoicePDFDocument: React.FC<InvoicePDFDocumentProps> = ({ data }) => {
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatYear = (dateString: string): string => {
    const date = new Date(dateString);
    return date.getFullYear().toString();
  };

  const formatCurrency = (amount: number, currency?: string): string => {
    const currencyCode = currency || data.invoiceCurrency || data.matterCurrency || 'INR';
    // Import currencyUtils if available, otherwise use simple formatting
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

  const location = getLocation(data.billingLocation);


  // Default company info
  // const companyInfo = {
  //   name: data.companyName || 'Touchstone Partners',
  //   address: data.companyAddress || 'One BKC, 808 B, Tower C,\nBandra Kurla Complex,\nMumbai – 400051',
  //   email: data.companyEmail || 'accounts@touchstonepartners.com',
  //   phone: data.companyPhone || '+91 22 69134305',
  //   website: 'touchstonepartners.com',
  // };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* HEADER */}
        <View style={styles.header}>
          {/* HEADER IMAGE */}
          <Image 
            src={data.headerImageUrl || '/images/TouchStonePartnersBlackLogo.png'}
            style={styles.headerImage} 
          />

          {/* Company Contact Info */}
          <View style={styles.invoiceTitle}>
            {location.addressLines.map((line, idx) => (
              <Text key={idx} style={styles.companyContactInfo}>{line}</Text>
            ))}
            <Text style={styles.companyContactInfo}>Tel: {location.phone}</Text>
            {location.fax && (
              <Text style={styles.companyContactInfo}>F: {location.fax}</Text>
            )}
            <Text style={styles.companyContactInfo}>E: {location.email}</Text>
            <Text style={styles.companyContactInfo}>W: {location.website}</Text>
          </View>
        </View>

        {/* Client Name */}
        <View style={{ marginBottom: 20 }}>
          <Text style={[styles.detailText, { fontWeight: 'bold' }]}>{data.clientName}</Text>
        </View>

        {/* Matter and Period */}
        <View style={{ marginBottom: 30 }}>
          {data.matterTitle && (
            <Text style={[styles.detailText, { marginBottom: 4 }]}>
              <Text style={{ fontWeight: 'bold' }}>Matter name:</Text> {data.matterTitle}
            </Text>
          )}
          {data.periodFrom && data.periodTo && (
            <Text style={styles.detailText}>
              <Text style={{ fontWeight: 'bold' }}>Period from:</Text> {formatDate(data.periodFrom)} to {formatDate(data.periodTo)}
            </Text>
          )}
        </View>

        {/* Salutation */}
        <View style={{ marginBottom: 20 }}>
          <Text style={styles.detailText}>Dear</Text>
        </View>

        
        {/* Introduction Text */}
        <View style={{ marginBottom: 20 }}>
          <Text style={styles.detailText}>
            Please find enclosed our draft invoice for legal services rendered.
          </Text>
        </View>

        {/* Payment Instructions */}
        <View style={{ marginBottom: 20 }}>
          <Text style={styles.detailText}>
            I should be grateful if you would arrange to have the amount remitted to our account with Standard Chartered Bank, Malcha Marg, Chanakyapuri, New Delhi, India (IFSC Code: SCBL0036031). The account name is Touchstone Partners and the account number is 524-0-509555-0. Our PAN no. is AASFP3948G.
          </Text>
        </View>

        <View style={{ marginBottom: 20 }}>
          <Text style={styles.detailText}>
            In the alternative, you could also have a cheque in the appropriate amount and in the name of &quot;Touchstone Partners&quot;, to be dispatched to the above address.
          </Text>
        </View>

        <View style={{ marginBottom: 20 }}>
          <Text style={styles.detailText}>
            Please pay GST on the invoice value directly to government under Reverse Charge Mechanism in terms of Sr.No.2 of Notification No.13/2017-Central Tax (Rate) dt. 28 June 2017 read with section 20 of the IGST Act, 2017.
          </Text>
        </View>

        <View style={{ marginBottom: 30 }}>
          <Text style={styles.detailText}>
            I trust you find this to be in order.
          </Text>
        </View>

        <View style={{ marginBottom: 10 }}>
          <Text style={styles.detailText}>Yours faithfully</Text>
        </View>

        <View style={{ marginBottom: 20 }}>
          <Text style={[styles.detailText, { fontWeight: 'bold' }]}>
            Accounts Team, Firmtalk
          </Text>
        </View>

      </Page>

      {/* SECOND PAGE - Fee Breakdown */}
      <Page size="A4" style={styles.page}>
        {/* HEADER */}
        <View style={styles.header}>
          {/* HEADER IMAGE */}
          <Image 
            src={data.headerImageUrl || '/images/TouchStonePartnersBlackLogo.png'}
            style={styles.headerImage} 
          />

          {/* Invoice Info */}
          <View style={styles.invoiceTitle}>
            {location.addressLines.map((line, idx) => (
              <Text key={idx} style={styles.companyContactInfo}>{line}</Text>
            ))}
            <Text style={styles.companyContactInfo}>Tel: {location.phone}</Text>
            {location.fax && (
              <Text style={styles.companyContactInfo}>F: {location.fax}</Text>
            )}
            <Text style={styles.companyContactInfo}>E: {location.email}</Text>
            <Text style={styles.companyContactInfo}>W: {location.website}</Text>
          </View>
        </View>

        {/* Client Name */}
        <View style={{ marginBottom: 20 }}>
          <Text style={[styles.detailText, { fontWeight: 'bold' }]}>{data.clientName}</Text>
        </View>

        {/* Invoice Title */}
        <View style={{ marginBottom: 20 }}>
          <Text style={styles.pageTitle}>
            DRAFT INVOICE FOR LEGAL SERVICES RENDERED (INVOICE NO. {data.invoiceNumber}) – {data.matterTitle?.toUpperCase() || 'MATTER NAME'} – PERIOD FROM {data.periodFrom ? formatDate(data.periodFrom).toUpperCase() : '[•]'}
          </Text>
        </View>

        {/* Introduction */}
        <View style={{ marginBottom: 10 }}>
          <Text style={[styles.detailText, { fontWeight: 'bold' }]}>
            Fees for legal services rendered in connection with:
          </Text>
        </View>

        <View style={{ marginBottom: 20, paddingLeft: 20 }}>
          <Text style={styles.detailText}>• {data.matterTitle || '[Matter Name]'}</Text>
        </View>

        {/* Fees Section */}
        <View style={{ marginBottom: 20 }}>
          <Text style={styles.sectionHeading}>Fees</Text>

          {/* Fees Table */}
          <View style={styles.table}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <Text style={styles.colLawyer}>
                Client – Matter name{'\n'}Period from {data.periodFrom ? formatDate(data.periodFrom) : '[•]'}
              </Text>
              <Text style={styles.colHours}></Text>
              <Text style={styles.colRate}></Text>
              <Text style={styles.colFees}></Text>
            </View>

            {/* Column Headers */}
            <View style={styles.tableHeader}>
              <Text style={styles.colLawyer}>Lawyer(s)</Text>
              <Text style={styles.colHours}>Hours</Text>
              <Text style={styles.colRate}>Hourly Rate</Text>
              <Text style={styles.colFees}>Fees</Text>
            </View>

            {/* Lawyer Rows - Use lawyerFees (grouped data) */}
            {data.lawyerFees && data.lawyerFees.length > 0 ? (
              <>
                {data.lawyerFees.map((lawyer, index) => (
                  <View key={index} style={styles.tableRow}>
                    <Text style={styles.colLawyer}>
                      {lawyer.lawyerName} ({lawyer.lawyerRole})
                    </Text>
                    <Text style={styles.colHours}>{formatNumber(lawyer.hours)}</Text>
                    <Text style={styles.colRate}>{formatCurrency(lawyer.hourlyRate, data.invoiceCurrency || data.matterCurrency)}</Text>
                    <Text style={styles.colFees}>{formatCurrency(lawyer.fees, data.invoiceCurrency || data.matterCurrency)}</Text>
                  </View>
                ))}

                {/* Sub-Total */}
                <View style={styles.tableRow}>
                  <Text style={[styles.colLawyer, { fontWeight: 'bold' }]}>Sub-Total</Text>
                  <Text style={[styles.colHours, { fontWeight: 'bold' }]}>
                    {formatNumber(data.lawyerFees.reduce((sum, l) => sum + l.hours, 0))}
                  </Text>
                  <Text style={styles.colRate}></Text>
                  <Text style={[styles.colFees, { fontWeight: 'bold' }]}>
                    {formatCurrency(data.lawyerFees.reduce((sum, l) => sum + l.fees, 0), data.invoiceCurrency || data.matterCurrency)}
                  </Text>
                </View>
              </>
            ) : data.timesheetEntries && data.timesheetEntries.length > 0 ? (
                <>
                {data.timesheetEntries.map((entry, index) => (
                  <View key={index} style={styles.tableRow}>
                    <Text style={styles.colLawyer}>{entry.lawyerName} ({entry.lawyerRole})</Text>
                    <Text style={styles.colHours}>{formatNumber(entry.hours)}</Text>
                    <Text style={styles.colRate}>{formatCurrency(entry.hourlyRate, data.invoiceCurrency || data.matterCurrency)}</Text>
                    <Text style={styles.colFees}>{formatCurrency(entry.fees, data.invoiceCurrency || data.matterCurrency)}</Text>
                  </View>
                ))}

                {/* Sub-Total */}
                <View style={styles.tableRow}>
                  <Text style={[styles.colLawyer, { fontWeight: 'bold' }]}>Sub-Total</Text>
                  <Text style={[styles.colHours, { fontWeight: 'bold' }]}>
                    {formatNumber(data.timesheetEntries.reduce((sum, entry) => sum + entry.hours, 0))}
                  </Text>
                  <Text style={styles.colRate}></Text>
                  <Text style={[styles.colFees, { fontWeight: 'bold' }]}>
                    {formatCurrency(data.timesheetEntries.reduce((sum, entry) => sum + entry.fees, 0), data.invoiceCurrency || data.matterCurrency)}
                  </Text>
                </View>
              </>
            ) : (
              <>
                {/* Default placeholder rows */}
                <View style={styles.tableRow}>
                  <Text style={styles.colLawyer}>Partner</Text>
                  <Text style={styles.colHours}>00.00</Text>
                  <Text style={styles.colRate}>{(data.invoiceCurrency || data.matterCurrency || 'INR')} [•]</Text>
                  <Text style={styles.colFees}>0.00</Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.colLawyer}>Senior Associate</Text>
                  <Text style={styles.colHours}>00.00</Text>
                  <Text style={styles.colRate}>{(data.invoiceCurrency || data.matterCurrency || 'INR')} [•]</Text>
                  <Text style={styles.colFees}>0.00</Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.colLawyer}>Associate</Text>
                  <Text style={styles.colHours}>00.00</Text>
                  <Text style={styles.colRate}>{(data.invoiceCurrency || data.matterCurrency || 'INR')} [•]</Text>
                  <Text style={styles.colFees}>0.00</Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={[styles.colLawyer, { fontWeight: 'bold' }]}>Sub-Total</Text>
                  <Text style={[styles.colHours, { fontWeight: 'bold' }]}>00.00</Text>
                  <Text style={styles.colRate}></Text>
                  <Text style={[styles.colFees, { fontWeight: 'bold' }]}>INR 0.00</Text>
                </View>
              </>
            )}

            {/* Total Fees */}
            <View style={styles.tableRowBold}>
              <Text style={styles.colLawyer}></Text>
              <Text style={styles.colHours}></Text>
              <Text style={styles.colRate}>Total Fees</Text>
              <Text style={styles.colFees}>{formatCurrency(data.amount, data.invoiceCurrency || data.matterCurrency)}</Text>
            </View>
          </View>
        </View>

        {/* Disbursements Section
        <View style={{ marginBottom: 20 }}>
          <Text style={styles.sectionHeading}>Disbursements</Text>
          <Text style={styles.detailText}>
            {data.disbursements ? formatCurrency(data.disbursements, data.invoiceCurrency || data.matterCurrency) : 'NIL'}
          </Text>
        </View> */}

        {/* Invoice Total */}
        <View style={{ marginTop: 10 }}>
          <Text style={[styles.sectionHeading, { fontSize: 12 }]}>Invoice Total</Text>
          <Text style={[styles.detailText, { fontWeight: 'bold', fontSize: 11 }]}>
            {formatCurrency(data.amount + (data.disbursements || 0), data.invoiceCurrency || data.matterCurrency)}
            {data.amountInINR && (
              <Text style={{ fontSize: 10, color: '#666666' }}>
                {' '}(≈ {formatCurrency(data.amountInINR, 'INR')} INR)
              </Text>
            )}
          </Text>
        </View>

      </Page>
    </Document>
  );
};

export default InvoicePDFDocument;

