import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import NoteItem from '../components/NoteItem';
import AgentMultiSelect from '../components/AgentMultiSelect';

const STATUS_OPTIONS = [
  { value: 'New', color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800' },
  { value: 'Contacted', color: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800' },
  { value: 'Follow Up', color: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-800' },
  { value: 'Interested', color: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-800' },
  { value: 'Booked', color: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/60 dark:text-green-300 dark:border-green-700' },
  { value: 'Rejected', color: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/60 dark:text-red-300 dark:border-red-700' },
  { value: 'Closed', color: 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800/60 dark:text-gray-300 dark:border-gray-700' },
];

export const LEGACY_STATUS_MAP = {
  'Fresh Leads': 'New',
  'Interested Leads': 'Interested',
  'Pre Prospect Leads': 'Contacted',
  'Prospect Leads': 'Follow Up',
  'Rejected Leads': 'Rejected'
};

export default function Dashboard({ leads, agents, assignAgent, addNote, deleteNote, updateLead, user, loading }) {
  const [viewMode, setViewMode] = useState('card'); // 'card' or 'list'
  const [noteInputs, setNoteInputs] = useState({}); // { [leadId]: 'comment text' }
  const [selectedImages, setSelectedImages] = useState({}); // { [leadId]: 'base64...' }
  const [imageFiles, setImageFiles] = useState({}); // { [leadId]: File }
  const [isUploading, setIsUploading] = useState({}); // { [leadId]: boolean }
  const [expandedNotes, setExpandedNotes] = useState({}); // { [leadId]: true/false }
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAgent, setFilterAgent] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterProduct, setFilterProduct] = useState('all');

  // Modal editing state
  const [editingLead, setEditingLead] = useState(null);
  const [modalData, setModalData] = useState({
    name: '',
    phone: '',
    age: '',
    origin: '',
    destination: '',
    leadSource: '',
    product: '',
    mailId: ''
  });

  const isAdmin = user && user.isAdmin;

  useEffect(() => {
    if (editingLead) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setModalData({
        name: editingLead.name || '',
        phone: editingLead.phone || '',
        age: editingLead.age || '',
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
      setEditingLead(null);
    }
  };

  const getAgentLeadCount = (agentId) => {
    return leads.filter((lead) => (lead.agentIds || []).includes(agentId)).length;
  };

  const handleInlineAssign = async (leadId, newIds) => {
    await assignAgent(leadId, newIds);
  };

  const toggleNotes = (leadId) => {
    setExpandedNotes(prev => ({
      ...prev,
      [leadId]: !prev[leadId]
    }));
  };

  const handleImageChange = (leadId, e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    setImageFiles(prev => ({ ...prev, [leadId]: file }));
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImages(prev => ({ ...prev, [leadId]: reader.result }));
      };
      reader.readAsDataURL(file);
    } else {
      setSelectedImages(prev => ({ ...prev, [leadId]: `DOCUMENT:${file.name}` }));
    }
  };

  const handleSendNote = async (leadId) => {
    const text = noteInputs[leadId] || '';
    const file = imageFiles[leadId];
    if (!text.trim() && !file) return;

    setIsUploading(prev => ({ ...prev, [leadId]: true }));
    try {
      let finalImageUrl = null;
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        const uploadRes = await fetch(`${import.meta.env.VITE_API_URL}/upload`, {
          method: 'POST',
          body: formData
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          finalImageUrl = uploadData.fileUrl;
        } else {
          toast.error('Failed to upload image');
          setIsUploading(prev => ({ ...prev, [leadId]: false }));
          return;
        }
      }

      const success = await addNote(leadId, text.trim(), finalImageUrl);
      if (success) {
        setNoteInputs(prev => ({ ...prev, [leadId]: '' }));
        setSelectedImages(prev => ({ ...prev, [leadId]: '' }));
        setImageFiles(prev => ({ ...prev, [leadId]: null }));
      }
    } catch {
      toast.error('Failed to send note');
    } finally {
      setIsUploading(prev => ({ ...prev, [leadId]: false }));
    }
  };

  // Metrics calculations
  const totalLeads = leads.length;
  const assignedLeads = leads.filter(lead => (lead.agentIds || []).some(id => agents.some(a => a.id === id))).length;
  const unassignedLeads = totalLeads - assignedLeads;



  // Filter logic
  const filteredLeads = leads.filter((lead) => {
    const agentNames = (lead.agentIds || []).map(id => agents.find((a) => a.id === id)?.name || "").join(" ");
    const matchesSearch =
      (lead.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (lead.phone || '').includes(searchQuery) ||
      (lead.origin || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (lead.destination || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      agentNames.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesAgent =
      filterAgent === 'all' ||
      (filterAgent === 'unassigned' && (!(lead.agentIds && lead.agentIds.length > 0) || !(lead.agentIds || []).some(id => agents.some(a => a.id === id)))) ||
      (lead.agentIds || []).includes(filterAgent);

    const leadStatus = LEGACY_STATUS_MAP[lead.status] || lead.status || 'New';
    const matchesStatus =
      filterStatus === 'all' ||
      leadStatus === filterStatus;

    const matchesProduct = 
      filterProduct === 'all' ||
      lead.product === filterProduct;

    return matchesSearch && matchesAgent && matchesStatus && matchesProduct;
  });

  // Sort logic
  const sortedLeads = [...filteredLeads].sort((a, b) => {
    switch (sortBy) {
      case 'oldest':
        return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      case 'name-asc':
        return (a.name || '').localeCompare(b.name || '');
      case 'name-desc':
        return (b.name || '').localeCompare(a.name || '');
      case 'age-asc':
        return Number(a.age) - Number(b.age);
      case 'age-desc':
        return Number(b.age) - Number(a.age);
      case 'newest':
      default:
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    }
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="sm:flex sm:items-center justify-between">
        <div className="sm:flex-auto">
          <h1 className="text-3xl font-semibold text-gray-900 tracking-tight">Leads Dashboard</h1>
          <p className="mt-2 text-sm text-gray-600">
            Monitor incoming client travel requests and assign them to your team of agents.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center space-x-2 bg-gray-200/60 p-1 rounded-xl">
          <button
            onClick={() => setViewMode('card')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${viewMode === 'card'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            Grid Card
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${viewMode === 'list'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
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
          <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider relative z-10">Total Leads</p>
          <p className="text-3xl font-extrabold bg-gradient-to-br from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 bg-clip-text text-transparent mt-1 relative z-10">{totalLeads}</p>
        </div>

        {/* Assigned Leads Card */}
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 rounded-xl border border-gray-100 dark:border-slate-700/50 p-6 relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-green-50 to-transparent dark:from-green-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider relative z-10">Assigned</p>
          <p className="text-3xl font-extrabold bg-gradient-to-br from-green-600 to-emerald-500 dark:from-green-400 dark:to-emerald-300 bg-clip-text text-transparent mt-1 relative z-10">
            {assignedLeads} <span className="text-xs text-gray-400 font-medium">({totalLeads > 0 ? Math.round((assignedLeads / totalLeads) * 100) : 0}%)</span>
          </p>
        </div>

        {/* Unassigned Leads Card */}
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 rounded-xl border border-gray-100 dark:border-slate-700/50 p-6 relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-50 to-transparent dark:from-orange-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider relative z-10">Unassigned</p>
          <p className="text-3xl font-extrabold bg-gradient-to-br from-orange-500 to-amber-500 dark:from-orange-400 dark:to-amber-300 bg-clip-text text-transparent mt-1 relative z-10">
            {unassignedLeads} <span className="text-xs text-gray-400 font-medium">({totalLeads > 0 ? Math.round((unassignedLeads / totalLeads) * 100) : 0}%)</span>
          </p>
        </div>
      </div>

      {/* Search and Filters Section */}
      <div className="mt-8 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md p-4 rounded-xl shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4 border border-gray-100 dark:border-slate-700/50 transition-all duration-300 hover:shadow-md">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search by name, phone, origin, destination, or agent..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 sm:text-sm bg-gray-50/50"
          />
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Agent:</span>
            <select
              value={filterAgent}
              onChange={(e) => setFilterAgent(e.target.value)}
              className="pl-3 pr-8 py-2 text-xs border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 rounded-xl bg-white cursor-pointer text-gray-700 font-medium"
            >
              <option value="all">All Agents</option>
              <option value="unassigned">Unassigned Only</option>
              {agents.map((agent) => {
                const count = getAgentLeadCount(agent.id);
                return (
                  <option key={agent.id} value={agent.id}>
                    {agent.name} ({count} {count === 1 ? 'lead' : 'leads'})
                  </option>
                );
              })}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="pl-3 pr-8 py-2 text-xs border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 rounded-xl bg-white cursor-pointer text-gray-700 font-medium"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="age-asc">Age (Youngest First)</option>
              <option value="age-desc">Age (Oldest First)</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Package:</span>
            <select
              value={filterProduct}
              onChange={(e) => setFilterProduct(e.target.value)}
              className="pl-3 pr-8 py-2 text-xs border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 rounded-xl bg-white cursor-pointer text-gray-700 font-medium"
            >
              <option value="all">All Packages</option>
              {[...new Set(leads.map(l => l.product).filter(Boolean))].map(prod => (
                <option key={prod} value={prod}>{prod}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Status:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="pl-3 pr-8 py-2 text-xs border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 rounded-xl bg-white cursor-pointer text-gray-700 font-medium"
            >
              <option value="all">All Statuses</option>
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.value}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="mt-8 flex flex-col items-center justify-center py-16 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-sm font-semibold text-gray-500 dark:text-slate-400">Loading leads data...</p>
        </div>
      ) : leads.length === 0 ? (
        <div className="mt-8 text-center py-16 bg-white rounded-xl shadow-sm border border-gray-100">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">No leads active</h3>
          <p className="mt-2 text-sm text-gray-500">Get started by creating a new client lead.</p>
        </div>
      ) : sortedLeads.length === 0 ? (
        <div className="mt-8 text-center py-16 bg-white rounded-xl shadow-sm border border-gray-100">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">No matching leads</h3>
          <p className="mt-2 text-sm text-gray-500">Try adjusting your search query or filters.</p>
        </div>
      ) : viewMode === 'card' ? (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 items-start">
          {sortedLeads.map((lead) => {
                        const currentAgentIds = lead.agentIds || [];



            const assignedAgents = currentAgentIds.map(id => agents.find(a => a.id === id)).filter(Boolean);
            const agentDisplayNames = assignedAgents.length > 0 ? assignedAgents.map(a => a.name).join(', ') : 'Unassigned';
            const isNotesExpanded = !!expandedNotes[lead.id];

            return (
              <div
                key={lead.id}
                className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 hover:scale-[1.01] transition-all duration-300 overflow-visible flex flex-col justify-between border border-gray-100 dark:border-slate-700/50 p-6 relative group"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-lg font-bold transition-colors relative z-20">
                          <Link to={`/leads/${lead.id}`} className="text-orange-600 hover:text-orange-800 underline decoration-orange-300/50 hover:decoration-orange-800 flex items-center gap-1.5 group">
                            <span>{lead.name || 'Unnamed Lead'}</span>
                            <svg className="w-4 h-4 text-orange-400 group-hover:text-orange-800 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </Link>
                        </h3>
                        {(isAdmin || (lead.agentIds || []).includes(user?.id)) && (
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
                        <span className="text-sm font-medium text-gray-500">
                          {lead.phone}
                        </span>
                        {lead.product && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border border-purple-100/30">
                            {lead.product}
                          </span>
                        )}
                      </div>

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
                          onChange={(newIds) => handleInlineAssign(lead.id, newIds)}
                          getAgentLeadCount={getAgentLeadCount}
                        />
                      </div>
                    ) : (
                      <div className="text-xs font-semibold text-gray-700 dark:text-slate-200 bg-gray-50/60 dark:bg-slate-900/50 px-3 py-2 rounded-lg border border-gray-100 dark:border-slate-800">
                        {agentDisplayNames}
                      </div>
                    )}
                  </div>

                  {/* Notes / Chat logs section */}
                  <div className="border-t border-gray-100 pt-3">
                    <button
                      onClick={() => toggleNotes(lead.id)}
                      className="text-xs text-orange-600 hover:text-orange-700 font-semibold flex items-center space-x-1 cursor-pointer"
                    >
                      <span>{isNotesExpanded ? 'Hide Chat Log' : `Chat Log (${lead.notes ? lead.notes.length : 0})`}</span>
                    </button>

                    {isNotesExpanded && (
                      <div className="mt-3 space-y-3">
                        <div className="max-h-36 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                          {(!lead.notes || lead.notes.length === 0) ? (
                            <p className="text-[11px] text-gray-400 dark:text-gray-500 italic">No notes posted yet.</p>
                          ) : (
                            lead.notes.map((note) => (
                              <NoteItem
                                key={note.id || note._id}
                                note={note}
                                leadId={lead.id}
                                deleteNote={deleteNote}
                                currentUser={user}
                              />
                            ))
                          )}
                        </div>
                        {selectedImages[lead.id] && (
                          <div className="relative inline-block mb-1.5 rounded overflow-hidden border border-gray-200 dark:border-slate-700">
                            {selectedImages[lead.id].startsWith('DOCUMENT:') ? (
                              <div className="p-3 bg-gray-100 dark:bg-slate-800 text-xs font-semibold flex items-center h-12 w-auto min-w-[150px]">
                                📄 {selectedImages[lead.id].replace('DOCUMENT:', '')}
                              </div>
                            ) : (
                              <img src={selectedImages[lead.id]} alt="Upload preview" className="h-12 w-auto object-cover" />
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedImages(prev => ({ ...prev, [lead.id]: '' }));
                                setImageFiles(prev => ({ ...prev, [lead.id]: null }));
                              }}
                              className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold hover:bg-red-600 transition-colors shadow-sm cursor-pointer"
                            >
                              &times;
                            </button>
                          </div>
                        )}
                        <div className="flex items-center space-x-2 mt-2">
                          <input
                            type="text"
                            placeholder="Add update..."
                            value={noteInputs[lead.id] || ''}
                            onChange={(e) => setNoteInputs({ ...noteInputs, [lead.id]: e.target.value })}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendNote(lead.id)}
                            className="flex-1 text-xs py-1.5 px-3 border border-gray-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500"
                          />
                          <label className="flex items-center justify-center p-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-300 rounded-lg cursor-pointer transition-colors border border-gray-200/50 dark:border-slate-700/50">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                            <input
                              type="file"
                              accept="image/*,.pdf,.doc,.docx"
                              onChange={(e) => handleImageChange(lead.id, e)}
                              className="hidden"
                            />
                          </label>
                          <button
                            onClick={() => handleSendNote(lead.id)}
                            className="bg-orange-600 hover:bg-orange-700 text-white text-xs px-3 py-1.5 rounded-lg font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            disabled={(!(noteInputs[lead.id] || '').trim() && !imageFiles[lead.id]) || isUploading[lead.id]}
                          >
                            {isUploading[lead.id] ? '...' : 'Send'}
                          </button>
                        </div>
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
          {sortedLeads.map((lead) => {
                        const currentAgentIds = lead.agentIds || [];



            const assignedAgents = currentAgentIds.map(id => agents.find(a => a.id === id)).filter(Boolean);
            const agentDisplayNames = assignedAgents.length > 0 ? assignedAgents.map(a => a.name).join(', ') : 'Unassigned';
            const isNotesExpanded = !!expandedNotes[lead.id];

            return (
              <div
                key={lead.id}
                className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-2xl shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 border border-gray-100 dark:border-slate-700/50 p-5 flex flex-col space-y-4"
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-center">
                  <div className="lg:col-span-4 flex items-center">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-base font-bold transition-colors">
                          <Link to={`/leads/${lead.id}`} className="text-orange-600 hover:text-orange-800 underline decoration-orange-300/50 hover:decoration-orange-800 flex items-center gap-1.5 group">
                            <span>{lead.name || 'Unnamed Lead'}</span>
                            <svg className="w-3.5 h-3.5 text-orange-400 group-hover:text-orange-800 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </Link>
                        </h3>
                        {(isAdmin || (lead.agentIds || []).includes(user?.id)) && (
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
                        <span className="text-sm font-medium text-gray-500">
                          {lead.phone}
                        </span>
                        {lead.product && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border border-purple-100/30">
                            {lead.product}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-3 flex items-center space-x-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl px-4 py-2 w-full">
                    <div className="text-center flex-1">
                      <span className="block text-[9px] uppercase tracking-wider text-gray-400 font-semibold">Origin</span>
                      <span className="text-xs font-medium text-gray-800">{lead.origin}</span>
                    </div>
                    <div className="px-2 text-orange-500 font-bold text-sm">➔</div>
                    <div className="text-center flex-1">
                      <span className="block text-[9px] uppercase tracking-wider text-gray-400 font-semibold">Destination</span>
                      <span className="text-xs font-medium text-gray-800">{lead.destination}</span>
                    </div>
                  </div>

                  {/* Status + Compact Booking in list view */}
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
                          onChange={(newIds) => handleInlineAssign(lead.id, newIds)}
                          getAgentLeadCount={getAgentLeadCount}
                        />
                      </div>
                    ) : (
                      <div className="text-xs font-semibold text-gray-700 dark:text-slate-200 bg-gray-50/60 dark:bg-slate-900/50 px-3 py-1.5 rounded-lg border border-gray-100 dark:border-slate-800 min-w-[120px] text-center">
                        {agentDisplayNames}
                      </div>
                    )}
                    
                    <button
                      onClick={() => toggleNotes(lead.id)}
                      className="text-xs text-orange-600 hover:text-orange-700 font-semibold px-2 py-1 bg-orange-50 rounded-lg cursor-pointer"
                    >
                      {isNotesExpanded ? 'Hide Chat' : `Chat (${lead.notes ? lead.notes.length : 0})`}
                    </button>
                  </div>
                </div>

                {isNotesExpanded && (
                  <div className="border-t border-gray-100 pt-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="max-h-36 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                        {(!lead.notes || lead.notes.length === 0) ? (
                          <p className="text-[11px] text-gray-400 dark:text-gray-500 italic">No notes posted yet.</p>
                        ) : (
                          lead.notes.map((note) => (
                            <NoteItem
                              key={note.id || note._id}
                              note={note}
                              leadId={lead.id}
                              deleteNote={deleteNote}
                              currentUser={user}
                            />
                          ))
                        )}
                      </div>
                      <div className="flex-1 flex flex-col">
                        {selectedImages[lead.id] && (
                          <div className="relative inline-block mb-1.5 rounded overflow-hidden border border-gray-200 dark:border-slate-700">
                            {selectedImages[lead.id].startsWith('DOCUMENT:') ? (
                              <div className="p-3 bg-gray-100 dark:bg-slate-800 text-xs font-semibold flex items-center h-12 w-auto min-w-[150px]">
                                📄 {selectedImages[lead.id].replace('DOCUMENT:', '')}
                              </div>
                            ) : (
                              <img src={selectedImages[lead.id]} alt="Upload preview" className="h-12 w-auto object-cover" />
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedImages(prev => ({ ...prev, [lead.id]: '' }));
                                setImageFiles(prev => ({ ...prev, [lead.id]: null }));
                              }}
                              className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold hover:bg-red-600 transition-colors shadow-sm cursor-pointer"
                            >
                              &times;
                            </button>
                          </div>
                        )}
                        <div className="flex items-start space-x-2">
                          <textarea
                            placeholder="Type important information..."
                            value={noteInputs[lead.id] || ''}
                            onChange={(e) => setNoteInputs({ ...noteInputs, [lead.id]: e.target.value })}
                            className="w-full text-xs p-2 border border-gray-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 resize-none h-16 bg-white"
                          />
                          <div className="flex flex-col space-y-1.5">
                            <label className="flex items-center justify-center p-2 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-300 rounded-lg cursor-pointer transition-colors border border-gray-200/50 dark:border-slate-700/50 h-8">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                              </svg>
                              <input
                                type="file"
                                accept="image/*,.pdf,.doc,.docx"
                                onChange={(e) => handleImageChange(lead.id, e)}
                                className="hidden"
                              />
                            </label>
                            <button
                              onClick={() => handleSendNote(lead.id)}
                              disabled={(!(noteInputs[lead.id] || '').trim() && !imageFiles[lead.id]) || isUploading[lead.id]}
                              className="bg-orange-600 hover:bg-orange-700 text-white text-xs px-3 py-1.5 rounded-lg font-semibold h-8 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              {isUploading[lead.id] ? '...' : 'Send'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )
      }

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
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Full Name</label>
                  <input
                    type="text"
                    value={modalData.name}
                    onChange={(e) => setModalData({ ...modalData, name: e.target.value })}
                    className="w-full text-sm py-2 px-3 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-700 bg-white dark:bg-slate-900 dark:text-gray-100"
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Age</label>
                  <input
                    type="number"
                    value={modalData.age}
                    onChange={(e) => setModalData({ ...modalData, age: e.target.value })}
                    className="w-full text-sm py-2 px-3 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-700 bg-white dark:bg-slate-900 dark:text-gray-100"
                  />
                </div>
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
                    <option value="Meghalaya Package">Meghalaya Package</option>
                    <option value="Hampta Pass Trek">Hampta Pass Trek</option>
                    <option value="Rishikesh Activities">Rishikesh Activities</option>
                    <option value="Spiti Package">Spiti Package</option>
                    <option value="Ladakh Package">Ladakh Package</option>
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