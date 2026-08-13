import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const normalizeAgentSlug = (value) => String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '');
const getAgentSlug = (ag) => normalizeAgentSlug(ag?.name);

export default function AgentsList({ agents = [], leads = [], updateAgentStatus, updateAgentVerification, toggleManagerRole, toggleItineraryRole, assignAgentsToManager }) {
  const [loadingAction, setLoadingAction] = useState({});
  const [processedAgents, setProcessedAgents] = useState({});
  const [assignModalManager, setAssignModalManager] = useState(null); // manager object or null
  const [viewTeamManager, setViewTeamManager] = useState(null);
  const [selectedAgentIds, setSelectedAgentIds] = useState([]);
  const [assignSearchQuery, setAssignSearchQuery] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');

  useEffect(() => {
    sessionStorage.setItem('leadDetail_backUrl', '/agents');
    sessionStorage.setItem('leadDetail_backLabel', 'Active Team');
  }, []);

  const pendingAgentsList = agents.filter(a => a.status === 'Pending');
  const managersList = agents.filter(a => a.isManager && a.status !== 'Pending');
  
  const baseTeamList = agents.filter(a => !a.isManager && a.status !== 'Pending' && a.status !== 'Rejected');
  const activeAgentsList = baseTeamList.filter(a => {
    const trimmedQuery = globalSearchQuery.trim().toLowerCase();
    const hasQuery = trimmedQuery.length > 0;
    const status = a.status || 'Active';

    // Without search: show Active agents, and hide Inactive/Former Employee only after 24 hours
    if (!hasQuery) {
      if (status === 'Active') return true;

      const changedAt = a.statusChangedAt || a.updatedAt || a.createdAt;
      if (changedAt) {
        const changedTime = new Date(changedAt).getTime();
        const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
        if (!isNaN(changedTime) && (Date.now() - changedTime < TWENTY_FOUR_HOURS)) {
          return true;
        }
      }
      return false;
    }

    // When searching, allow matching inactive or former employees as well
    return (
      (a.name || '').toLowerCase().includes(trimmedQuery) ||
      (a.email || '').toLowerCase().includes(trimmedQuery) ||
      (a.phone || '').toLowerCase().includes(trimmedQuery) ||
      (status).toLowerCase().includes(trimmedQuery)
    );
  });

  const agentLeadCounts = leads.reduce((acc, lead) => {
    const st = lead.status || 'Fresh Leads';
    const isBookedOrRejected = st === 'Booked' || st === 'Rejected Leads' || st === 'Rejected';
    if (!isBookedOrRejected) {
      (lead.agentIds || []).forEach(agentId => {
        const key = String(agentId);
        acc[key] = (acc[key] || 0) + 1;
      });
    }
    return acc;
  }, {});

  const handleAction = async (agentId, action, value) => {
    if (action === 'status' && (value === 'Inactive' || value === 'Former Employee')) {
      const agentObj = agents.find(a => a.id === agentId || a._id === agentId);
      const agentName = agentObj?.name || 'this agent';
      const confirmed = window.confirm(`Are you sure you want to change the status of "${agentName}" to ${value}? They will be hidden from the Active Team list after 24 hours.`);
      if (!confirmed) return;
    }

    setLoadingAction(prev => ({ ...prev, [agentId]: value || true }));
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

  const handleActionWithRole = async (agentId, status, role) => {
    setLoadingAction(prev => ({ ...prev, [agentId]: role }));
    try {
      if (updateAgentStatus) {
        const result = await updateAgentStatus(agentId, status, role);
        if (result && (status === 'Active' || status === 'Rejected')) {
          setProcessedAgents(prev => ({ ...prev, [agentId]: status }));
        }
      }
    } finally {
      setLoadingAction(prev => ({ ...prev, [agentId]: false }));
    }
  };

  const handleToggleManager = async (agent) => {
    const promoting = !agent.isManager;
    const confirmMsg = promoting
      ? `Promote "${agent.name}" to Manager? They will be able to view and manage their assigned team.`
      : `Remove Manager role from "${agent.name}"? All agents under them will be unassigned.`;
    if (!window.confirm(confirmMsg)) return;
    setLoadingAction(prev => ({ ...prev, [`mgr_${agent.id}`]: true }));
    try {
      await toggleManagerRole(agent.id, promoting);
    } finally {
      setLoadingAction(prev => ({ ...prev, [`mgr_${agent.id}`]: false }));
    }
  };

  const handleToggleItinerary = async (agent) => {
    const nextVal = !agent.isItinerary;
    const confirmMsg = nextVal
      ? `Convert "${agent.name}" to Itinerary Team? They will have restricted access to leads (Lead name and comments section only).`
      : `Convert "${agent.name}" to standard Agent?`;
    if (!window.confirm(confirmMsg)) return;
    setLoadingAction(prev => ({ ...prev, [`itin_${agent.id}`]: true }));
    try {
      if (toggleItineraryRole) {
        await toggleItineraryRole(agent.id, nextVal);
      }
    } finally {
      setLoadingAction(prev => ({ ...prev, [`itin_${agent.id}`]: false }));
    }
  };

  const openAssignModal = (manager) => {
    // Pre-select agents currently assigned to this manager
    const currentAgentIds = agents.filter(a => a.managerId === manager.id || a.managerId === manager._id).map(a => a.id);
    setSelectedAgentIds(currentAgentIds);
    setAssignModalManager(manager);
    setAssignSearchQuery('');
  };

  const handleAssign = async () => {
    if (!assignModalManager) return;
    setAssignLoading(true);
    try {
      const result = await assignAgentsToManager(assignModalManager.id, selectedAgentIds);
      if (result) {
        setAssignModalManager(null);
      }
    } finally {
      setAssignLoading(false);
    }
  };

  const toggleAgentSelection = (agentId) => {
    setSelectedAgentIds(prev =>
      prev.includes(agentId) ? prev.filter(id => id !== agentId) : [...prev, agentId]
    );
  };

  // Agents eligible to be assigned (non-managers, non-pending)
  const baseAssignableAgents = agents.filter(a => !a.isManager && a.status !== 'Pending' && a.status !== 'Rejected');
  const assignableAgents = assignSearchQuery.trim() === '' 
    ? baseAssignableAgents 
    : baseAssignableAgents.filter(a => {
        const nameMatch = (a.name || '').toLowerCase().includes(assignSearchQuery.toLowerCase());
        const emailMatch = (a.email || '').toLowerCase().includes(assignSearchQuery.toLowerCase());
        return nameMatch || emailMatch;
      });

  const statusColors = {
    'Active': 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-400',
    'Inactive': 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400',
    'Former Employee': 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-slate-700 dark:text-slate-300',
    'Pending': 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400'
  };

  const renderAgentCard = (agent, isPendingView = false) => {
    const agId = String(agent.id || agent._id || '');
    const count = agentLeadCounts[agId] || agentLeadCounts[agent.id] || agentLeadCounts[agent._id] || 0;
    const status = agent.status || 'Active';

    if (isPendingView) {
      return (
        <div key={agent.id} className="flex flex-col p-3.5 bg-gray-50/80 dark:bg-slate-900/60 hover:bg-white dark:hover:bg-slate-800 transition-colors rounded-xl border border-gray-200 dark:border-slate-700 gap-3 group shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-900/60 dark:to-orange-950 text-orange-700 dark:text-orange-400 flex items-center justify-center font-bold text-xs border border-orange-300/50 dark:border-orange-800/50 shrink-0 shadow-inner">
              {(agent.name || '').split(' ').map(n => n?.[0] || '').join('')}
            </div>
            <div className="flex-1 min-w-0">
              <Link to={`/agents/${getAgentSlug(agent)}`} className="block text-sm font-bold text-gray-900 dark:text-slate-100 truncate hover:text-orange-600 dark:hover:text-orange-400 transition-colors">
                {agent.name}
              </Link>
              <p className="text-[10px] text-gray-500 dark:text-slate-400 truncate">{agent.email}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 mt-1">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleActionWithRole(agent.id, 'Active', 'agent')}
                disabled={!!loadingAction[agent.id] || !!processedAgents[agent.id]}
                className={`flex-1 text-[11px] font-bold py-1.5 px-2 rounded-lg transition-all shadow-sm ${processedAgents[agent.id] === 'Active' ? 'bg-green-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white hover:shadow-md'} disabled:opacity-50`}
              >
                {loadingAction[agent.id] === 'agent' ? 'Saving...' : 'Agent'}
              </button>
              <button
                onClick={() => handleActionWithRole(agent.id, 'Active', 'itinerary')}
                disabled={!!loadingAction[agent.id] || !!processedAgents[agent.id]}
                className={`flex-1 text-[11px] font-bold py-1.5 px-2 rounded-lg transition-all shadow-sm ${processedAgents[agent.id] === 'Active' ? 'bg-blue-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-md'} disabled:opacity-50`}
              >
                {loadingAction[agent.id] === 'itinerary' ? 'Saving...' : 'Itinerary'}
              </button>
            </div>
            <button
              onClick={() => handleAction(agent.id, 'status', 'Rejected')}
              disabled={!!loadingAction[agent.id] || !!processedAgents[agent.id]}
              className={`w-full text-[11px] font-bold py-1.5 rounded-lg transition-all border border-transparent ${processedAgents[agent.id] === 'Rejected' ? 'bg-red-700 text-white' : 'bg-gray-100 hover:bg-red-100 text-gray-700 hover:text-red-700 hover:border-red-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-red-900/30 dark:hover:text-red-400'} disabled:opacity-50`}
            >
              {loadingAction[agent.id] === 'Rejected' ? 'Saving...' : processedAgents[agent.id] === 'Rejected' ? 'Rejected' : 'Reject'}
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
              <Link to={`/agents/${getAgentSlug(agent)}`} className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors">{agent.name}</Link>
              {agent.isItinerary && (
                <span className="text-[10px] px-2 py-0.5 rounded-md border font-bold bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-400 dark:border-blue-900/50">Itinerary Team</span>
              )}
              {status !== 'Active' && (
                <span className={`text-[10px] px-2 py-0.5 rounded-md border font-semibold tracking-wide ${statusColors[status] || statusColors['Inactive']}`}>{status}</span>
              )}
            </p>
            <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
              <span className="font-mono">{agent.email}</span>
              <span className="text-gray-300 dark:text-slate-600">&bull;</span>
              {agent.isVerified ? (
                <span className="text-green-600 dark:text-green-400 font-semibold flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Verified
                </span>
              ) : (
                <span className="text-red-500 font-semibold flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>Unverified
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 sm:ml-auto">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold border ${count > 0 ? 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-900/50' : 'bg-white text-gray-500 border-gray-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'}`}>
            <svg className="w-3.5 h-3.5 mr-1.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            {count} {count === 1 ? 'Lead' : 'Leads'}
          </span>

          {/* Toggle Itinerary Role */}
          <button
            onClick={() => handleToggleItinerary(agent)}
            disabled={!!loadingAction[`itin_${agent.id}`]}
            title={agent.isItinerary ? "Convert to standard Agent" : "Convert to Itinerary Team"}
            className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition-all disabled:opacity-50 ${agent.isItinerary ? 'bg-blue-100 hover:bg-blue-200 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300' : 'bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400'}`}
          >
            {loadingAction[`itin_${agent.id}`] ? '...' : agent.isItinerary ? 'Itinerary Role' : '+ Itinerary'}
          </button>

          {/* Make Manager toggle */}
          <button
            onClick={() => handleToggleManager(agent)}
            disabled={!!loadingAction[`mgr_${agent.id}`] || agent.isItinerary}
            title={agent.isItinerary ? "Itinerary Team members cannot be promoted to Manager" : "Promote to Manager"}
            className="text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-all disabled:opacity-50 bg-violet-50 hover:bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-900/40 dark:hover:bg-violet-900/40"
          >
            {loadingAction[`mgr_${agent.id}`] ? '...' : '+ Manager'}
          </button>

          <div className="flex items-center space-x-2 border-l pl-3 border-gray-200 dark:border-slate-700">
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

        {/* Left Main Column */}
        <div className="lg:w-3/4 space-y-8">

          {/* Managers Section */}
          {managersList.length > 0 && (
            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl shadow-xl rounded-2xl p-6 md:p-8 border border-violet-200/60 dark:border-violet-900/40">
              <div className="border-b border-gray-200 dark:border-slate-700 pb-5 mb-6">
                <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
                  <span className="bg-violet-100 dark:bg-violet-900/50 p-2 rounded-xl text-violet-600 dark:text-violet-400">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                  </span>
                  Managers
                  <span className="bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 text-sm py-0.5 px-2.5 rounded-full font-bold ml-1">{managersList.length}</span>
                </h3>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-2 font-medium">Agents promoted to manager role. Assign their teams using the button below.</p>
              </div>
              <div className="grid grid-cols-1 gap-3.5">
                {managersList.map(manager => {
                  const teamMembers = agents.filter(a => a.managerId === manager.id || a.managerId === manager._id);
                  const teamCount = teamMembers.length;
                  const count = agentLeadCounts[manager.id] || 0;
                  const status = manager.status || 'Active';
                  return (
                    <div key={manager.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-violet-50/50 dark:bg-violet-950/20 rounded-xl border border-violet-200/60 dark:border-violet-900/40 gap-4 shadow-sm hover:shadow-md transition-all group">
                      <div className="flex items-center space-x-4">
                        <div className="h-11 w-11 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-md shrink-0">
                          {(manager.name || '').split(' ').map(n => n?.[0] || '').join('')}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                            <Link to={`/agents/${getAgentSlug(manager)}`} className="hover:text-violet-600 dark:hover:text-violet-400 transition-colors">{manager.name}</Link>
                            <span className="text-[10px] px-2 py-0.5 rounded-md border font-bold bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/60 dark:text-violet-400 dark:border-violet-900/50">Manager</span>
                            {status !== 'Active' && (
                              <span className={`text-[10px] px-2 py-0.5 rounded-md border font-semibold ${statusColors[status] || statusColors['Inactive']}`}>{status}</span>
                            )}
                          </p>
                          <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5 font-mono">{manager.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 sm:ml-auto">
                        <button 
                          onClick={() => setViewTeamManager(manager)}
                          className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-violet-100 hover:bg-violet-200 dark:bg-violet-950/40 dark:hover:bg-violet-900/60 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-900/40 transition-colors"
                        >
                          {teamCount} agent{teamCount !== 1 ? 's' : ''} in team
                        </button>
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold border ${count > 0 ? 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-900/50' : 'bg-white text-gray-500 border-gray-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'}`}>
                          {count} {count === 1 ? 'Lead' : 'Leads'}
                        </span>
                        <button
                          onClick={() => openAssignModal(manager)}
                          className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white transition-colors shadow-sm"
                        >
                          Assign Agents
                        </button>
                        <button
                          onClick={() => handleToggleManager(manager)}
                          disabled={!!loadingAction[`mgr_${manager.id}`]}
                          title="Remove Manager role"
                          className="text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-all disabled:opacity-50 bg-red-50 hover:bg-red-100 text-red-600 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/40"
                        >
                          {loadingAction[`mgr_${manager.id}`] ? '...' : 'Remove Manager'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active Agents Section */}
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl shadow-xl rounded-2xl p-6 md:p-8 border border-gray-200/50 dark:border-slate-700/50">
            <div className="border-b border-gray-200 dark:border-slate-700 pb-5 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
                  <span className="bg-orange-100 dark:bg-orange-900/50 p-2 rounded-xl text-orange-600 dark:text-orange-400">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                  </span>
                  Active Team
                  <span className="bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 text-sm py-0.5 px-2.5 rounded-full font-bold ml-1">{activeAgentsList.length}</span>
                </h3>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 font-medium">Manage your travel agents and promote them to manager role.</p>
              </div>
              <div className="relative w-full md:w-72">
                <input
                  type="text"
                  aria-label="Search agents by name, email, phone, or status"
                  placeholder="Search agent by name, email, phone, or status..."
                  value={globalSearchQuery}
                  onChange={(e) => setGlobalSearchQuery(e.target.value)}
                  className="w-full text-sm bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 dark:text-slate-100 shadow-sm"
                />
                <svg className="w-4 h-4 text-gray-400 absolute left-3 top-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
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

        {/* Right Sidebar — Pending Approvals */}
        <div className="lg:w-1/4">
          <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl shadow-xl rounded-2xl p-5 border border-orange-200 dark:border-orange-900/50 relative overflow-hidden sticky top-24">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-orange-400 via-orange-500 to-red-500"></div>
            <div className="border-b border-gray-100 dark:border-slate-700 pb-4 mb-5 flex flex-col gap-1 pt-1">
              <h3 className="text-base font-black text-gray-900 dark:text-white flex items-center justify-between">
                Pending Approvals
                {pendingAgentsList.length > 0 && (
                  <span className="bg-red-500 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-md animate-pulse">{pendingAgentsList.length}</span>
                )}
              </h3>
              <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-tight font-medium mt-1">Agents awaiting admin review.</p>
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

      {/* View Team Modal */}
      {viewTeamManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 w-full max-w-sm flex flex-col overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 dark:border-slate-800">
              <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                Team Members
              </h3>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Agents assigned to {viewTeamManager.name}</p>
            </div>
            <div className="p-6 max-h-[50vh] overflow-y-auto">
              {(() => {
                const teamMembers = agents.filter(a => a.managerId === viewTeamManager.id || a.managerId === viewTeamManager._id);
                if (teamMembers.length === 0) {
                  return <p className="text-sm text-gray-500">No agents assigned.</p>;
                }
                return (
                  <ul className="space-y-2">
                    {teamMembers.map(member => (
                      <li key={member.id}>
                        <Link 
                          to={`/agents/${getAgentSlug(member)}`}
                          onClick={() => setViewTeamManager(null)}
                          className="flex items-center gap-3 p-3 bg-gray-50 hover:bg-violet-50 dark:bg-slate-800/50 dark:hover:bg-slate-700/80 rounded-xl border border-gray-100 dark:border-slate-700 hover:border-violet-200 dark:hover:border-violet-900/50 transition-all group cursor-pointer"
                        >
                          <div className="h-8 w-8 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 flex items-center justify-center font-bold text-xs shrink-0 group-hover:scale-105 transition-transform">
                            {(member.name || '').split(' ').map(n => n?.[0] || '').join('')}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-violet-700 dark:group-hover:text-violet-400 transition-colors">{member.name}</span>
                            <span className="text-[10px] font-mono text-gray-500">{member.email}</span>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                );
              })()}
            </div>
            <div className="px-6 py-4 bg-gray-50 dark:bg-slate-800/50 border-t border-gray-100 dark:border-slate-700 flex justify-end">
              <button
                onClick={() => setViewTeamManager(null)}
                className="px-4 py-2 text-sm font-bold text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Agents Modal */}
      {assignModalManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-gray-100 dark:border-slate-800">
              <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                <span className="bg-violet-100 dark:bg-violet-900/50 p-1.5 rounded-lg text-violet-600 dark:text-violet-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                </span>
                Assign Agents to {assignModalManager.name}
              </h3>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Select agents to assign under this manager. Previously assigned agents will be replaced.</p>
            </div>
            
            {/* Search Input */}
            <div className="px-6 py-3 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30">
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </span>
                <input
                  type="text"
                  placeholder="Search agents by name or email..."
                  value={assignSearchQuery}
                  onChange={(e) => setAssignSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 dark:text-white transition-shadow shadow-sm"
                />
              </div>
            </div>

            {/* Agent list */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
              {assignableAgents.length === 0 ? (
                <p className="text-sm text-center text-gray-400 dark:text-slate-500 py-8">No eligible agents available.</p>
              ) : assignableAgents.map(agent => {
                const isSelected = selectedAgentIds.includes(agent.id);
                const currentManager = agents.find(a => a.isManager && (a.id === agent.managerId || a._id === agent.managerId));
                return (
                  <button
                    key={agent.id}
                    onClick={() => toggleAgentSelection(agent.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${isSelected ? 'bg-violet-50 dark:bg-violet-950/40 border-violet-300 dark:border-violet-700' : 'bg-gray-50 dark:bg-slate-800/60 border-gray-200 dark:border-slate-700 hover:bg-violet-50/50 dark:hover:bg-violet-950/20'}`}
                  >
                    <div className={`flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-violet-600 border-violet-600' : 'border-gray-300 dark:border-slate-600'}`}>
                      {isSelected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{agent.name}</p>
                      <p className="text-[11px] text-gray-500 dark:text-slate-400 font-mono truncate">{agent.email}</p>
                    </div>
                    {currentManager && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-400 flex-shrink-0">
                        {currentManager.id === assignModalManager.id ? 'Current' : currentManager.name}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-800 flex gap-3">
              <button
                onClick={() => setAssignModalManager(null)}
                className="flex-1 py-2.5 text-sm font-bold text-gray-600 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAssign}
                disabled={assignLoading}
                className="flex-1 py-2.5 text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl transition-colors disabled:opacity-50 shadow-sm"
              >
                {assignLoading ? 'Saving...' : `Assign ${selectedAgentIds.length} Agent${selectedAgentIds.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

