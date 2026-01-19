'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { API_ENDPOINTS, API_BASE_URL } from '@/lib/api';
import { toast } from 'react-toastify';
import { X } from 'lucide-react';

interface FinalizeInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: number;
  invoiceAmount: number;
  onSuccess: () => void;
}

interface Client {
  id: number;
  name: string;
  code: string;
}

interface Split {
  clientId: number;
  percentage: number;
}

interface PartnerShare {
  userId: number;
  percentage: number;
}

export default function FinalizeInvoiceDialog({
  open,
  onOpenChange,
  invoiceId,
  invoiceAmount,
  onSuccess,
}: FinalizeInvoiceDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [groupClients, setGroupClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [enableSplit, setEnableSplit] = useState(false);
  const [splits, setSplits] = useState<Split[]>([]);
  const [partnerShares, setPartnerShares] = useState<PartnerShare[]>([
    { userId: 0, percentage: 100 },
  ]);
  const [availablePartners, setAvailablePartners] = useState<Array<{ id: number; name: string }>>([]);
  const [clientId, setClientId] = useState<number | null>(null);

  // Fetch group clients
  useEffect(() => {
    const fetchInvoiceData = async () => {
      if (!open || !invoiceId) return;

      try {
        const response = await fetch(`${API_BASE_URL}/api/invoices/${invoiceId}`, {
          credentials: 'include',
        });

        if (!response.ok) throw new Error('Failed to fetch invoice');

        const data = await response.json();
        setClientId(data.data.clientId);

        // Fetch group clients
        setLoadingClients(true);
        const clientsResponse = await fetch(
          `${API_BASE_URL}/api/clients/${data.data.clientId}/group-clients`,
          { credentials: 'include' }
        );

        if (clientsResponse.ok) {
          const clientsData = await clientsResponse.json();
          setGroupClients(clientsData.data || []);
        }
      } catch (error) {
        console.error('Error fetching invoice data:', error);
      } finally {
        setLoadingClients(false);
      }
    };

    fetchInvoiceData();
  }, [open, invoiceId]);

  // Fetch partners
  useEffect(() => {
    const fetchPartners = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/users?role=partner`, {
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          setAvailablePartners(data.data || []);
          
          // Default to first partner if available
          if (data.data && data.data.length > 0 && partnerShares[0].userId === 0) {
            setPartnerShares([{ userId: data.data[0].id, percentage: 100 }]);
          }
        }
      } catch (error) {
        console.error('Error fetching partners:', error);
      }
    };

    if (open) {
      fetchPartners();
    }
  }, [open]);

  const handleSplitToggle = (checked: boolean) => {
    setEnableSplit(checked);
    if (!checked) {
      setSplits([]);
    }
  };

  const handleClientToggle = (clientId: number, checked: boolean) => {
    if (checked) {
      setSplits([...splits, { clientId, percentage: 0 }]);
    } else {
      setSplits(splits.filter(s => s.clientId !== clientId));
    }
  };

  const updateSplitPercentage = (clientId: number, percentage: number) => {
    setSplits(splits.map(s => 
      s.clientId === clientId ? { ...s, percentage } : s
    ));
  };

  const addPartner = () => {
    if (availablePartners.length > 0) {
      const nextPartner = availablePartners.find(p => 
        !partnerShares.some(ps => ps.userId === p.id)
      );
      if (nextPartner) {
        setPartnerShares([...partnerShares, { userId: nextPartner.id, percentage: 0 }]);
      }
    }
  };

  const removePartner = (index: number) => {
    setPartnerShares(partnerShares.filter((_, i) => i !== index));
  };

  const updatePartnerPercentage = (index: number, percentage: number) => {
    const updated = [...partnerShares];
    updated[index].percentage = percentage;
    setPartnerShares(updated);
  };

  const splitTotal = splits.reduce((sum, s) => sum + s.percentage, 0);
  const partnerTotal = partnerShares.reduce((sum, ps) => sum + ps.percentage, 0);

  const canFinalize = 
    (!enableSplit || splits.length === 0 || Math.abs(splitTotal - 100) < 0.01) &&
    partnerShares.length > 0 &&
    Math.abs(partnerTotal - 100) < 0.01 &&
    partnerShares.every(ps => ps.userId > 0);

  const handleFinalize = async () => {
    if (!canFinalize) {
      toast.error('Please ensure all percentages total 100%');
      return;
    }

    setIsLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload: any = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
        partnerShares: partnerShares.filter(ps => ps.userId > 0),
      };

      if (enableSplit && splits.length > 0) {
        payload.splits = splits;
      }

      const response = await fetch(`${API_BASE_URL}/api/invoices/${invoiceId}/finalize`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to finalize invoice');
      }

      toast.success(data.message || 'Invoice finalized successfully');
      onSuccess();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onOpenChange(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error('Error finalizing invoice:', error);
      toast.error(error.message || 'Failed to finalize invoice');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Finalize Invoice</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Invoice Split Section */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="enable-split"
                checked={enableSplit}
                onCheckedChange={handleSplitToggle}
              />
              <Label htmlFor="enable-split" className="text-lg font-semibold">
                Split Invoice Between Group Clients
              </Label>
            </div>

            {enableSplit && (
              <div className="ml-8 space-y-4 border-l-2 border-gray-200 pl-4">
                {loadingClients ? (
                  <p className="text-sm text-gray-500">Loading clients...</p>
                ) : groupClients.length === 0 ? (
                  <p className="text-sm text-gray-500">No group clients available</p>
                ) : (
                  <>
                    <div className="space-y-2">
                      {groupClients.map(client => (
                        <div key={client.id} className="flex items-center space-x-4">
                          <Checkbox
                            checked={splits.some(s => s.clientId === client.id)}
                            onCheckedChange={(checked) => 
                              handleClientToggle(client.id, checked as boolean)
                            }
                          />
                          <Label className="flex-1">{client.name}</Label>
                          {splits.some(s => s.clientId === client.id) && (
                            <div className="flex items-center space-x-2">
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={splits.find(s => s.clientId === client.id)?.percentage || 0}
                                onChange={(e) => 
                                  updateSplitPercentage(client.id, parseFloat(e.target.value) || 0)
                                }
                                className="w-24"
                              />
                              <span className="text-sm text-gray-500">%</span>
                              <span className="text-sm font-medium">
                                = {((invoiceAmount * (splits.find(s => s.clientId === client.id)?.percentage || 0)) / 100).toFixed(2)}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {splits.length > 0 && (
                      <div className="pt-2 border-t">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold">Total:</span>
                          <span className={`font-semibold ${Math.abs(splitTotal - 100) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                            {splitTotal.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Partner Attribution Section */}
          <div className="space-y-4">
            <Label className="text-lg font-semibold">Partner Attribution</Label>
            <div className="space-y-3">
              {partnerShares.map((ps, index) => (
                <div key={index} className="flex items-center space-x-4">
                  <Select
                    value={ps.userId.toString()}
                    onValueChange={(value) => {
                      const updated = [...partnerShares];
                      updated[index].userId = parseInt(value);
                      setPartnerShares(updated);
                    }}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select partner" />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePartners.map(partner => (
                        <SelectItem key={partner.id} value={partner.id.toString()}>
                          {partner.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center space-x-2">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={ps.percentage}
                      onChange={(e) => 
                        updatePartnerPercentage(index, parseFloat(e.target.value) || 0)
                      }
                      className="w-24"
                    />
                    <span className="text-sm text-gray-500">%</span>
                  </div>
                  {partnerShares.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removePartner(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" onClick={addPartner} className="w-full">
                + Add Partner
              </Button>
            </div>
            <div className="flex justify-between items-center pt-2 border-t">
              <span className="font-semibold">Total:</span>
              <span className={`font-semibold ${Math.abs(partnerTotal - 100) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                {partnerTotal.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleFinalize} disabled={!canFinalize || isLoading}>
            {isLoading ? 'Finalizing...' : 'Finalize Invoice'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

