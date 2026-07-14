import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function Reports() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // First day of current month
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [teamFilter, setTeamFilter] = useState('all');
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  const fetchReports = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        startDate,
        endDate,
        team: teamFilter
      });
      const res = await fetch(`${import.meta.env.VITE_API_URL}/calls/historical?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setReports(await res.json());
      } else {
        toast.error('Failed to load reports');
      }
    } catch (err) {
      console.error(err);
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const aggregate = reports.reduce((acc, curr) => {
    acc.talkTime += curr.talkTime || 0;
    acc.totalDials += curr.totalDials || 0;
    acc.uniqueCalls += curr.uniqueCalls || 0;
    acc.connectedCalls += curr.connectedCalls || 0;
    acc.longCalls += curr.longCalls || 0;
    return acc;
  }, { talkTime: 0, totalDials: 0, uniqueCalls: 0, connectedCalls: 0, longCalls: 0 });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6 mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Historical Performance Report</h1>
        
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Start Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">End Date</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Team</label>
            <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)} className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500">
              <option value="all">All Teams</option>
              {/* Add team options dynamically if teams are implemented later */}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Sort By</label>
            <div className="flex gap-2">
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500">
                <option value="name">Name</option>
                <option value="tenure">Tenure</option>
                <option value="talkTime">Talk Time</option>
                <option value="totalDials">Total Dials</option>
                <option value="uniqueCalls">Unique Calls</option>
                <option value="connectedCalls">Connected Calls</option>
                <option value="longCalls">Long Calls</option>
              </select>
              <button 
                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                title="Toggle Sort Order"
              >
                {sortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
              </button>
            </div>
          </div>
          <button onClick={fetchReports} disabled={loading} className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-6 rounded-lg text-sm transition-colors">
            {loading ? 'Loading...' : 'Get Data'}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-slate-700/50 dark:text-gray-400">
              <tr>
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Tenure (Days)</th>
                <th className="px-6 py-3">Talk Time</th>
                <th className="px-6 py-3">Total Dials</th>
                <th className="px-6 py-3">Unique Calls</th>
                <th className="px-6 py-3">Connected Calls</th>
                <th className="px-6 py-3">Long Calls (5m+)</th>
              </tr>
            </thead>
            <tbody>
              {/* Summary Row */}
              <tr className="bg-orange-50/50 dark:bg-orange-900/10 font-bold border-b-2 border-gray-200 dark:border-slate-600">
                <td className="px-6 py-4 text-orange-800 dark:text-orange-300">TOTAL</td>
                <td className="px-6 py-4 text-orange-800 dark:text-orange-300">-</td>
                <td className="px-6 py-4 text-orange-800 dark:text-orange-300">{formatTime(aggregate.talkTime)}</td>
                <td className="px-6 py-4 text-orange-800 dark:text-orange-300">{aggregate.totalDials}</td>
                <td className="px-6 py-4 text-orange-800 dark:text-orange-300">{aggregate.uniqueCalls}</td>
                <td className="px-6 py-4 text-orange-800 dark:text-orange-300">{aggregate.connectedCalls}</td>
                <td className="px-6 py-4 text-orange-800 dark:text-orange-300">{aggregate.longCalls}</td>
              </tr>
              {[...reports].sort((a, b) => {
                let valA = a[sortBy];
                let valB = b[sortBy];
                if (sortBy === 'name') {
                  valA = (valA || '').toLowerCase();
                  valB = (valB || '').toLowerCase();
                  if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
                  if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
                  return 0;
                }
                return sortOrder === 'asc' ? valA - valB : valB - valA;
              }).map(report => (
                <tr key={report.agentId} className="border-b dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-800/50">
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{report.name}</td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{report.tenure}</td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{formatTime(report.talkTime)}</td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{report.totalDials}</td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{report.uniqueCalls}</td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{report.connectedCalls}</td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{report.longCalls}</td>
                </tr>
              ))}
              {reports.length === 0 && !loading && (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-500">No data found for this date range.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
