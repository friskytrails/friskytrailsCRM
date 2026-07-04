import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function AgentMetricsTable({ agent, agentId, agentName, updateAgentMetrics, agentLeads = [] }) {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [attendanceLogs, setAttendanceLogs] = useState([]);

  // Calculate today's date in YYYY-MM-DD format based on local time
  const getLocalDateString = (d = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayDateStr = getLocalDateString();
  const currentMonthPrefix = todayDateStr.substring(0, 7); // "YYYY-MM"

  const [form, setForm] = useState({
    monthlyTarget: agent?.monthlyTarget || 0,
    targetCompleted: agent?.targetCompleted || 0,
    attendance: ''
  });

  // Fetch attendance logs when component mounts or agentId changes
  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/agents/${agentId}/attendance`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setAttendanceLogs(data);

          // Set initial attendance in form for today if it exists
          const todayLog = data.find(log => log.date === todayDateStr);
          setForm(prev => ({
            ...prev,
            attendance: todayLog ? todayLog.status : ''
          }));
        }
      } catch (error) {
        console.error("Failed to fetch attendance:", error);
      }
    };
    fetchAttendance();
  }, [agentId, todayDateStr]);

  const handleSave = async () => {
    if (!updateAgentMetrics) return;
    setLoading(true);
    try {
      // Send the metrics along with the date string for the log
      await updateAgentMetrics(agentId, {
        ...form,
        attendanceDate: todayDateStr
      });

      // Update local logs state without refetching for UI snappy feel
      setAttendanceLogs(prev => {
        let newLogs = [...prev];
        const existingIdx = newLogs.findIndex(l => l.date === todayDateStr);
        if (form.attendance === 'P' || form.attendance === 'A') {
          if (existingIdx > -1) newLogs[existingIdx].status = form.attendance;
          else newLogs.push({ date: todayDateStr, status: form.attendance });
        } else if (form.attendance === '') {
          if (existingIdx > -1) newLogs.splice(existingIdx, 1);
        }
        return newLogs;
      });

      setIsEditing(false);
    } finally {
      setLoading(false);
    }
  };

  const targetCompleted = agent?.targetCompleted || 0;
  const monthlyTarget = agent?.monthlyTarget || 0;

  // Calculate Bookings
  const bookedLeads = agentLeads.filter(lead => lead.status === 'Booked' || lead.status === 'Closed').length;
  const totalLeads = agentLeads.length;

  // Calculate Attendance Stats for the current month
  const currentMonthLogs = attendanceLogs.filter(log => log.date.startsWith(currentMonthPrefix));
  const presentCount = currentMonthLogs.filter(log => log.status === 'P').length;
  const absentCount = currentMonthLogs.filter(log => log.status === 'A').length;

  const todayLog = attendanceLogs.find(log => log.date === todayDateStr);
  let todayDisplay = '-';
  if (todayLog?.status === 'P') todayDisplay = 'Present';
  else if (todayLog?.status === 'A') todayDisplay = 'Absent';

  const monthlyAttendanceDisplay = presentCount > 0 || absentCount > 0
    ? `${presentCount} P / ${absentCount} A`
    : '-';

  const metrics = [
    { label: 'Monthly Target', value: `${targetCompleted} / ${monthlyTarget}` },
    { label: 'Booking Count', value: `${bookedLeads} / ${totalLeads}` },
    { label: 'Today\'s Attendance', value: todayDisplay },
    { label: 'Monthly Attendance', value: monthlyAttendanceDisplay },
  ];

  const currentDateDisplay = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-800 shadow-sm w-full min-w-[340px] md:min-w-[400px] max-w-lg">
      {/* Header - Redesigned to use theme colors and prevent overlapping */}
      <div className="bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-100 flex justify-between items-center px-5 py-4 border-b border-gray-200 dark:border-slate-700">
        <div>
          <span className="font-bold text-base tracking-wide block">Monthly Metrics</span>
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 block">{currentDateDisplay}</span>
        </div>

        <div className="flex items-center gap-2">
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
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
                    monthlyTarget: agent?.monthlyTarget || 0,
                    targetCompleted: agent?.targetCompleted || 0,
                    attendance: todayLog?.status || ''
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
