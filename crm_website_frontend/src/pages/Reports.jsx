import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function Reports() {
  const getLocalDateString = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // First day of current month
    return getLocalDateString(d);
  });
  const [endDate, setEndDate] = useState(() => {
    return getLocalDateString(new Date());
  });
  const [teamFilter, setTeamFilter] = useState('all');
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  // Long calls drilldown modal state
  const [showModal, setShowModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [longCallsDetails, setLongCallsDetails] = useState([]);
  const [loadingLongCalls, setLoadingLongCalls] = useState(false);

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

  const handleOpenLongCallsModal = async (agentId, agentName) => {
    setSelectedAgent({ agentId, name: agentName });
    setShowModal(true);
    setLoadingLongCalls(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        agentId: agentId || 'all',
        startDate,
        endDate
      });
      const res = await fetch(`${import.meta.env.VITE_API_URL}/calls/long-calls?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLongCallsDetails(data);
      } else {
        toast.error('Failed to load long call details');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error fetching long call details');
    } finally {
      setLoadingLongCalls(false);
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
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">End Date</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Team</label>
            <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)} className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 text-gray-900 dark:text-white">
              <option value="all">All Teams</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Sort By</label>
            <div className="flex gap-2">
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 text-gray-900 dark:text-white">
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
          <button onClick={fetchReports} disabled={loading} className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-6 rounded-lg text-sm transition-colors cursor-pointer disabled:opacity-50">
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
                <td className="px-6 py-4 text-orange-800 dark:text-orange-300">
                  {aggregate.longCalls > 0 ? (
                    <button
                      onClick={() => handleOpenLongCallsModal('all', 'All Agents')}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-orange-500 text-white hover:bg-orange-600 transition-all shadow-sm cursor-pointer"
                      title="Click to view all long calls"
                    >
                      <span>{aggregate.longCalls}</span>
                      <span className="text-[10px] opacity-80">🔍 Details</span>
                    </button>
                  ) : (
                    <span>0</span>
                  )}
                </td>
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
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                    {report.longCalls > 0 ? (
                      <button
                        onClick={() => handleOpenLongCallsModal(report.agentId, report.name)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-orange-100 dark:bg-orange-950/70 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-900 border border-orange-200 dark:border-orange-800/50 transition-all cursor-pointer shadow-xs"
                        title={`Click to view long call details for ${report.name}`}
                      >
                        <span>{report.longCalls}</span>
                        <span className="text-[10px] opacity-75">🔍 Details</span>
                      </button>
                    ) : (
                      <span className="text-gray-400 dark:text-slate-500">0</span>
                    )}
                  </td>
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

      {/* Long Calls Drilldown Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[85vh] border border-gray-200 dark:border-slate-700">
            {/* Modal Header */}
            <div className="p-4 px-6 bg-gradient-to-r from-orange-500 to-amber-600 dark:from-slate-900 dark:to-slate-800 border-b border-orange-600 dark:border-slate-700 flex justify-between items-center text-white">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <span>📞</span> Long Calls Breakdown (5m+)
                </h3>
                <p className="text-xs text-orange-100 dark:text-slate-400 mt-0.5">
                  Agent: <strong className="text-white font-semibold">{selectedAgent?.name}</strong> • Range: {startDate} to {endDate}
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer font-bold text-lg"
                title="Close modal"
              >
                &times;
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1">
              {loadingLongCalls ? (
                <div className="py-12 text-center text-gray-500 dark:text-slate-400">
                  <div className="animate-spin inline-block w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full mb-3"></div>
                  <p className="text-sm font-medium">Fetching detailed call logs...</p>
                </div>
              ) : longCallsDetails.length === 0 ? (
                <div className="py-12 text-center text-gray-500 dark:text-slate-400 text-sm">
                  No long calls (&gt;= 5 mins) recorded for this agent in the selected date range.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead className="text-xs text-gray-500 dark:text-slate-400 uppercase bg-gray-50 dark:bg-slate-900/60 border-b border-gray-200 dark:border-slate-700">
                      <tr>
                        <th className="px-4 py-3">Lead / Contact Name</th>
                        <th className="px-4 py-3">Contact Number</th>
                        <th className="px-4 py-3">Duration</th>
                        <th className="px-4 py-3">Timestamp</th>
                        <th className="px-4 py-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-700/60">
                      {longCallsDetails.map((call, idx) => {
                        const leadTargetId = call.leadId || call.leadNumberId;
                        return (
                          <tr key={call._id || idx} className="hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-colors">
                            <td className="px-4 py-3 font-semibold text-gray-900 dark:text-slate-100">
                              {leadTargetId ? (
                                <Link
                                  to={`/lead/${leadTargetId}`}
                                  className="text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1.5"
                                  title="View Lead Details"
                                >
                                  <span>👤</span> {call.leadName || 'Lead Details'}
                                </Link>
                              ) : (
                                <span className="text-gray-700 dark:text-slate-300 flex items-center gap-1.5">
                                  <span>👤</span> {call.leadName || 'Direct Dial'}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-slate-300">
                              {call.contactNumber || 'N/A'}
                            </td>
                            <td className="px-4 py-3 font-bold text-orange-600 dark:text-orange-400">
                              {formatTime(call.duration)}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400">
                              {new Date(call.timestamp).toLocaleString([], {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">
                                {call.status || 'Connected'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700 flex justify-between items-center text-xs text-gray-500 dark:text-slate-400">
              <span>Showing <strong>{longCallsDetails.length}</strong> long call(s) (&gt;= 5 minutes)</span>
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-800 dark:text-slate-200 rounded-lg font-semibold text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
