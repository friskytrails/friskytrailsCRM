import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function AgentsList({ agents = [], leads = [], updateAgentStatus, updateAgentVerification }) {
  const [loadingAction, setLoadingAction] = useState({});
  const [processedAgents, setProcessedAgents] = useState({});

  const pendingAgentsList = agents.filter(a => a.status === 'Pending');
  const activeAgentsList = agents.filter(a => a.status !== 'Pending' && a.status !== 'Rejected');

  const agentLeadCounts = leads.reduce((acc, lead) => {
    (lead.agentIds || []).forEach(agentId => {
      acc[agentId] = (acc[agentId] || 0) + 1;
    });
    return acc;
  }, {});

  const handleAction = async (agentId, action, value) => {
    setLoadingAction(prev => ({ ...prev, [agentId]: true }));
    try {
      if (action === 'status' && updateAgentStatus) {
        const result = await updateAgentStatus(agentId, value);
        if (result && (value === 'Active' || value === 'Rejected')) {
          setProcessedAgents(prev => ({ ...prev, [agentId]: value }));
        }
      } else if (action === 'verify' && updateAgentVerification) {
        await updateAgentVerification(agentId, value);
      }
    } finally {
      setLoadingAction(prev => ({ ...prev, [agentId]: false }));
    }
  };

  const statusColors = {
    'Active': 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-400',
    'Inactive': 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400',
    'Former Employee': 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-slate-700 dark:text-slate-300',
    'Pending': 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400'
  };

  const renderAgentCard = (agent, isPendingView = false) => {
    const count = agentLeadCounts[agent.id] || 0;
    const status = agent.status || 'Active';

    if (isPendingView) {
      return (
        <div key={agent.id} className="flex flex-col p-3.5 bg-gray-50/80 dark:bg-slate-900/60 hover:bg-white dark:hover:bg-slate-800 transition-colors rounded-xl border border-gray-200 dark:border-slate-700 gap-3 group shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-900/60 dark:to-orange-950 text-orange-700 dark:text-orange-400 flex items-center justify-center font-bold text-xs border border-orange-300/50 dark:border-orange-800/50 shrink-0 shadow-inner">
              {(agent.name || '').split(' ').map(n => n?.[0] || '').join('')}
            </div>
            <div className="flex-1 min-w-0">
              <Link to={`/agents/${agent.id}`} className="text-sm font-bold text-gray-900 dark:text-slate-100 truncate hover:text-orange-600 dark:hover:text-orange-400 transition-colors">
                {agent.name}
              </Link>
              <p className="text-[10px] text-gray-500 dark:text-slate-400 truncate">
                {agent.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={() => handleAction(agent.id, 'status', 'Active')}
              disabled={loadingAction[agent.id] || processedAgents[agent.id]}
              className={`flex-1 text-[11px] font-bold py-2 rounded-lg transition-all shadow-sm ${processedAgents[agent.id] === 'Active' ? 'bg-green-700 text-white' : 'bg-green-500 hover:bg-green-600 text-white hover:shadow-md'} disabled:opacity-50`}
            >
              {loadingAction[agent.id] && !processedAgents[agent.id] ? 'Saving...' : processedAgents[agent.id] === 'Active' ? 'Approved' : 'Approve'}
            </button>
            <button
              onClick={() => handleAction(agent.id, 'status', 'Rejected')}
              disabled={loadingAction[agent.id] || processedAgents[agent.id]}
              className={`flex-1 text-[11px] font-bold py-2 rounded-lg transition-all border border-transparent ${processedAgents[agent.id] === 'Rejected' ? 'bg-red-700 text-white' : 'bg-gray-100 hover:bg-red-100 text-gray-700 hover:text-red-700 hover:border-red-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-red-900/30 dark:hover:text-red-400'} disabled:opacity-50`}
            >
              {loadingAction[agent.id] && !processedAgents[agent.id] ? 'Saving...' : processedAgents[agent.id] === 'Rejected' ? 'Rejected' : 'Reject'}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div key={agent.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white dark:bg-slate-800/50 hover:bg-gray-50/80 dark:hover:bg-slate-800 transition-colors rounded-xl border border-gray-200/80 dark:border-slate-700 gap-4 shadow-sm hover:shadow-md group">
        <div className="flex items-center space-x-4">
          <div className="h-11 w-11 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-slate-800 dark:to-slate-900 text-gray-600 dark:text-slate-300 flex items-center justify-center font-bold text-sm border border-gray-300/50 dark:border-slate-700/50 shrink-0 shadow-inner group-hover:from-orange-100 group-hover:to-orange-50 group-hover:text-orange-600 dark:group-hover:from-orange-950 dark:group-hover:to-slate-900 dark:group-hover:text-orange-400 transition-colors">
            {(agent.name || '').split(' ').map(n => n?.[0] || '').join('')}
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
              <Link to={`/agents/${agent.id}`} className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors">{agent.name}</Link>
              {status !== 'Active' && (
                <span className={`text-[10px] px-2 py-0.5 rounded-md border font-semibold tracking-wide ${statusColors[status] || statusColors['Inactive']}`}>
                  {status}
                </span>
              )}
            </p>
            <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
              <span className="font-mono">{agent.email}</span>
              <span className="text-gray-300 dark:text-slate-600">•</span>
              {agent.isVerified ? (
                <span className="text-green-600 dark:text-green-400 font-semibold flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  Verified
                </span>
              ) : (
                <span className="text-red-500 font-semibold flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  Unverified
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4 sm:ml-auto bg-gray-50 dark:bg-slate-900/50 p-2 sm:p-1 rounded-xl sm:bg-transparent sm:dark:bg-transparent">
          <span className={`inline-flex items-center px-3 py-1 rounded-lg text-[11px] font-bold border ${count > 0 ? 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-900/50' : 'bg-white text-gray-500 border-gray-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'}`}>
            <svg className="w-3.5 h-3.5 mr-1.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            {count} {count === 1 ? 'Lead' : 'Leads'}
          </span>

          <div className="flex items-center space-x-2 border-l pl-4 border-gray-200 dark:border-slate-700">
            <select
              id={`status-${agent.id}`}
              value={status}
              disabled={loadingAction[agent.id]}
              onChange={(e) => handleAction(agent.id, 'status', e.target.value)}
              className="text-xs font-semibold bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer disabled:opacity-50 text-gray-700 dark:text-slate-200 shadow-sm"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Former Employee">Former Employee</option>
            </select>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

      <div className="flex flex-col lg:flex-row gap-8">

        {/* Active Team Section (75%) */}
        <div className="lg:w-3/4">
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl shadow-xl rounded-2xl p-6 md:p-8 border border-gray-200/50 dark:border-slate-700/50">
            <div className="border-b border-gray-200 dark:border-slate-700 pb-5 mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
                  <span className="bg-orange-100 dark:bg-orange-900/50 p-2 rounded-xl text-orange-600 dark:text-orange-400">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                  </span>
                  Active Team
                  <span className="bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 text-sm py-0.5 px-2.5 rounded-full font-bold ml-1">
                    {activeAgentsList.length}
                  </span>
                </h3>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-2 font-medium">
                  Manage your travel agents, view their assigned leads, and update account statuses.
                </p>
              </div>
            </div>

            {activeAgentsList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 bg-gray-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-gray-300 dark:border-slate-700">
                <svg className="w-12 h-12 text-gray-300 dark:text-slate-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                <p className="text-sm font-semibold text-gray-500 dark:text-slate-400 text-center">No active agents in the system.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3.5">
                {activeAgentsList.map(agent => renderAgentCard(agent, false))}
              </div>
            )}
          </div>
        </div>

        {/* Pending Approvals Section (25%) */}
        <div className="lg:w-1/4">
          <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl shadow-xl rounded-2xl p-5 border border-orange-200 dark:border-orange-900/50 relative overflow-hidden sticky top-24">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-orange-400 via-orange-500 to-red-500"></div>

            <div className="border-b border-gray-100 dark:border-slate-700 pb-4 mb-5 flex flex-col gap-1 pt-1">
              <h3 className="text-base font-black text-gray-900 dark:text-white flex items-center justify-between">
                Pending Approvals
                {pendingAgentsList.length > 0 && (
                  <span className="bg-red-500 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-md animate-pulse">
                    {pendingAgentsList.length}
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-tight font-medium mt-1">
                Agents awaiting admin review.
              </p>
            </div>

            {pendingAgentsList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 bg-gray-50/50 dark:bg-slate-900/30 rounded-xl border border-dashed border-gray-200 dark:border-slate-700">
                <svg className="w-8 h-8 text-gray-300 dark:text-slate-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <p className="text-[11px] font-semibold text-gray-400 dark:text-slate-500 text-center">No pending approvals at the moment.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {pendingAgentsList.map(agent => renderAgentCard(agent, true))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
