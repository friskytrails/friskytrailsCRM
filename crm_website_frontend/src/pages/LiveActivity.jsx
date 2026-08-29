import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

const normalizeAgentSlug = (value) => String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '');
const getAgentSlug = (ag) => normalizeAgentSlug(ag?.name);

export default function LiveActivity({ agents = [] }) {
  const [liveStatus, setLiveStatus] = useState([]);
  const [liveActivity, setLiveActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('lastCall'); // 'name', 'firstCall', 'lastCall', 'idleTime', 'talkTime'
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' or 'desc'

  const abortControllerRef = useRef(null);

  // Clock tick every 60s to keep idle times accurate
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = useCallback(async (isManual = false) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (isManual) setRefreshing(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const headers = { 'Authorization': `Bearer ${token}` };

      const [statusRes, activityRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL}/calls/live-status`, { headers, signal: controller.signal }),
        fetch(`${import.meta.env.VITE_API_URL}/calls/live-activity`, { headers, signal: controller.signal })
      ]);

      if (statusRes.ok && activityRes.ok) {
        const [statusData, activityData] = await Promise.all([
          statusRes.json(),
          activityRes.json()
        ]);
        if (abortControllerRef.current === controller) {
          setLiveStatus(statusData || []);
          setLiveActivity(activityData || []);
        }
      } else {
        if (isManual && abortControllerRef.current === controller) {
          toast.error('Failed to refresh live data');
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error fetching live activity data:', err);
        if (isManual && abortControllerRef.current === controller) {
          toast.error('Connection error while fetching data');
        }
      }
    } finally {
      if (abortControllerRef.current === controller) {
        setLoading(false);
        if (isManual) setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchData();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchData();
      }
    }, 60000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [fetchData]);

  // Unified Merge across Agents, Live Status, and Live Activity
  const unifiedData = useMemo(() => {
    const agentMap = new Map();

    // 1. Populate base active agents
    (agents || []).forEach(ag => {
      const st = ag.status || 'Active';
      const isItinerary = ag.isItinerary || ag.role === 'itinerary';
      if (st !== 'Inactive' && st !== 'Former Employee' && !isItinerary) {
        const agId = String(ag.id || ag._id || '');
        agentMap.set(agId, {
          agentId: agId,
          name: ag.name || 'Unknown Agent',
          email: ag.email || '',
          slug: getAgentSlug(ag),
          firstCall: null,
          lastCall: null,
          idleMs: null,
          lastCallAt: null,
          talkTimeSeconds: 0,
          rawAgent: ag
        });
      }
    });

    // 2. Merge Live Status (idle times & last call timestamps)
    (liveStatus || []).forEach(stat => {
      const agId = String(stat.agentId || '');
      let entry = agentMap.get(agId);
      if (!entry) {
        // Fallback match by name
        for (const val of agentMap.values()) {
          if (val.name.toLowerCase() === (stat.name || '').toLowerCase()) {
            entry = val;
            break;
          }
        }
      }

      if (!entry && stat.name) {
        entry = {
          agentId: agId || stat.name,
          name: stat.name,
          email: stat.email || '',
          slug: normalizeAgentSlug(stat.name),
          firstCall: null,
          lastCall: null,
          idleMs: null,
          lastCallAt: null,
          talkTimeSeconds: 0,
          rawAgent: null
        };
        agentMap.set(entry.agentId, entry);
      }

      if (entry) {
        entry.idleMs = stat.idleMs;
        entry.lastCallAt = stat.lastCallAt;
      }
    });

    // 3. Merge Live Activity (first call, last call, total talk time)
    (liveActivity || []).forEach(act => {
      const agId = String(act.agentId || '');
      let entry = agentMap.get(agId);
      if (!entry) {
        for (const val of agentMap.values()) {
          if (val.name.toLowerCase() === (act.name || '').toLowerCase()) {
            entry = val;
            break;
          }
        }
      }

      if (!entry && act.name) {
        entry = {
          agentId: agId || act.name,
          name: act.name,
          email: act.email || '',
          slug: normalizeAgentSlug(act.name),
          firstCall: null,
          lastCall: null,
          idleMs: null,
          lastCallAt: null,
          talkTimeSeconds: 0,
          rawAgent: null
        };
        agentMap.set(entry.agentId, entry);
      }

      if (entry) {
        entry.firstCall = act.firstCall || entry.firstCall;
        entry.lastCall = act.lastCall || entry.lastCall;
        entry.talkTimeSeconds = act.talkTime || entry.talkTimeSeconds || 0;
        if (!entry.lastCallAt && act.lastCall) {
          entry.lastCallAt = act.lastCall;
        }
      }
    });

    return Array.from(agentMap.values());
  }, [agents, liveStatus, liveActivity]);

  // Filter and Sort
  const filteredAndSortedData = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = unifiedData.filter(item => {
      if (!query) return true;
      return (
        item.name.toLowerCase().includes(query) ||
        item.email.toLowerCase().includes(query)
      );
    });

    return filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === 'firstCall') {
        const timeA = a.firstCall ? new Date(a.firstCall).getTime() : 0;
        const timeB = b.firstCall ? new Date(b.firstCall).getTime() : 0;
        comparison = timeA - timeB;
      } else if (sortBy === 'lastCall') {
        const timeA = (a.lastCall || a.lastCallAt) ? new Date(a.lastCall || a.lastCallAt).getTime() : 0;
        const timeB = (b.lastCall || b.lastCallAt) ? new Date(b.lastCall || b.lastCallAt).getTime() : 0;
        comparison = timeA - timeB;
      } else if (sortBy === 'idleTime') {
        const idleA = a.lastCallAt ? (currentTime - new Date(a.lastCallAt).getTime()) : (a.idleMs || 0);
        const idleB = b.lastCallAt ? (currentTime - new Date(b.lastCallAt).getTime()) : (b.idleMs || 0);
        comparison = idleA - idleB;
      } else if (sortBy === 'talkTime') {
        comparison = (a.talkTimeSeconds || 0) - (b.talkTimeSeconds || 0);
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }, [unifiedData, searchQuery, sortBy, sortOrder, currentTime]);

  const formatTalkTime = (sec = 0) => {
    if (!sec || sec <= 0) return '0m 0s';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    return h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
  };

  const formatCallTime = (isoString) => {
    if (!isoString) return '—';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Metrics summary calculation
  const metrics = useMemo(() => {
    let totalSec = 0;
    let idleOver2hCount = 0;
    let activeTodayCount = 0;

    unifiedData.forEach(item => {
      totalSec += item.talkTimeSeconds || 0;
      if (item.firstCall || item.lastCall || item.talkTimeSeconds > 0) {
        activeTodayCount++;
      }
      const idleMs = item.lastCallAt ? (currentTime - new Date(item.lastCallAt).getTime()) : item.idleMs;
      if (idleMs && (idleMs / (1000 * 60 * 60)) > 2) {
        idleOver2hCount++;
      }
    });

    return {
      totalAgents: unifiedData.length,
      activeToday: activeTodayCount,
      idleOver2h: idleOver2hCount,
      totalTalkTime: formatTalkTime(totalSec)
    };
  }, [unifiedData, currentTime]);

  const handleSortToggle = (field) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="sm:flex sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
              Live Activity & Audit
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-400 border border-green-200 dark:border-green-800">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              Live Updates
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            Real-time daily call monitoring, agent idle duration, and total talk time.
          </p>
        </div>

        <div className="mt-4 sm:mt-0 flex items-center gap-3">
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            <svg className={`w-4 h-4 text-orange-500 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {refreshing ? 'Refreshing...' : 'Refresh Now'}
          </button>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-8">
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700/60 p-5">
          <p className="text-[10px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider">Total Active Agents</p>
          <p className="text-2xl font-black text-gray-900 dark:text-white mt-1">{metrics.totalAgents}</p>
        </div>

        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700/60 p-5">
          <p className="text-[10px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider">Active Callers Today</p>
          <p className="text-2xl font-black text-green-600 dark:text-green-400 mt-1">
            {metrics.activeToday} <span className="text-xs text-gray-400 font-medium">({metrics.totalAgents > 0 ? Math.round((metrics.activeToday / metrics.totalAgents) * 100) : 0}%)</span>
          </p>
        </div>

        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700/60 p-5">
          <p className="text-[10px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider">Idle &gt; 2 Hours</p>
          <p className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">{metrics.idleOver2h}</p>
        </div>

        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700/60 p-5">
          <p className="text-[10px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider">Total Team Talk Time</p>
          <p className="text-2xl font-black text-orange-600 dark:text-orange-400 mt-1">{metrics.totalTalkTime}</p>
        </div>
      </div>

      {/* Search and Table Container */}
      <div className="mt-8 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-200/80 dark:border-slate-700/70 overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-slate-700/60 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              placeholder="Search agent by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl pl-9 pr-8 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 shadow-sm"
            />
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-3 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          <div className="text-xs font-semibold text-gray-500 dark:text-slate-400">
            Showing <strong className="text-gray-900 dark:text-white">{filteredAndSortedData.length}</strong> agent{filteredAndSortedData.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Combined Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase bg-gray-50/80 dark:bg-slate-900/50 border-b border-gray-100 dark:border-slate-700/60 sticky top-0 z-10 tracking-wider">
              <tr>
                <th
                  scope="col"
                  aria-sort={sortBy === 'name' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className="px-6 py-3.5"
                >
                  <button
                    type="button"
                    onClick={() => handleSortToggle('name')}
                    className="flex items-center gap-1.5 w-full text-left font-bold hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-orange-500 rounded"
                  >
                    <span>Agent Name</span>
                    {sortBy === 'name' && (
                      <span className="text-orange-500 font-bold">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                <th
                  scope="col"
                  aria-sort={sortBy === 'firstCall' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className="px-6 py-3.5"
                >
                  <button
                    type="button"
                    onClick={() => handleSortToggle('firstCall')}
                    className="flex items-center gap-1.5 w-full text-left font-bold hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-orange-500 rounded"
                  >
                    <span>First Call</span>
                    {sortBy === 'firstCall' && (
                      <span className="text-orange-500 font-bold">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                <th
                  scope="col"
                  aria-sort={sortBy === 'lastCall' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className="px-6 py-3.5"
                >
                  <button
                    type="button"
                    onClick={() => handleSortToggle('lastCall')}
                    className="flex items-center gap-1.5 w-full text-left font-bold hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-orange-500 rounded"
                  >
                    <span>Last Call</span>
                    {sortBy === 'lastCall' && (
                      <span className="text-orange-500 font-bold">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                <th
                  scope="col"
                  aria-sort={sortBy === 'idleTime' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className="px-6 py-3.5"
                >
                  <button
                    type="button"
                    onClick={() => handleSortToggle('idleTime')}
                    className="flex items-center gap-1.5 w-full text-left font-bold hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-orange-500 rounded"
                  >
                    <span>Idle Time</span>
                    {sortBy === 'idleTime' && (
                      <span className="text-orange-500 font-bold">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                <th
                  scope="col"
                  aria-sort={sortBy === 'talkTime' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className="px-6 py-3.5"
                >
                  <button
                    type="button"
                    onClick={() => handleSortToggle('talkTime')}
                    className="flex items-center gap-1.5 w-full text-left font-bold hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-orange-500 rounded"
                  >
                    <span>Talk Time</span>
                    {sortBy === 'talkTime' && (
                      <span className="text-orange-500 font-bold">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-16 text-center text-gray-500">
                    <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    <p className="text-xs font-semibold">Loading live agent data...</p>
                  </td>
                </tr>
              ) : filteredAndSortedData.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-400 dark:text-slate-500 text-sm">
                    No agents matching your search.
                  </td>
                </tr>
              ) : (
                filteredAndSortedData.map(item => {
                  const effectiveLastCall = item.lastCall || item.lastCallAt;
                  const idleMs = effectiveLastCall
                    ? (currentTime - new Date(effectiveLastCall).getTime())
                    : item.idleMs;
                  const idleHours = idleMs ? (idleMs / (1000 * 60 * 60)) : null;
                  const isIdleHigh = idleHours !== null && idleHours > 2;
                  const idleMins = idleMs ? Math.floor(idleMs / (1000 * 60)) : null;

                  const formattedIdle = idleHours !== null
                    ? (idleHours >= 1 ? `${Math.floor(idleHours)}h ${idleMins % 60}m` : `${idleMins}m`)
                    : '—';

                  const agentLink = item.slug ? `/agents/${item.slug}` : `/agents/${item.agentId}`;

                  return (
                    <tr
                      key={item.agentId}
                      className={`transition-colors hover:bg-gray-50/80 dark:hover:bg-slate-700/30 ${
                        isIdleHigh ? 'bg-red-50/40 dark:bg-red-950/20' : ''
                      }`}
                    >
                      {/* Agent Name */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-950 dark:to-slate-800 text-orange-700 dark:text-orange-400 flex items-center justify-center font-bold text-xs shrink-0 shadow-inner">
                            {(item.name || '').split(' ').map(n => n?.[0] || '').join('')}
                          </div>
                          <div>
                            <Link
                              to={agentLink}
                              className="font-bold text-gray-900 dark:text-white hover:text-orange-600 dark:hover:text-orange-400 transition-colors block"
                            >
                              {item.name}
                            </Link>
                            {item.email && (
                              <p className="text-[11px] text-gray-400 dark:text-slate-500 font-mono">{item.email}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* First Call */}
                      <td className="px-6 py-4 font-medium text-gray-600 dark:text-slate-300">
                        {formatCallTime(item.firstCall)}
                      </td>

                      {/* Last Call */}
                      <td className="px-6 py-4 font-medium text-gray-600 dark:text-slate-300">
                        {formatCallTime(effectiveLastCall)}
                      </td>

                      {/* Idle Time */}
                      <td className="px-6 py-4">
                        <span
                          className={`font-semibold ${
                            isIdleHigh
                              ? 'text-red-600 dark:text-red-400 font-bold'
                              : 'text-gray-600 dark:text-slate-300'
                          }`}
                        >
                          {formattedIdle}
                        </span>
                      </td>

                      {/* Talk Time */}
                      <td className="px-6 py-4 font-bold text-orange-600 dark:text-orange-400">
                        {formatTalkTime(item.talkTimeSeconds)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
