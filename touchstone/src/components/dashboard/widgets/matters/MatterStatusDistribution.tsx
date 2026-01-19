/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Scale } from 'lucide-react';

export interface MatterStatusDistributionProps {
  data: Array<{
    name: string;
    value: number;
    color: string;
  }>;
}

export const MatterStatusDistribution: React.FC<MatterStatusDistributionProps> = ({ data }) => (
  <div className="bg-white rounded-lg shadow p-6 h-full">
    <div className="mb-4">
      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
        <Scale className="w-5 h-5 text-blue-600" />
        Matter Status Distribution
      </h3>
    </div>
    {data.length > 0 ? (
      <>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={3}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {data.map((item) => (
            <div key={item.name} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
              <span className="text-sm text-gray-600">{item.name}: {item.value}</span>
            </div>
          ))}
        </div>
      </>
    ) : (
      <p className="text-gray-500 text-center py-8">No data available</p>
    )}
  </div>
);

