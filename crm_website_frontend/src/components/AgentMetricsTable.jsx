import React from 'react';

export default function AgentMetricsTable({ agentId, agentName }) {
  // In a real application, these metrics would be fetched from the backend using the agentId.
  // For now, we use placeholder data as requested by the UI design.
  const metrics = [
    { label: 'Monthly Target', value: '0 - 0' },
    { label: 'Booking Count', value: '0 / 0' },
    { label: 'Total Sale Amount', value: '0 / 0' },
    { label: 'Attendance', value: '0 / 30' },
  ];

  const currentDate = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-800 shadow-sm w-full max-w-sm">
      <div className="bg-blue-500 text-white flex justify-between items-center px-4 py-3">
        <span className="font-semibold text-sm">Monthly...</span>
        <span className="font-medium text-sm">{currentDate}</span>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-slate-700/50">
        {metrics.map((metric, index) => (
          <div key={index} className="flex justify-between items-center px-4 py-3">
            <span className="text-sm text-gray-600 dark:text-slate-300 font-medium">
              {metric.label}
            </span>
            <span className="text-sm font-semibold text-gray-800 dark:text-slate-200">
              {metric.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
