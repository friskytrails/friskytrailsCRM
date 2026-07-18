import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function AgentMetricsTable({ agent, agentId, agentName, updateAgentMetrics, agentLeads = [] }) {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [attendanceSummary, setAttendanceSummary] = useState({ present: 0, absent: 0 });

  // Calculate today's date in YYYY-MM-DD format based on local time
  const getLocalDateString = (d = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayDateStr = getLocalDateString();
  const currentMonthPrefix = todayDateStr.substring(0, 7); // "YYYY-MM"
  const [selectedMonth, setSelectedMonth] = useState(currentMonthPrefix);

  const [form, setForm] = useState({
    monthlyTarget: agent?.monthlyTarget || 0,
    targetCompleted: agent?.targetCompleted || 0,
    attendance: agent?.attendance || ''
  });

  // Update form if agent prop changes
  useEffect(() => {
    if (!isEditing) {
      setForm({
        monthlyTarget: agent?.monthlyTarget || 0,
        targetCompleted: agent?.targetCompleted || 0,
        attendance: agent?.attendance || ''
      });
    }
  }, [agent, isEditing]);

  // Fetch monthly attendance summary
  const fetchAttendanceSummary = async () => {
    try {
      const [year, month] = selectedMonth.split('-');
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/agents/${agentId}/attendance/monthly?year=${year}&month=${month}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAttendanceSummary({ present: data.present || 0, absent: data.absent || 0 });
      }
    } catch (error) {
      console.error("Failed to fetch attendance summary:", error);
    }
  };

  useEffect(() => {
    fetchAttendanceSummary();
  }, [agentId, selectedMonth]);

  const handleSave = async () => {
    if (!updateAgentMetrics) return;
    setLoading(true);
    try {
      const payload = {
        monthlyTarget: form.monthlyTarget,
        targetCompleted: form.targetCompleted,
      };
      
      if (selectedMonth === currentMonthPrefix) {
        payload.attendance = form.attendance;
        payload.attendanceDate = todayDateStr;
      } else {
        payload.date = selectedMonth + '-01';
      }

      const updatedAgent = await updateAgentMetrics(agentId, payload);

      if (!updatedAgent) return;

      // Re-fetch summary in case today's attendance change affects it
      await fetchAttendanceSummary();

      setIsEditing(false);
    } finally {
      setLoading(false);
    }
  };

  const historicalMetric = agent?.historicalMetrics?.find(m => m.month === selectedMonth);
  const monthlyTarget = selectedMonth === currentMonthPrefix ? (agent?.monthlyTarget || 0) : (historicalMetric?.monthlyTarget || 0);
  const targetCompleted = selectedMonth === currentMonthPrefix ? (agent?.targetCompleted || 0) : (historicalMetric?.targetCompleted || 0);

  // Calculate Bookings
  const bookedLeads = agentLeads.filter(lead => lead.status === 'Booked' || lead.status === 'Closed').length;
  const totalLeads = agentLeads.length;

  let todayDisplay = '-';
  if (agent?.attendance === 'P') todayDisplay = 'Present';
  else if (agent?.attendance === 'A') todayDisplay = 'Absent';

  const monthlyAttendanceDisplay = attendanceSummary.present > 0 || attendanceSummary.absent > 0
    ? `${attendanceSummary.present} P / ${attendanceSummary.absent} A`
    : '-';

  const metrics = [
    { label: 'Monthly Target', value: `${targetCompleted} / ${monthlyTarget}` },
    { label: 'Booking Count', value: `${bookedLeads} / ${totalLeads}` },
    { label: 'Today\'s Attendance', value: todayDisplay },
    { label: 'Monthly Attendance', value: monthlyAttendanceDisplay },
  ];

  const currentDateDisplay = new Date(selectedMonth + '-01').toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  });

  return (
    <div className="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-800 shadow-sm w-full sm:w-[340px] md:w-[400px] lg:w-[420px] max-w-full">
      {/* Header - Redesigned to use theme colors and prevent overlapping */}
      <div className="bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-100 flex justify-between items-center px-4 sm:px-5 py-4 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div>
            <span className="font-bold text-base tracking-wide block">Monthly Metrics</span>
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 block">{currentDateDisplay}</span>
          </div>
          <input 
            type="month" 
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="text-xs bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>

        <div className="flex items-center gap-2">
          {!isEditing ? (
            <button
              onClick={() => {
                setIsEditing(true);
                setForm({
                  monthlyTarget: monthlyTarget,
                  targetCompleted: targetCompleted,
                  attendance: selectedMonth === currentMonthPrefix ? (agent?.attendance || '') : ''
                });
              }}
              className="text-xs bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg transition-all font-semibold flex items-center gap-1 border border-gray-200 dark:border-slate-600 shadow-sm"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              Edit
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  setIsEditing(false);
                  setForm({
                    monthlyTarget: monthlyTarget,
                    targetCompleted: targetCompleted,
                    attendance: selectedMonth === currentMonthPrefix ? (agent?.attendance || '') : ''
                  });
                }}
                className="text-xs bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 px-2.5 py-1.5 rounded-lg transition-all font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg transition-all font-semibold disabled:opacity-50 flex items-center gap-1 shadow-sm"
              >
                {loading ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="divide-y divide-gray-100 dark:divide-slate-700/50">
        {isEditing ? (
          <div className="p-4 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-slate-300 font-medium">Monthly Target</span>
              <input
                type="number"
                value={form.monthlyTarget}
                onChange={e => setForm({ ...form, monthlyTarget: e.target.value })}
                className="w-28 text-sm bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-slate-200 transition-shadow"
              />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-slate-300 font-medium">Target Completed</span>
              <input
                type="number"
                value={form.targetCompleted}
                onChange={e => setForm({ ...form, targetCompleted: e.target.value })}
                className="w-28 text-sm bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-slate-200 transition-shadow"
              />
            </div>
            {selectedMonth === currentMonthPrefix && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-slate-300 font-medium">Today's Attendance</span>
                <select
                  value={form.attendance}
                  onChange={e => setForm({ ...form, attendance: e.target.value })}
                  className="w-28 text-sm bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-slate-200 transition-shadow"
                >
                  <option value="">-</option>
                  <option value="P">Present (P)</option>
                  <option value="A">Absent (A)</option>
                </select>
              </div>
            )}
          </div>
        ) : (
          metrics.map((metric, index) => (
            <div key={index} className="flex justify-between items-center px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <span className="text-sm text-gray-600 dark:text-slate-300 font-medium">
                {metric.label}
              </span>
              <span className="text-sm font-bold text-gray-800 dark:text-slate-200">
                {metric.value}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
