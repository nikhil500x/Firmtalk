/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { FileText } from 'lucide-react';

export interface PracticeAreaDistributionProps {
  data: Array<{
    name: string;
    value: number;
    color: string;
  }>;
}

export const PracticeAreaDistribution: React.FC<PracticeAreaDistributionProps> = ({ data }) => (
  <div className="bg-white rounded-lg shadow p-6 h-full">
    <div className="mb-4">
      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
        <FileText className="w-5 h-5 text-blue-600" />
        Matters by Practice Area
      </h3>
    </div>
    {data.length > 0 ? (
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            outerRadius={90}
            dataKey="value"
            label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    ) : (
      <p className="text-gray-500 text-center py-8">No data available</p>
    )}
  </div>
);

