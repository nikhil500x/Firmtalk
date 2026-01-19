/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';

export interface TopHighValueMattersProps {
  data: Array<{
    name: string;
    value: number;
  }>;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

export const TopHighValueMatters: React.FC<TopHighValueMattersProps> = ({ data }) => (
  <div className="bg-white rounded-lg shadow p-6 h-full">
    <div className="mb-4">
      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-blue-600" />
        Top 10 High-Value Matters
      </h3>
    </div>
    {data.length > 0 ? (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis type="number" tickFormatter={formatCurrency} />
          <YAxis dataKey="name" type="category" width={150} style={{ fontSize: '12px' }} />
          <Tooltip formatter={(value) => formatCurrency(value as number)} />
          <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    ) : (
      <p className="text-gray-500 text-center py-8">No data available</p>
    )}
  </div>
);

