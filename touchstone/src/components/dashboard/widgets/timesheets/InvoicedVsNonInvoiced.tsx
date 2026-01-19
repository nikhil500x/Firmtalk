'use client';

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { DollarSign } from 'lucide-react';
import { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';

interface InvoicedVsNonInvoicedProps {
  data: {
    invoiced: { amount: number; count: number };
    nonInvoiced: { amount: number; count: number };
  };
}

const COLORS = {
  invoiced: '#10b981',
  nonInvoiced: '#f59e0b',
};

const formatCurrency = (value: number) =>
  `₹${(value || 0).toLocaleString('en-IN')}`;

export const InvoicedVsNonInvoiced: React.FC<InvoicedVsNonInvoicedProps> = ({
  data,
}) => {
  const chartData = [
    { name: 'Invoiced', value: data?.invoiced?.amount || 0, color: COLORS.invoiced },
    { name: 'Non-Invoiced', value: data?.nonInvoiced?.amount || 0, color: COLORS.nonInvoiced },
  ];

  const hasData = chartData.some((item) => item.value > 0);

  return (
    <div className="bg-white rounded-lg shadow p-4 h-full flex flex-col gap-3 overflow-hidden">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-green-600" />
          Invoiced vs Non-Invoiced
        </h3>
      </div>

      {hasData ? (
        <>
          <ResponsiveContainer width="100%" height={170}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                dataKey="value"
                label={({ name, percent }) =>
                  `${name}: ${((percent || 0) * 100).toFixed(0)}%`
                }
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number ) => formatCurrency(value)} />
            </PieChart>
          </ResponsiveContainer>

          <div className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Invoiced</span>
              <span className="font-semibold text-green-600">
                {formatCurrency(data?.invoiced?.amount || 0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Non-Invoiced</span>
              <span className="font-semibold text-orange-600">
                {formatCurrency(data?.nonInvoiced?.amount || 0)}
              </span>
            </div>
            <div className="flex justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
              <span>Invoiced Entries: {data?.invoiced?.count ?? 0}</span>
              <span>Pending: {data?.nonInvoiced?.count ?? 0}</span>
            </div>
          </div>
        </>
      ) : (
        <p className="text-gray-500 text-center py-10">No invoicing data available</p>
      )}
    </div>
  );
};


