import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import AgentMetricsTable from '../components/AgentMetricsTable';

const normalizeId = (id) => (id === null || id === undefined ? '' : String(id).trim());
const matchIds = (id1, id2) => {
  const norm1 = normalizeId(id1);
  const norm2 = normalizeId(id2);
  return norm1 !== '' && norm1 === norm2;
};

export default function AgentLeads({ leads, agents, statuses = [], updateAgentMetrics }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [filterStatus, setFilterStatus] = useState(() => {
    return sessionStorage.getItem('agentLeads_filterStatus') || 'all';
  });
  
  useEffect(() => {
    sessionStorage.setItem('agentLeads_filterStatus', filterStatus);
  }, [filterStatus]);

  const [searchQuery, setSearchQuery] = useState('');

  const decodedParam = decodeURIComponent(id || '');
  const agent = agents.find(a => 
    matchIds(a.id || a._id, id) || 
    a.name === decodedParam || 
    a.name?.toLowerCase() === decodedParam.toLowerCase() ||
    encodeURIComponent(a.name) === id
  );
  
  const agentLeads = agent ? leads.filter(lead => (lead.agentIds || []).some(aid => matchIds(aid, agent.id || agent._id))) : [];
  const filteredAgentLeads = agentLeads.filter(lead => {
    const st = lead.status || 'Fresh Leads';
    const isBookedOrRejected = st === 'Booked' || st === 'Rejected Leads' || st === 'Rejected';
    const hasSearchQuery = searchQuery.trim().length > 0;
    
    if (filterStatus === 'all' && !hasSearchQuery && isBookedOrRejected) {
      return false;
    }

    const query = searchQuery.trim().toLowerCase();
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

    return matchesSearch && matchesStatus;
  });

  // Sync active filtered agent leads to sessionStorage for lead detail next/prev navigation
  useEffect(() => {
    const activeIds = (filteredAgentLeads || []).map(l => l.id || l._id);
    sessionStorage.setItem('activeLeadIds', JSON.stringify(activeIds));
  }, [filteredAgentLeads]);

  if (!agent) {
    return <div className="p-8 text-center text-gray-500">Agent not found</div>;
  }
  
  const currentAgentIndex = (agents || []).findIndex(a => a.id === agent.id);
  const prevAgent = currentAgentIndex > 0 ? agents[currentAgentIndex - 1] : null;
  const nextAgent = currentAgentIndex >= 0 && currentAgentIndex < (agents || []).length - 1 ? agents[currentAgentIndex + 1] : null;

  const defaultStatusList = ["Fresh Leads", "Interested Leads", "Pre Prospect Leads", "Prospect Leads", "Booked", "Rejected Leads"];
  const availableStatuses = (statuses && statuses.length > 0) ? statuses : defaultStatusList;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center text-sm text-gray-500 hover:text-orange-600 dark:text-slate-400 dark:hover:text-orange-400 font-medium transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => prevAgent && navigate(`/agents/${prevAgent.id}`)}
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
            onClick={() => nextAgent && navigate(`/agents/${nextAgent.id}`)}
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
              Showing {filteredAgentLeads.length} of {agentLeads.length} Assigned Leads
            </p>
          </div>
        </div>
        <div className="w-full md:w-auto flex justify-start md:justify-end shrink-0">
          <AgentMetricsTable agent={agent} agentId={agent.id} agentName={agent.name} agentLeads={agentLeads} updateAgentMetrics={updateAgentMetrics} />
        </div>
      </div>
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Assigned Leads</h2>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Search leads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-sm bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 dark:text-slate-200 shadow-sm transition-shadow"
            />
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full sm:w-auto text-sm bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 dark:text-slate-200 shadow-sm transition-shadow cursor-pointer"
          >
            <option value="all">All Statuses ({agentLeads.length})</option>
            {availableStatuses.map(st => {
              const count = agentLeads.filter(l => (l.status || 'Fresh Leads') === st).length;
              return (
                <option key={st} value={st}>{st} ({count})</option>
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
