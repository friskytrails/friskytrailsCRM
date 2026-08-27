import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import AgentMetricsTable from '../components/AgentMetricsTable';

const normalizeId = (id) => (id === null || id === undefined ? '' : String(id).trim());
const matchIds = (id1, id2) => {
  const norm1 = normalizeId(id1);
  const norm2 = normalizeId(id2);
  return norm1 !== '' && norm1 === norm2;
};

export default function AgentLeads({ leads, agents, statuses = [], updateAgentMetrics, refreshAgents, loading }) {
  const { id } = useParams();
  const navigate = useNavigate();

  const normalizeAgentSlug = (value) => String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '');
  const getAgentSlug = (ag) => normalizeAgentSlug(ag?.name);
  const decodedParam = (() => {
    try {
      return decodeURIComponent(id || '').trim();
    } catch {
      return (id || '').trim();
    }
  })();
  const normalizedParam = normalizeAgentSlug(decodedParam);

  const agent = (agents || []).find(a =>
    matchIds(a.id || a._id, id) ||
    a.name === decodedParam ||
    a.name?.toLowerCase() === decodedParam.toLowerCase() ||
    getAgentSlug(a) === normalizedParam ||
    encodeURIComponent(a.name) === id
  );

  const agentKey = agent ? (getAgentSlug(agent) || agent.id || agent._id) : (normalizedParam || id);

  useEffect(() => {
    if (refreshAgents && agent) {
      refreshAgents(agent.id || agent._id);
    }
  }, [id, agent?.id]);

  const [filterStatus, setFilterStatus] = useState(() => {
    return sessionStorage.getItem(`agentLeads_${agentKey}_filterStatus`) || 'all';
  });
  const [filterProduct, setFilterProduct] = useState(() => {
    return sessionStorage.getItem(`agentLeads_${agentKey}_filterProduct`) || 'all';
  });
  const [filterAge, setFilterAge] = useState(() => {
    return sessionStorage.getItem(`agentLeads_${agentKey}_filterAge`) || 'all';
  });

  // When switching agents (agentKey changes), load that agent's saved filters or default to 'all'
  useEffect(() => {
    if (!agentKey) return;
    setFilterStatus(sessionStorage.getItem(`agentLeads_${agentKey}_filterStatus`) || 'all');
    setFilterProduct(sessionStorage.getItem(`agentLeads_${agentKey}_filterProduct`) || 'all');
    setFilterAge(sessionStorage.getItem(`agentLeads_${agentKey}_filterAge`) || 'all');
    setSearchQuery('');
  }, [agentKey]);

  // Persist filter changes for the current agent
  useEffect(() => {
    if (!agentKey) return;
    sessionStorage.setItem(`agentLeads_${agentKey}_filterStatus`, filterStatus);
    sessionStorage.setItem(`agentLeads_${agentKey}_filterProduct`, filterProduct);
    sessionStorage.setItem(`agentLeads_${agentKey}_filterAge`, filterAge);
  }, [filterStatus, filterProduct, filterAge, agentKey]);

  const [agentLeadsData, setAgentLeadsData] = useState([]);
  const [loadingLeads, setLoadingLeads] = useState(false);

  useEffect(() => {
    const fetchAgentLeads = async () => {
      // If agents list is still loading, wait for it unless id is already a 24-char ObjectId
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
      if (!agent && !isObjectId) {
        // Still resolving slug from agents list; do not fire with raw non-ObjectId string
        return;
      }

      const targetAgentId = agent ? (agent.id || agent._id) : (isObjectId ? id : null);
      if (!targetAgentId) return;

      setLoadingLeads(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${import.meta.env.VITE_API_URL}/leads?filterAgent=${targetAgentId}&pagination=false`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setAgentLeadsData(Array.isArray(data) ? data : (data.leads || []));
        }
      } catch (err) {
        console.error('Error fetching agent leads:', err);
      } finally {
        setLoadingLeads(false);
      }
    };
    fetchAgentLeads();
  }, [id, agent?.id, agent?._id, agent]);

  const [searchQuery, setSearchQuery] = useState('');

  const isInactiveStatus = (status) => {
    const st = status || 'Fresh Leads';
    return (
      st === 'Booked' ||
      st === 'Rejected Leads' ||
      st === 'Rejected' ||
      st === 'Future Leads' ||
      st === 'Future' ||
      st === 'Non Responding Leads' ||
      st === 'Non Responding'
    );
  };

  const effectiveLeads = agentLeadsData.length > 0 ? agentLeadsData : (leads || []);
  const agentLeads = agent ? effectiveLeads.filter(lead => (lead.agentIds || []).some(aid => matchIds(aid, agent.id || agent._id))) : effectiveLeads;
  const activeAgentLeads = agentLeads.filter(l => !isInactiveStatus(l.status));
  const hasSearchQuery = searchQuery.trim().length > 0;
  const getAgeInDays = (createdAt) => {
    if (!createdAt) return 1;
    const diffTime = Math.max(0, new Date() - new Date(createdAt));
    return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  };

  const checkAgeFilter = (age, filter) => {
    if (filter === 'all') return true;
    if (filter === '1-4') return age >= 1 && age <= 4;
    if (filter === '5-7') return age >= 5 && age <= 7;
    if (filter === '8-10') return age >= 8 && age <= 10;
    if (filter === '10-20') return age > 10 && age <= 20;
    if (filter === '20-30') return age > 20 && age <= 30;
    if (filter === '30+') return age > 30;
    return true;
  };

  const activeScopeLeads = (filterStatus !== 'all' || hasSearchQuery) ? agentLeads : activeAgentLeads;
  const statusScopedLeads = filterStatus === 'all' ? activeAgentLeads : agentLeads.filter(l => (l.status || 'Fresh Leads') === filterStatus);

  const filteredAgentLeads = activeScopeLeads.filter(lead => {
    const st = lead.status || 'Fresh Leads';
    const query = searchQuery.trim().toLowerCase();
    const age = getAgeInDays(lead.createdAt);

    const matchesSearch = !hasSearchQuery ||
      (lead.name || '').toLowerCase().includes(query) ||
      (lead.phone || '').includes(query) ||
      (lead.origin || '').toLowerCase().includes(query) ||
      (lead.destination || '').toLowerCase().includes(query) ||
      (lead.product || '').toLowerCase().includes(query);

    if (hasSearchQuery) {
      return matchesSearch;
    }

    const matchesStatus = filterStatus === 'all' || st === filterStatus;
    const matchesProduct = filterProduct === 'all' || (lead.product || 'Other') === filterProduct;
    const matchesAge = checkAgeFilter(age, filterAge);

    return matchesSearch && matchesStatus && matchesProduct && matchesAge;
  });

  // Sync active filtered agent leads to sessionStorage for lead detail next/prev navigation
  useEffect(() => {
    const activeIds = (filteredAgentLeads || []).map(l => l.id || l._id);
    sessionStorage.setItem('activeLeadIds', JSON.stringify(activeIds));
    if (agent) {
      const agentSlug = getAgentSlug(agent) || agent.id;
      sessionStorage.setItem('leadDetail_backUrl', `/agents/${agentSlug}`);
      sessionStorage.setItem('leadDetail_backLabel', `${agent.name}'s Board`);
    }
  }, [filteredAgentLeads, agent]);

  if (loading || loadingLeads || (!agent && (!agents || agents.length === 0))) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-sm font-semibold text-gray-500 dark:text-slate-400">Loading agent board...</p>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-400 mb-4">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        </div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Agent Not Found</h3>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">The requested agent could not be found or may have been removed.</p>
        <button
          onClick={() => navigate('/agents')}
          className="mt-6 inline-flex items-center px-4 py-2 text-xs font-semibold rounded-lg bg-orange-500 hover:bg-orange-600 text-white shadow-sm transition-all cursor-pointer"
        >
          Back to Team List
        </button>
      </div>
    );
  }

  const activeNavAgents = (agents || []).filter(a => {
    const status = a.status || 'Active';
    return status === 'Active' && !a.isManager && a.status !== 'Pending' && a.status !== 'Rejected';
  });

  const currentAgentIndex = activeNavAgents.findIndex(a => matchIds(a.id || a._id, agent.id || agent._id));
  const prevAgent = currentAgentIndex > 0 ? activeNavAgents[currentAgentIndex - 1] : null;
  const nextAgent = currentAgentIndex >= 0 && currentAgentIndex < activeNavAgents.length - 1 ? activeNavAgents[currentAgentIndex + 1] : null;

  const defaultStatusList = ["Fresh Leads", "Interested Leads", "Pre Prospect Leads", "Prospect Leads", "Booked", "Rejected Leads"];
  const availableStatuses = (statuses && statuses.length > 0) ? statuses : defaultStatusList;

  const availableProducts = Array.from(new Set(statusScopedLeads.map(l => l.product || 'Other'))).filter(Boolean).sort();
  const ageOptions = [
    { label: '1 to 4 Days', value: '1-4' },
    { label: '5 to 7 Days', value: '5-7' },
    { label: '8 to 10 Days', value: '8-10' },
    { label: '10 to 20 Days', value: '10-20' },
    { label: '20 to 30 Days', value: '20-30' },
    { label: '30+ Days', value: '30+' }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate('/agents')}
          className="inline-flex items-center text-sm text-gray-500 hover:text-orange-600 dark:text-slate-400 dark:hover:text-orange-400 font-medium transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => prevAgent && navigate(`/agents/${getAgentSlug(prevAgent) || prevAgent.id || prevAgent._id}`)}
            disabled={!prevAgent}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer"
            title={prevAgent ? `Previous Agent: ${prevAgent.name}` : 'First agent'}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Previous Agent
          </button>
          <button
            onClick={() => nextAgent && navigate(`/agents/${getAgentSlug(nextAgent) || nextAgent.id || nextAgent._id}`)}
            disabled={!nextAgent}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer"
            title={nextAgent ? `Next Agent: ${nextAgent.name}` : 'Last agent'}
          >
            Next Agent
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold text-2xl border border-orange-200 dark:border-orange-800/50">
            {(agent.name || '').split(' ').map(n => n?.[0] || '').join('')}
          </div>
          <div>
            <h1 className="text-3xl font-black text-gray-900 dark:text-white">
              {agent.name}'s Board
            </h1>
            <p className="text-lg font-bold text-orange-600 dark:text-orange-400 mt-1">
              Showing {filteredAgentLeads.length} of {activeScopeLeads.length} Assigned Leads
            </p>
          </div>
        </div>
        <div className="w-full md:w-auto flex justify-start md:justify-end shrink-0">
          <AgentMetricsTable agent={agent} agentId={agent.id} agentName={agent.name} agentLeads={agentLeads} updateAgentMetrics={updateAgentMetrics} />
        </div>
      </div>
      <div className="mb-6 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white shrink-0">Assigned Leads</h2>
        <div className="flex flex-wrap lg:flex-nowrap items-center gap-3 w-full xl:w-auto xl:justify-end">
          <div className="relative flex-1 sm:w-52 md:w-60 min-w-[160px]">
            <input
              type="text"
              placeholder="Search leads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg pl-8 pr-7 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 dark:text-slate-200 placeholder-gray-400 dark:placeholder-slate-500 shadow-sm transition-shadow font-medium"
            />
            <svg className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 cursor-pointer"
                title="Clear search"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-xs font-medium bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 dark:text-slate-200 shadow-sm transition-shadow cursor-pointer shrink-0"
          >
            <option value="all">Active Statuses ({activeAgentLeads.length})</option>
            {availableStatuses.map(st => {
              const count = agentLeads.filter(l => (l.status || 'Fresh Leads') === st).length;
              return (
                <option key={st} value={st}>{st} ({count})</option>
              );
            })}
          </select>
          <select
            value={filterProduct}
            onChange={(e) => setFilterProduct(e.target.value)}
            className="text-xs font-medium bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 dark:text-slate-200 shadow-sm transition-shadow cursor-pointer shrink-0"
          >
            <option value="all">All Packages ({statusScopedLeads.length})</option>
            {availableProducts.map(prod => {
              const count = statusScopedLeads.filter(l => (l.product || 'Other') === prod).length;
              return (
                <option key={prod} value={prod}>{prod} ({count})</option>
              );
            })}
          </select>
          <select
            value={filterAge}
            onChange={(e) => setFilterAge(e.target.value)}
            className="text-xs font-medium bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 dark:text-slate-200 shadow-sm transition-shadow cursor-pointer shrink-0"
          >
            <option value="all">All Ages ({statusScopedLeads.length})</option>
            {ageOptions.map(opt => {
              const count = statusScopedLeads.filter(l => checkAgeFilter(getAgeInDays(l.createdAt), opt.value)).length;
              return (
                <option key={opt.value} value={opt.value}>{opt.label} ({count})</option>
              );
            })}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAgentLeads.length === 0 ? (
          <div className="col-span-full py-12 text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-gray-300 dark:border-slate-600">
            No leads matching the selected status.
          </div>
        ) : (
          filteredAgentLeads.map(lead => (
            <Link key={lead.id} to={`/leads/${lead.id}`} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-5 hover:shadow-md transition-shadow group">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                  {lead.name || 'Unnamed Lead'}
                </h3>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-300">
                  {lead.status || 'Fresh Leads'}
                </span>
              </div>

              <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                <p className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                  {lead.phone || 'N/A'}
                </p>

                <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-slate-700 mt-2">
                  <div className="flex-1">
                    <span className="block text-[10px] uppercase text-gray-400">Origin</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">{lead.origin || '—'}</span>
                  </div>
                  <div className="text-orange-500">➔</div>
                  <div className="flex-1 text-right">
                    <span className="block text-[10px] uppercase text-gray-400">Dest</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">{lead.destination || '—'}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
