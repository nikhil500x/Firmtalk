'use client';

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { TrendingUp } from 'lucide-react';

interface BillableSplitProps {
  data: {
    chartData: Array<{ name: string; hours: number }>;
    billableHours: number;
    nonBillableHours: number;
    billablePercentage: number | string;
  };
}

const COLORS = {
  billable: '#3b82f6',
  nonBillable: '#ef4444',
};

export const BillableSplit: React.FC<BillableSplitProps> = ({ data }) => {
  const chartData =
    data?.chartData?.length > 0
      ? data.chartData
      : [
          { name: 'Billable', hours: data?.billableHours || 0 },
          { name: 'Non-Billable', hours: data?.nonBillableHours || 0 },
        ];

  const safeChartData = chartData.map((item, idx) => ({
    name: item?.name ?? (idx === 0 ? 'Billable' : 'Non-Billable'),
    hours: Number(item?.hours ?? 0),
  }));

  const hasData = safeChartData.some((item) => item.hours > 0);
  const billablePercentage = Number(data?.billablePercentage ?? 0);
  const normalizedBillablePercentage = Number.isFinite(billablePercentage) ? billablePercentage : 0;

  const getSliceColor = (name: string) => {
    const normalized = (name || '').toLowerCase();
    return normalized.includes('non') ? COLORS.nonBillable : COLORS.billable;
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 h-full flex flex-col gap-3 overflow-hidden">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          Billable vs Non-Billable
        </h3>
      </div>

      {hasData ? (
        <>
          <ResponsiveContainer width="100%" height={170}>
            <PieChart>
              <Pie
                data={safeChartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                labelLine={false}
                dataKey="hours"
                label={({ name, percent }: { name?: string; percent?: number }) =>
                  `${name || 'Unknown'}: ${((percent || 0) * 100).toFixed(0)}%`
                }
              >
                {safeChartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={getSliceColor(entry.name)}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(value: unknown) => {
                if (value === null || value === undefined) return '0h';
                const numValue = typeof value === 'number' ? value : parseFloat(String(value)) || 0;
                return `${numValue.toFixed(1)}h`;
              }} />
            </PieChart>
          </ResponsiveContainer>

          <div className="space-y-0 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Billable Hours</span>
              <span className="font-semibold text-blue-600">
                {(data?.billableHours ?? 0).toFixed(1)}h
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Non-Billable Hours</span>
              <span className="font-semibold text-red-600">
                {(data?.nonBillableHours ?? 0).toFixed(1)}h
              </span>
            </div>
            <div className="flex justify-between font-semibold text-blue-600 pt-2 border-t border-gray-100">
              <span>Billable Rate</span>
              <span>{normalizedBillablePercentage.toFixed(1)}%</span>
            </div>
          </div>
        </>
      ) : (
        <p className="text-gray-500 text-center py-10">No billable data available</p>
      )}
    </div>
  );
};


