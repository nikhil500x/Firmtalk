'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertTriangle, Download, Upload } from 'lucide-react';
import { toast } from 'react-toastify';

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
  resultsFile?: string; // Base64 encoded Excel file
}

interface BulkUploadReportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: UploadResult;
  onUploadAnother: () => void;
}

export default function BulkUploadReport({
  open,
  onOpenChange,
  result,
  onUploadAnother,
}: BulkUploadReportProps) {
  const handleDownloadReport = () => {
    if (result.resultsFile) {
      // Download Excel file from base64
      try {
        // Convert base64 to binary
        const binaryString = window.atob(result.resultsFile);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        const blob = new Blob([bytes], { 
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bulk_upload_results_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } catch (error) {
        console.error('Error downloading Excel file:', error);
        // alert('Failed to download Excel file. Please try again.');
        toast.error('Failed to download Excel file. Please try again.');
      }
    } else {
      // Fallback to JSON if Excel file not available
      const reportData = {
        summary: {
          groupsCreated: result.groupsCreated,
          groupsExisting: result.groupsExisting,
          clientsCreated: result.clientsCreated,
          clientsExisting: result.clientsExisting,
          contactsCreated: result.contactsCreated,
          totalErrors: result.errors.length,
          totalWarnings: result.warnings.length,
        },
        createdGroups: result.createdGroups,
        createdClients: result.createdClients,
        createdContacts: result.createdContacts,
        errors: result.errors,
        warnings: result.warnings,
      };

      const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bulk_upload_report_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }
  };

  const totalProcessed = result.groupsCreated + result.groupsExisting + 
                         result.clientsCreated + result.clientsExisting + 
                         result.contactsCreated;
  const hasErrors = result.errors.length > 0;
  const hasWarnings = result.warnings.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {hasErrors ? (
              <XCircle className="h-5 w-5 text-red-600" />
            ) : (
              <CheckCircle className="h-5 w-5 text-green-600" />
            )}
            Bulk Upload {hasErrors ? 'Completed with Errors' : 'Completed Successfully'}
          </DialogTitle>
          <DialogDescription>
            {totalProcessed} records processed. Review the details below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Summary Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm text-gray-600">Groups</p>
              <p className="text-2xl font-bold">
                {result.groupsCreated + result.groupsExisting}
              </p>
              <p className="text-xs text-gray-500">
                {result.groupsCreated} created, {result.groupsExisting} existing
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Clients</p>
              <p className="text-2xl font-bold">
                {result.clientsCreated + result.clientsExisting}
              </p>
              <p className="text-xs text-gray-500">
                {result.clientsCreated} created, {result.clientsExisting} existing
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Contacts</p>
              <p className="text-2xl font-bold">{result.contactsCreated}</p>
              <p className="text-xs text-gray-500">created</p>
            </div>
          </div>

          {/* Errors Section */}
          {hasErrors && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <h3 className="text-sm font-semibold text-red-900 mb-2 flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                Errors ({result.errors.length})
              </h3>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {result.errors.map((error, idx) => (
                  <p key={idx} className="text-xs text-red-800">
                    {error.row > 0 ? `Row ${error.row}: ` : ''}{error.message}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Warnings Section */}
          {hasWarnings && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h3 className="text-sm font-semibold text-yellow-900 mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Warnings ({result.warnings.length})
              </h3>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {result.warnings.map((warning, idx) => (
                  <p key={idx} className="text-xs text-yellow-800">
                    {warning.row > 0 ? `Row ${warning.row}: ` : ''}{warning.message}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Created Groups */}
          {result.createdGroups.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">
                Created Groups ({result.createdGroups.length})
              </h3>
              <div className="space-y-1">
                {result.createdGroups.map((group) => (
                  <div
                    key={group.id}
                    className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded text-sm"
                  >
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="font-medium">{group.name}</span>
                    <Badge variant="outline" className="text-xs">ID: {group.id}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Created Clients */}
          {result.createdClients.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">
                Created Clients ({result.createdClients.length})
              </h3>
              <div className="space-y-1">
                {result.createdClients.map((client) => (
                  <div
                    key={client.id}
                    className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded text-sm"
                  >
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="font-medium">{client.name}</span>
                    <span className="text-xs text-gray-500">({client.groupName})</span>
                    <Badge variant="outline" className="text-xs">ID: {client.id}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Created Contacts */}
          {result.createdContacts.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">
                Created Contacts ({result.createdContacts.length})
              </h3>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {result.createdContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded text-sm"
                  >
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="font-medium">{contact.name}</span>
                    <span className="text-xs text-gray-500">{contact.email}</span>
                    <span className="text-xs text-gray-400">({contact.clientName})</span>
                    <Badge variant="outline" className="text-xs">ID: {contact.id}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleDownloadReport}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Download Report
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={onUploadAnother}
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              Upload Another
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

