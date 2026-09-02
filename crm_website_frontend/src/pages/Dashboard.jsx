import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import AgentMultiSelect from '../components/AgentMultiSelect';

const STATUS_OPTIONS = [
  { value: 'Fresh Leads', color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800' },
  { value: 'Interested Leads', color: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-800' },
  { value: 'Pre Prospect Leads', color: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800' },
  { value: 'Prospect Leads', color: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-800' },
  { value: 'Booked', color: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/60 dark:text-green-300 dark:border-green-700' },
  { value: 'Rejected Leads', color: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/60 dark:text-red-300 dark:border-red-700' },
];

export default function Dashboard({ agents = [], products = [], statuses = [], assignAgent, updateLead, user }) {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('card'); // 'card' or 'list'
  const userId = user?.id || user?._id || 'guest';
  const isAdmin = user && user.isAdmin;

  // Search & Filter State (persisted in sessionStorage)
  const [searchQuery, setSearchQuery] = useState(() => sessionStorage.getItem(`dashboard_${userId}_searchQuery`) || '');
  const [filterAgent, setFilterAgent] = useState(() => sessionStorage.getItem(`dashboard_${userId}_filterAgent`) || (isAdmin ? 'unassigned' : 'all'));
  const [sortBy, setSortBy] = useState(() => sessionStorage.getItem(`dashboard_${userId}_sortBy`) || 'newest');
  const [filterStatus, setFilterStatus] = useState(() => sessionStorage.getItem(`dashboard_${userId}_filterStatus`) || 'all');
  const [filterProduct, setFilterProduct] = useState(() => sessionStorage.getItem(`dashboard_${userId}_filterProduct`) || 'all');

  // Server-side Pagination & Leads State
  const [leads, setLeads] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [isLoadingLeads, setIsLoadingLeads] = useState(true);

  // Summary Metrics State (pre-aggregated counts from /leads/counts)
  const [summaryCounts, setSummaryCounts] = useState({
    totalLeads: 0,
    allActiveCount: 0,
    unassignedCount: 0,
    assignedCount: 0,
    statusCounts: {},
    productCounts: {},
    agentCounts: {}
  });

  const defaultProducts = [
    "Meghalaya Package",
    "Hampta Pass Trek",
    "Rishikesh Activities",
    "Spiti Package",
    "Ladakh Package",
    "Kerala Trip",
    "Adventure Activities",
    "Others",
    "Arunachal Pradesh Package",
    "Goa Package",
    "Darjeeling Gangtok Package"
  ];

  const allAvailableProducts = useMemo(() => {
    const set = new Set((products && products.length > 0) ? products : defaultProducts);
    Object.keys(summaryCounts.productCounts || {}).forEach(p => p && set.add(p));
    Object.keys(summaryCounts.scopedProductCounts || {}).forEach(p => p && set.add(p));
    return Array.from(set);
  }, [products, summaryCounts.productCounts, summaryCounts.scopedProductCounts]);

  const getAgentLeadCount = useCallback((agentId) => {
    return summaryCounts.agentCounts?.[String(agentId || '')] || 0;
  }, [summaryCounts.agentCounts]);

  // Persist filter settings to sessionStorage
  useEffect(() => {
    const prefix = `dashboard_${userId}_`;
    sessionStorage.setItem(`${prefix}searchQuery`, searchQuery);
    sessionStorage.setItem(`${prefix}filterAgent`, filterAgent);
    sessionStorage.setItem(`${prefix}sortBy`, sortBy);
    sessionStorage.setItem(`${prefix}filterStatus`, filterStatus);
    sessionStorage.setItem(`${prefix}filterProduct`, filterProduct);
  }, [searchQuery, filterAgent, sortBy, filterStatus, filterProduct, userId]);

  // Validate agent selection from dropdown
  useEffect(() => {
    if (!agents || agents.length === 0) return;
    const specialOptions = ['unassigned', 'assigned', 'all'];
    if (specialOptions.includes(filterAgent)) return;

    const isEligible = agents.some(agent => {
      const st = agent.status || 'Active';
      const isItinerary = agent.isItinerary || agent.role === 'itinerary';
      const isEligibleAgent = st !== 'Inactive' && st !== 'Former Employee' && !isItinerary;
      const agentId = String(agent.id || agent._id || '');
      return isEligibleAgent && agentId === String(filterAgent);
    });

    if (!isEligible) {
      setFilterAgent(isAdmin ? 'unassigned' : 'all');
    }
  }, [agents, filterAgent, isAdmin]);

  const abortCountsRef = useRef(null);
  const abortLeadsRef = useRef(null);

  // Fetch summary badge counts (once on mount, and whenever assignments or filterAgent update)
  const fetchCounts = useCallback(async () => {
    if (abortCountsRef.current) {
      abortCountsRef.current.abort();
    }
    const controller = new AbortController();
    abortCountsRef.current = controller;

    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const params = new URLSearchParams({
        scopedAgentFilter: filterAgent || ''
      });
      const res = await fetch(`${import.meta.env.VITE_API_URL}/leads/counts?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: controller.signal
      });
      if (res.ok) {
        const data = await res.json();
        if (abortCountsRef.current === controller) {
          setSummaryCounts(data);
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error fetching lead counts:', err);
      }
    }
  }, [filterAgent]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  // Fetch paginated leads from server
  const fetchLeads = useCallback(async (targetPage = page) => {
    if (abortLeadsRef.current) {
      abortLeadsRef.current.abort();
    }
    const controller = new AbortController();
    abortLeadsRef.current = controller;

    setIsLoadingLeads(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const params = new URLSearchParams({
        page: targetPage,
        limit: 50,
        search: searchQuery.trim(),
        status: filterStatus,
        product: filterProduct,
        sortBy: sortBy,
        filterAgent: filterAgent,
        pagination: 'true'
      });

      const res = await fetch(`${import.meta.env.VITE_API_URL}/leads?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: controller.signal
      });

      if (res.ok) {
        const data = await res.json();
        if (abortLeadsRef.current === controller) {
          const leadsArray = data.leads || [];
          setLeads(leadsArray);
          setTotalCount(data.totalCount || 0);
          setTotalPages(data.totalPages || 1);

          // Sync lead IDs to sessionStorage for lead detail prev/next buttons
          const activeIds = leadsArray.map(l => l.id || l._id);
          sessionStorage.setItem('activeLeadIds', JSON.stringify(activeIds));
          sessionStorage.setItem('leadDetail_backUrl', '/');
          sessionStorage.setItem('leadDetail_backLabel', 'Dashboard');
        }
      } else {
        if (abortLeadsRef.current === controller) {
          toast.error('Failed to load leads from server');
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error fetching paginated leads:', err);
        if (abortLeadsRef.current === controller) {
          toast.error('Could not connect to server');
        }
      }
    } finally {
      if (abortLeadsRef.current === controller) {
        setIsLoadingLeads(false);
      }
    }
  }, [page, searchQuery, filterStatus, filterProduct, sortBy, filterAgent]);

  // Debounced search / filter trigger
  useEffect(() => {
    // If search text is present, debounce 300ms so we don't spam the server on every keystroke
    if (searchQuery.trim().length > 0) {
      const timer = setTimeout(() => {
        fetchLeads(page);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      fetchLeads(page);
    }
  }, [fetchLeads, page, searchQuery]);

  // When filters change (search, agent, status, product, sort), reset page back to 1
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setPage(1);
  };

  const handleFilterAgentChange = (e) => {
    setFilterAgent(e.target.value);
    setPage(1);
  };

  const handleSortChange = (e) => {
    setSortBy(e.target.value);
    setPage(1);
  };

  const handleFilterProductChange = (e) => {
    setFilterProduct(e.target.value);
    setPage(1);
  };

  const handleFilterStatusChange = (e) => {
    setFilterStatus(e.target.value);
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setFilterAgent(isAdmin ? 'unassigned' : 'all');
    setFilterProduct('all');
    setFilterStatus('all');
    setSortBy('newest');
    setPage(1);
  };

  // Modal Editing State
  const [editingLead, setEditingLead] = useState(null);
  const [modalData, setModalData] = useState({
    name: '',
    phone: '',
    origin: '',
    destination: '',
    leadSource: '',
    product: '',
    mailId: ''
  });

  useEffect(() => {
    if (editingLead) {
      setModalData({
        name: editingLead.name || '',
        phone: editingLead.phone || '',
        origin: editingLead.origin || '',
        destination: editingLead.destination || '',
        leadSource: editingLead.leadSource || '',
        product: editingLead.product || '',
        mailId: editingLead.mailId || ''
      });
    }
  }, [editingLead]);

  const handleModalPhoneChange = (e) => {
    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
    setModalData(prev => ({ ...prev, phone: val }));
  };

  const handleModalSubmit = async (e) => {
    e.preventDefault();
    if (!editingLead) return;
    if (!modalData.phone) {
      toast.error("Phone number is required");
      return;
    }
    if (modalData.phone.length !== 10) {
      toast.error("Phone number must be exactly 10 digits");
      return;
    }
    const success = await updateLead(editingLead.id, modalData);
    if (success) {
      // Optimistically update card in view
      setLeads(prev => prev.map(l => (l.id === editingLead.id ? { ...l, ...modalData } : l)));
      setEditingLead(null);
      fetchCounts();
    }
  };

  // Inline Agent Assignment (instant 0 ms state update + background save)
  const handleInlineAssign = async (leadId, newIds) => {
    // Optimistically update agentIds in local state
    setLeads(prev => {
      const updated = prev.map(lead => {
        if ((lead.id || lead._id) === leadId) {
          return { ...lead, agentIds: newIds };
        }
        return lead;
      });

      // If viewing "unassigned only", remove the lead once it gets assigned
      if (filterAgent === 'unassigned' && newIds && newIds.length > 0) {
        return updated.filter(lead => (lead.id || lead._id) !== leadId);
      }
      // If viewing "assigned only", remove the lead once it gets unassigned
      if (filterAgent === 'assigned' && (!newIds || newIds.length === 0)) {
        return updated.filter(lead => (lead.id || lead._id) !== leadId);
      }
      // If viewing a specific agent's leads and they were removed from that agent
      const specialOptions = ['unassigned', 'assigned', 'all'];
      if (!specialOptions.includes(filterAgent) && !newIds.includes(filterAgent)) {
        return updated.filter(lead => (lead.id || lead._id) !== leadId);
      }

      return updated;
    });

    await assignAgent(leadId, newIds);
    fetchCounts();
  };

  const getAgentId = (agent) => (agent ? String(agent.id || agent._id || '') : '');

  const hasActiveFilters = searchQuery || (isAdmin ? filterAgent !== 'unassigned' : filterAgent !== 'all') || filterProduct !== 'all' || filterStatus !== 'all' || sortBy !== 'newest';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Top Header */}
      <div className="sm:flex sm:items-center justify-between">
        <div className="sm:flex-auto">
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white tracking-tight">Leads Dashboard</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Monitor incoming client travel requests and assign them to your team of agents.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center space-x-2 bg-gray-200/60 dark:bg-slate-700/60 p-1 rounded-xl">
          <button
            onClick={() => setViewMode('card')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${viewMode === 'card'
              ? 'bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
          >
            Grid Card
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${viewMode === 'list'
              ? 'bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
          >
            Clean List
          </button>
        </div>
      </div>

      {/* Metrics Dashboard */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 mt-8">
        {/* Total Leads Card */}
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 rounded-xl border border-gray-100 dark:border-slate-700/50 p-6 relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-transparent dark:from-blue-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider relative z-10">
            {hasActiveFilters ? 'Matching Leads' : 'Active Leads'}
          </p>
          <p className="text-3xl font-extrabold bg-gradient-to-br from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 bg-clip-text text-transparent mt-1 relative z-10">
            {totalCount}
            <span className="text-sm text-gray-500 dark:text-gray-400 font-medium ml-2">/ {summaryCounts.totalLeads || totalCount}</span>
          </p>
        </div>

        {/* Assigned Leads Card */}
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 rounded-xl border border-gray-100 dark:border-slate-700/50 p-6 relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-green-50 to-transparent dark:from-green-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider relative z-10">Assigned Active</p>
          <p className="text-3xl font-extrabold bg-gradient-to-br from-green-600 to-emerald-500 dark:from-green-400 dark:to-emerald-300 bg-clip-text text-transparent mt-1 relative z-10">
            {summaryCounts.assignedCount} <span className="text-xs text-gray-400 font-medium">({summaryCounts.allActiveCount > 0 ? Math.round((summaryCounts.assignedCount / summaryCounts.allActiveCount) * 100) : 0}%)</span>
          </p>
        </div>

        {/* Unassigned Leads Card */}
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 rounded-xl border border-gray-100 dark:border-slate-700/50 p-6 relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-50 to-transparent dark:from-orange-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider relative z-10">Unassigned Active</p>
          <p className="text-3xl font-extrabold bg-gradient-to-br from-orange-500 to-amber-500 dark:from-orange-400 dark:to-amber-300 bg-clip-text text-transparent mt-1 relative z-10">
            {summaryCounts.unassignedCount} <span className="text-xs text-gray-400 font-medium">({summaryCounts.allActiveCount > 0 ? Math.round((summaryCounts.unassignedCount / summaryCounts.allActiveCount) * 100) : 0}%)</span>
          </p>
        </div>
      </div>



      {/* Search and Filters Section */}
      <div className="mt-8 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md p-4 sm:p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700/50 transition-all duration-300 hover:shadow-md space-y-4">
        {/* Full Width Search Bar */}
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 dark:text-slate-500">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search by name, phone, origin, destination, or package..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="block w-full pl-11 pr-10 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 sm:text-sm bg-gray-50/70 dark:bg-slate-900/70 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 transition-all shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setPage(1); }}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 cursor-pointer"
              title="Clear search"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100 dark:border-slate-700/50">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            {isAdmin && (
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-gray-400 dark:text-slate-400 uppercase tracking-wider">Agent:</span>
                <select
                  value={filterAgent}
                  onChange={handleFilterAgentChange}
                  className="pl-3 pr-8 py-2 text-xs border border-gray-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 rounded-xl bg-white dark:bg-slate-900 cursor-pointer text-gray-700 dark:text-slate-200 font-medium shadow-sm transition-all"
                >
                  <option value="unassigned">Unassigned Only (Default) ({summaryCounts.unassignedCount} leads)</option>
                  <option value="assigned">Assigned Only ({summaryCounts.assignedCount} leads)</option>
                  <option value="all">Unassigned & Assigned (All) ({summaryCounts.allActiveCount} leads)</option>
                  {agents
                    .filter(agent => {
                      const st = agent.status || 'Active';
                      const isItinerary = agent.isItinerary || agent.role === 'itinerary';
                      return st !== 'Inactive' && st !== 'Former Employee' && !isItinerary;
                    })
                    .map((agent) => {
                      const agentId = getAgentId(agent);
                      const count = getAgentLeadCount(agentId);
                      return (
                        <option key={agentId} value={agentId}>
                          {agent.name} ({count} {count === 1 ? 'lead' : 'leads'})
                        </option>
                      );
                    })}
                </select>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-gray-400 dark:text-slate-400 uppercase tracking-wider">Sort:</span>
              <select
                value={sortBy}
                onChange={handleSortChange}
                className="pl-3 pr-8 py-2 text-xs border border-gray-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 rounded-xl bg-white dark:bg-slate-900 cursor-pointer text-gray-700 dark:text-slate-200 font-medium shadow-sm transition-all"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="name-asc">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-gray-400 dark:text-slate-400 uppercase tracking-wider">Package:</span>
              <select
                value={filterProduct}
                onChange={handleFilterProductChange}
                className="pl-3 pr-8 py-2 text-xs border border-gray-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 rounded-xl bg-white dark:bg-slate-900 cursor-pointer text-gray-700 dark:text-slate-200 font-medium shadow-sm transition-all"
              >
                <option value="all">All Packages</option>
                {allAvailableProducts
                  .sort((a, b) => {
                    const countA = (summaryCounts.scopedProductCounts || summaryCounts.productCounts)?.[a] || 0;
                    const countB = (summaryCounts.scopedProductCounts || summaryCounts.productCounts)?.[b] || 0;
                    if (countA !== countB) return countB - countA;
                    return a.localeCompare(b);
                  })
                  .map(prod => {
                    const count = (summaryCounts.scopedProductCounts || summaryCounts.productCounts)?.[prod] || 0;
                    return (
                      <option key={prod} value={prod}>
                        {prod} {count > 0 ? `(${count})` : ''}
                      </option>
                    );
                  })}
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-gray-400 dark:text-slate-400 uppercase tracking-wider">Status:</span>
              <select
                value={filterStatus}
                onChange={handleFilterStatusChange}
                className="pl-3 pr-8 py-2 text-xs border border-gray-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 rounded-xl bg-white dark:bg-slate-900 cursor-pointer text-gray-700 dark:text-slate-200 font-medium shadow-sm transition-all"
              >
                <option value="all">All Active Statuses ({summaryCounts.allActiveCount} leads)</option>
                {((statuses && statuses.length > 0) ? statuses : STATUS_OPTIONS.map(s => s.value)).map(st => {
                  const count = summaryCounts.statusCounts?.[st] || 0;
                  return (
                    <option key={st} value={st}>{st} ({count})</option>
                  );
                })}
              </select>
            </div>
          </div>

          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="text-xs font-semibold text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 transition-colors cursor-pointer py-1 px-2.5 rounded-lg bg-orange-50 dark:bg-orange-950/40 hover:bg-orange-100 dark:hover:bg-orange-900/50"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Leads Content Section */}
      {isLoadingLeads ? (
        <div className="mt-8 flex flex-col items-center justify-center py-20 bg-white/80 dark:bg-slate-800/80 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-sm font-semibold text-gray-500 dark:text-slate-400">Loading leads...</p>
        </div>
      ) : leads.length === 0 ? (
        <div className="mt-8 text-center py-16 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">No matching leads found</h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Try adjusting your search query or filters.</p>
        </div>
      ) : viewMode === 'card' ? (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 items-start">
          {leads.map((lead) => {
            const currentAgentIds = lead.agentIds || [];
            const assignedAgents = currentAgentIds.map(id => agents.find(a => a.id === id || a._id === id)).filter(Boolean);
            const agentDisplayNames = assignedAgents.length > 0 ? assignedAgents.map(a => a.name).join(', ') : 'Unassigned';

            return (
              <div
                key={lead.id || lead._id}
                onClick={(e) => {
                  if (!e.target.closest('button, input, select, textarea, a, label')) {
                    navigate(`/leads/${lead.id || lead._id}`);
                  }
                }}
                className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 hover:scale-[1.01] transition-all duration-300 overflow-visible flex flex-col justify-between border border-gray-100 dark:border-slate-700/50 p-6 relative group cursor-pointer"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-lg font-bold transition-colors relative z-20">
                          <Link to={`/leads/${lead.id || lead._id}`} className="text-orange-600 hover:text-orange-800 underline decoration-orange-300/50 hover:decoration-orange-800 flex items-center gap-1.5 group">
                            <span>{lead.name || 'Unnamed Lead'}</span>
                            <svg className="w-4 h-4 text-orange-400 group-hover:text-orange-800 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </Link>
                        </h3>
                        {(isAdmin || (lead.agentIds || []).includes(user?.id || user?._id)) && (
                          <button
                            onClick={() => setEditingLead(lead)}
                            className="text-gray-400 hover:text-orange-600 cursor-pointer p-1 rounded transition-colors relative z-20"
                            title="Edit Lead"
                          >
                            <svg style={{ width: '13px', height: '13px', stroke: 'currentColor' }} fill="none" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          {lead.phone}
                        </span>
                        {lead.product && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border border-purple-100/30">
                            {lead.product}
                          </span>
                        )}
                      </div>
                      {lead.createdBy && lead.createdBy.name && (
                        <div className="mt-1 text-xs text-gray-400">
                          Created by: {lead.createdBy.name}{lead.createdBy.email ? ` , ${lead.createdBy.email}` : ''}
                        </div>
                      )}
                    </div>
                    {/* Status Badge */}
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${(STATUS_OPTIONS.find(s => s.value === (lead.status || 'Fresh Leads')) || STATUS_OPTIONS[0]).color}`}>
                      {lead.status || 'Fresh Leads'}
                    </span>
                  </div>

                  <div className="mt-4">
                    <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-3 flex items-center justify-between border border-gray-100 dark:border-slate-700/50">
                      <div className="text-center flex-1 overflow-hidden">
                        <span className="block text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Origin</span>
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate block">{lead.origin || '—'}</span>
                      </div>
                      <div className="px-2 text-orange-500 font-bold">➔</div>
                      <div className="text-center flex-1 overflow-hidden">
                        <span className="block text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Destination</span>
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate block">{lead.destination || '—'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-100 dark:border-slate-700/50 space-y-4">
                  <div>
                    <span className="block text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-2">
                      {assignedAgents.length > 0 ? 'Assigned To' : 'Assign Lead'}
                    </span>

                    {isAdmin ? (
                      <div className="flex items-center space-x-2">
                        <AgentMultiSelect
                          agents={agents}
                          selectedAgentIds={lead.agentIds || []}
                          onChange={(newIds) => handleInlineAssign(lead.id || lead._id, newIds)}
                          getAgentLeadCount={getAgentLeadCount}
                        />
                      </div>
                    ) : (
                      <div className="text-xs font-semibold text-gray-700 dark:text-slate-200 bg-gray-50/60 dark:bg-slate-900/50 px-3 py-2 rounded-lg border border-gray-100 dark:border-slate-800">
                        {agentDisplayNames}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {leads.map((lead) => {
            const currentAgentIds = lead.agentIds || [];
            const assignedAgents = currentAgentIds.map(id => agents.find(a => a.id === id || a._id === id)).filter(Boolean);
            const agentDisplayNames = assignedAgents.length > 0 ? assignedAgents.map(a => a.name).join(', ') : 'Unassigned';

            return (
              <div
                key={lead.id || lead._id}
                onClick={(e) => {
                  if (!e.target.closest('button, input, select, textarea, a, label')) {
                    navigate(`/leads/${lead.id || lead._id}`);
                  }
                }}
                className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-2xl shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 border border-gray-100 dark:border-slate-700/50 p-5 flex flex-col space-y-4 cursor-pointer"
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-center">
                  <div className="lg:col-span-4 flex items-center">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-base font-bold transition-colors">
                          <Link to={`/leads/${lead.id || lead._id}`} className="text-orange-600 hover:text-orange-800 underline decoration-orange-300/50 hover:decoration-orange-800 flex items-center gap-1.5 group">
                            <span>{lead.name || 'Unnamed Lead'}</span>
                            <svg className="w-3.5 h-3.5 text-orange-400 group-hover:text-orange-800 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </Link>
                        </h3>
                        {(isAdmin || (lead.agentIds || []).includes(user?.id || user?._id)) && (
                          <button
                            onClick={() => setEditingLead(lead)}
                            className="text-gray-400 hover:text-orange-600 cursor-pointer p-1 rounded transition-colors"
                            title="Edit Lead"
                          >
                            <svg style={{ width: '13px', height: '13px', stroke: 'currentColor' }} fill="none" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          {lead.phone}
                        </span>
                        {lead.product && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border border-purple-100/30">
                            {lead.product}
                          </span>
                        )}
                      </div>
                      {lead.createdBy && lead.createdBy.name && (
                        <div className="mt-1 text-xs text-gray-400">
                          Created by: {lead.createdBy.name}{lead.createdBy.email ? ` , ${lead.createdBy.email}` : ''}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="lg:col-span-3 flex items-center space-x-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl px-4 py-2 w-full">
                    <div className="text-center flex-1">
                      <span className="block text-[9px] uppercase tracking-wider text-gray-400 font-semibold">Origin</span>
                      <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{lead.origin || '—'}</span>
                    </div>
                    <div className="px-2 text-orange-500 font-bold text-sm">➔</div>
                    <div className="text-center flex-1">
                      <span className="block text-[9px] uppercase tracking-wider text-gray-400 font-semibold">Destination</span>
                      <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{lead.destination || '—'}</span>
                    </div>
                  </div>

                  <div className="lg:col-span-2 flex flex-col xl:flex-row items-start xl:items-center gap-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border whitespace-nowrap ${(STATUS_OPTIONS.find(s => s.value === (lead.status || 'Fresh Leads')) || STATUS_OPTIONS[0]).color}`}>
                      {lead.status || 'Fresh Leads'}
                    </span>
                  </div>

                  <div className="lg:col-span-3 flex items-center space-x-2 justify-end w-full">
                    {isAdmin ? (
                      <div className="w-full max-w-[180px]">
                        <AgentMultiSelect
                          agents={agents}
                          selectedAgentIds={lead.agentIds || []}
                          onChange={(newIds) => handleInlineAssign(lead.id || lead._id, newIds)}
                          getAgentLeadCount={getAgentLeadCount}
                        />
                      </div>
                    ) : (
                      <div className="text-xs font-semibold text-gray-700 dark:text-slate-200 bg-gray-50/60 dark:bg-slate-900/50 px-3 py-1.5 rounded-lg border border-gray-100 dark:border-slate-800 min-w-[120px] text-center">
                        {agentDisplayNames}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md p-4 rounded-2xl border border-gray-100 dark:border-slate-700/50 shadow-sm">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Showing <span className="font-bold text-gray-800 dark:text-gray-200">{(page - 1) * 50 + 1}</span> to <span className="font-bold text-gray-800 dark:text-gray-200">{Math.min(page * 50, totalCount)}</span> of <span className="font-bold text-gray-800 dark:text-gray-200">{totalCount}</span> leads
          </p>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || isLoadingLeads}
              className="px-3.5 py-2 text-xs font-bold rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-200 hover:bg-orange-50 dark:hover:bg-orange-950/40 hover:text-orange-600 dark:hover:text-orange-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm"
            >
              ← Previous
            </button>
            <div className="flex items-center space-x-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum = i + 1;
                if (totalPages > 5 && page > 3) {
                  pageNum = Math.min(totalPages - 4 + i, page - 2 + i);
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer ${page === pageNum
                      ? 'bg-orange-600 text-white shadow-md shadow-orange-500/20'
                      : 'bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                      }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || isLoadingLeads}
              className="px-3.5 py-2 text-xs font-bold rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-200 hover:bg-orange-50 dark:hover:bg-orange-950/40 hover:text-orange-600 dark:hover:text-orange-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Edit Lead Modal */}
      {editingLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100 dark:border-slate-700">
            <div className="bg-orange-500 px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Edit Client Lead</h3>
              <button
                onClick={() => setEditingLead(null)}
                className="text-white/80 hover:text-white text-xl cursor-pointer bg-transparent border-0 font-bold"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleModalSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Full Name</label>
                <input
                  type="text"
                  value={modalData.name}
                  onChange={(e) => setModalData({ ...modalData, name: e.target.value })}
                  className="w-full text-sm py-2 px-3 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-700 bg-white dark:bg-slate-900 dark:text-gray-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={modalData.phone}
                    onChange={handleModalPhoneChange}
                    className="w-full text-sm py-2 px-3 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-700 bg-white dark:bg-slate-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Mail ID</label>
                  <input
                    type="email"
                    value={modalData.mailId}
                    onChange={(e) => setModalData({ ...modalData, mailId: e.target.value })}
                    className="w-full text-sm py-2 px-3 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-700 bg-white dark:bg-slate-900 dark:text-gray-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Lead Source</label>
                  <select
                    value={modalData.leadSource}
                    onChange={(e) => setModalData({ ...modalData, leadSource: e.target.value })}
                    className="w-full text-sm py-2 px-3 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-700 bg-white dark:bg-slate-900 dark:text-gray-100 cursor-pointer"
                  >
                    <option value="">Select a source...</option>
                    <option value="Instagram">Instagram</option>
                    <option value="Facebook">Facebook</option>
                    <option value="AdCampaign">AdCampaign</option>
                    <option value="Referral">Referral</option>
                    <option value="Website">Website</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Origin City</label>
                  <input
                    type="text"
                    value={modalData.origin}
                    onChange={(e) => setModalData({ ...modalData, origin: e.target.value })}
                    className="w-full text-sm py-2 px-3 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-700 bg-white dark:bg-slate-900 dark:text-gray-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Product</label>
                  <select
                    value={modalData.product}
                    onChange={(e) => setModalData({ ...modalData, product: e.target.value })}
                    className="w-full text-sm py-2 px-3 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-700 bg-white dark:bg-slate-900 dark:text-gray-100 cursor-pointer"
                  >
                    <option value="">Select a product...</option>
                    {products.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Destination</label>
                  <input
                    type="text"
                    value={modalData.destination}
                    onChange={(e) => setModalData({ ...modalData, destination: e.target.value })}
                    className="w-full text-sm py-2 px-3 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-700 bg-white dark:bg-slate-900 dark:text-gray-100"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingLead(null)}
                  className="px-4 py-2 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 rounded-lg text-sm font-semibold hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-semibold cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}