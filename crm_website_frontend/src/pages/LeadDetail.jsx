import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import NoteItem from '../components/NoteItem';
import AgentMultiSelect from '../components/AgentMultiSelect';

const STATUS_OPTIONS = [
  { value: 'Fresh Leads', color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800' },
  { value: 'Interested Leads', color: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-800' },
  { value: 'Pre Prospect Leads', color: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800' },
  { value: 'Prospect Leads', color: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-800' },
  { value: 'Booked', color: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/60 dark:text-green-300 dark:border-green-700' },
  { value: 'Rejected Leads', color: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/60 dark:text-red-300 dark:border-red-700' },
];

export default function LeadDetail({ API_URL, token, user, setLeads, leads, agents, updateLeadStatus, updateLeadBooking, assignAgent }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [noteInput, setNoteInput] = useState('');

  const [selectedImage, setSelectedImage] = useState(null); // base64 preview
  const [imageFile, setImageFile] = useState(null); // actual file to upload
  const [isUploading, setIsUploading] = useState(false);

  const getAgentLeadCount = (agentId) => {
    return leads?.filter((l) => (l.agentIds || []).includes(agentId)).length || 0;
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    setImageFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      setSelectedImage(`DOCUMENT:${file.name}`);
    }
  };

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  });

  const fetchLead = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/leads/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLead(data);
      } else {
        toast.error('Lead not found');
        navigate('/');
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to load lead details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);


  const handleSendNote = async () => {
    if (!noteInput.trim() && !imageFile) return;

    setIsUploading(true);
    try {
      let finalImageUrl = null;

      // Upload image first if it exists
      if (imageFile) {
        const formData = new FormData();
        formData.append('file', imageFile);

        const uploadRes = await fetch(`${API_URL}/upload`, {
          method: 'POST',
          body: formData
        });

        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          finalImageUrl = uploadData.fileUrl;
        } else {
          toast.error('Failed to upload image to Cloudinary');
          setIsUploading(false);
          return;
        }
      }

      // Send note with image URL
      const res = await fetch(`${API_URL}/leads/${id}/notes`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          text: noteInput.trim(),
          imageUrl: finalImageUrl
        })
      });
      if (res.ok) {
        const updated = await res.json();
        setLead(updated);
        syncLeadToParent(updated);
        setNoteInput('');
        setSelectedImage(null);
        setImageFile(null);
        toast.success('Note added');
      } else {
        toast.error('Failed to add note');
      }
    } catch (error) {
      console.error(error);
      toast.error('Server connection error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteNote = async (leadId, noteId) => {
    // NoteItem passes deleteNote(leadId, note.id || note._id)
    // Fall back to leadId if only one argument is provided
    const actualNoteId = noteId || leadId;
    try {
      const res = await fetch(`${API_URL}/leads/${id}/notes/${actualNoteId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const updated = await res.json();
        setLead(updated);
        syncLeadToParent(updated);
        toast.success('Note deleted');
      } else {
        toast.error('Failed to delete note');
      }
    } catch (error) {
      console.error(error);
      toast.error('Server connection error');
    }
  };

  // Keep the parent leads array in sync
  const syncLeadToParent = (updatedLead) => {
    if (setLeads) {
      setLeads(prev => prev.map(l => l.id === updatedLead.id ? updatedLead : l));
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toISOString().split('T')[0]; // yyyy-mm-dd for input[type=date]
  };

  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return 'Not set';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  };

  const getStatusDef = (status) => {
    return STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];
  };

  const handleStatusChange = async (newStatus) => {
    if (!lead || lead.status === newStatus) return;
    const previousLead = { ...lead };
    setLead({ ...lead, status: newStatus });
    const updated = await updateLeadStatus(lead.id, newStatus);
    if (updated) {
      setLead(updated);
      syncLeadToParent(updated);
    } else {
      setLead(previousLead);
    }
  };



  const handleAssignAgent = async (newIds) => {
    if (!lead || !assignAgent) return;
    const previousLead = { ...lead };
    setLead({ ...lead, agentIds: newIds }); // Optimistic update
    syncLeadToParent({ ...lead, agentIds: newIds });

    const updated = await assignAgent(lead.id, newIds);
    if (updated) {
      setLead(updated);
      syncLeadToParent(updated);
    } else {
      setLead(previousLead);
      syncLeadToParent(previousLead);
    }
  };

  const computeAge = () => {
    if (!lead?.createdAt) return '—';
    const created = new Date(lead.createdAt);
    const now = new Date();
    const diffMs = now - created;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return `${diffDays}d`;
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 flex flex-col items-center">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-sm font-semibold text-gray-500">Loading lead details...</p>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-bold text-gray-900">Lead not found</h2>
        <Link to="/" className="text-orange-600 hover:text-orange-700 text-sm font-semibold mt-2 inline-block">← Back to Dashboard</Link>
      </div>
    );
  }

  const assignedAgents = (lead.agentIds || []).map(id => agents?.find(a => a.id === id)).filter(Boolean);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center text-sm text-gray-500 hover:text-orange-600 font-medium mb-6 transition-colors cursor-pointer"
      >
        <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {/* Header */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1 min-w-[250px]">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{lead.name || 'Unnamed Lead'}</h1>



          </div>
          <div className="flex-1 flex justify-center">
            <div className="bg-gray-50 rounded-xl p-4 flex items-center space-x-6 w-full max-w-[320px] sm:max-w-[360px]">
              <div className="text-center flex-1">
                <span className="block text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Origin</span>
                <span className="text-sm font-medium text-gray-800">{lead.origin || '—'}</span>
              </div>
              <div className="text-orange-500 font-bold">➔</div>
              <div className="text-center flex-1">
                <span className="block text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Destination</span>
                <span className="text-sm font-medium text-gray-800">{lead.destination || '—'}</span>
              </div>
            </div>
          </div>
          <div className="flex-1 flex flex-col sm:items-end justify-center gap-1.5 mt-4 sm:mt-0">
            <span className="flex items-center text-sm font-semibold text-gray-600 dark:text-gray-300">
              <svg className="w-4 h-4 mr-1.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
              {lead.phone}
            </span>
            {lead.mailId && (
              <span className="flex items-center text-sm font-semibold text-gray-600 dark:text-gray-300">
                <svg className="w-4 h-4 mr-1.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                {lead.mailId}
              </span>
            )}
            {lead.age && <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">Age: {lead.age}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-3 mt-5">
          {lead.leadSource && (
            <span className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-semibold bg-blue-50 text-blue-700 border border-blue-100/50">
              Source: {lead.leadSource}
            </span>
          )}
          {lead.product && (
            <span className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-100/50">
              Product: {lead.product}
            </span>
          )}
          {/* We will move the agent assignment down to the status block or just render it here. */}
          {/* Let's render the interactive agent select here if user is admin, otherwise show badge */}
          {user?.isAdmin ? (
            <div className="w-[200px] flex items-center">
              <AgentMultiSelect
                agents={agents}
                selectedAgentIds={lead.agentIds || []}
                onChange={handleAssignAgent}
                getAgentLeadCount={getAgentLeadCount}
              />
            </div>
          ) : (
            assignedAgents.length > 0 ? (
              <span className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-bold bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400 border border-orange-100/50 shadow-sm">
                👤 Assigned to: {assignedAgents.map(a => a.name).join(', ')}
              </span>
            ) : (
              <span className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-semibold bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400 border border-transparent">
                👤 Unassigned
              </span>
            )
          )}
        </div>
      </div>

      {/* Booking Status & Info Block */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-start gap-6">
          {/* Status Block */}
          <div className="flex flex-col items-start gap-3 min-w-[200px]">
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider flex items-center">
              <svg className="w-4 h-4 mr-2 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Lead Status
            </h2>
            <select
              value={lead.status || 'Fresh Leads'}
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={!(user?.isAdmin || (lead.agentIds || []).includes(user?.id))}
              className={`text-sm font-semibold py-2 px-4 rounded-lg border-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500 transition-colors ${getStatusDef(lead.status || 'Fresh Leads').color}`}
            >
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.value}</option>
              ))}
            </select>
          </div>

          {/* Booking Info Block */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider flex items-center">
                <svg className="w-4 h-4 mr-2 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                Booking Info
              </h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3 border border-gray-100 dark:border-slate-600">
                <span className="block text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold">Total Dial</span>
                <span className="text-lg font-bold text-gray-800 dark:text-gray-100">{lead.booking?.totalDial || 0}</span>
              </div>
              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3 border border-gray-100 dark:border-slate-600">
                <span className="block text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold">Connected</span>
                <span className="text-lg font-bold text-gray-800 dark:text-gray-100">{lead.booking?.connected || 0}</span>
              </div>
              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3 border border-gray-100 dark:border-slate-600">
                <span className="block text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold">Talk Time</span>
                <span className="text-lg font-bold text-gray-800 dark:text-gray-100">{lead.booking?.talkTime || '0:0'}</span>
              </div>
              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3 border border-gray-100 dark:border-slate-600">
                <span className="block text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold">Age</span>
                <span className="text-lg font-bold text-gray-800 dark:text-gray-100">{computeAge()}</span>
              </div>
              <div className="bg-amber-50/60 dark:bg-amber-900/30 rounded-lg p-3 border border-amber-100 dark:border-amber-700/50 col-span-2 sm:col-span-2">
                <span className="block text-[10px] uppercase tracking-wider text-amber-500 dark:text-amber-400 font-semibold">First Call</span>
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{lead.booking?.firstCall ? formatDisplayDate(lead.booking.firstCall) : '-------------------'}</span>
              </div>
              <div className="bg-amber-50/60 dark:bg-amber-900/30 rounded-lg p-3 border border-amber-100 dark:border-amber-700/50 col-span-2 sm:col-span-2">
                <span className="block text-[10px] uppercase tracking-wider text-amber-500 dark:text-amber-400 font-semibold">Last Call</span>
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{lead.booking?.lastCall ? formatDisplayDate(lead.booking.lastCall) : '-------------------'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Two-section layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left section: Dates */}
        <div className="lg:col-span-2 space-y-6">

          {/* Dates */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center mb-4">
              <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              Dates
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Start Date</label>
                <div className="text-sm font-medium text-gray-800 bg-gray-50 p-2 rounded-lg border border-gray-200">
                  {formatDisplayDate(lead.dates?.startDate)}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Due Date</label>
                <div className="text-sm font-medium text-gray-800 bg-gray-50 p-2 rounded-lg border border-gray-200">
                  {formatDisplayDate(lead.dates?.dueDate)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right section: Comments & Activity */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center mb-4">
              <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              Comments & Activity
            </h2>

            {/* Note input */}
            <div className="flex items-start space-x-3 mb-6">
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-orange-600">{user?.name?.charAt(0)?.toUpperCase() || 'U'}</span>
              </div>
              <div className="flex-1">
                {selectedImage && (
                  <div className="relative inline-block mb-3 rounded-lg overflow-hidden border border-gray-200 dark:border-slate-700">
                    {selectedImage.startsWith('DOCUMENT:') ? (
                      <div className="p-4 bg-gray-100 dark:bg-slate-800 text-sm font-semibold flex items-center h-20 w-auto min-w-[200px]">
                        📄 {selectedImage.replace('DOCUMENT:', '')}
                      </div>
                    ) : (
                      <img src={selectedImage} alt="Upload preview" className="h-20 w-auto object-cover" />
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedImage(null);
                        setImageFile(null);
                      }}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold hover:bg-red-600 transition-colors shadow-sm cursor-pointer"
                    >
                      &times;
                    </button>
                  </div>
                )}
                <textarea
                  placeholder="Write a comment..."
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendNote();
                    }
                  }}
                  className="w-full text-sm p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none h-20 bg-gray-50/50"
                />
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center space-x-2">
                    <label className="flex items-center space-x-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-300 rounded-lg text-xs font-semibold cursor-pointer transition-colors border border-gray-200/50 dark:border-slate-700/50">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      <span>File</span>
                      <input
                        type="file"
                        accept="image/*,.pdf,.doc,.docx"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <button
                    onClick={handleSendNote}
                    disabled={(!noteInput.trim() && !imageFile) || isUploading}
                    className="bg-orange-600 hover:bg-orange-700 text-white text-xs px-4 py-2 rounded-lg font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {isUploading ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </div>
            </div>

            {/* Notes list */}
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {(!lead.notes || lead.notes.length === 0) ? (
                <div className="text-center py-8">
                  <svg className="mx-auto h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                  <p className="text-sm text-gray-400 mt-2">No comments yet. Start the conversation!</p>
                </div>
              ) : (
                [...lead.notes].reverse().map((note) => (
                  <NoteItem
                    key={note.id || note._id}
                    note={note}
                    leadId={lead.id}
                    deleteNote={handleDeleteNote}
                    currentUser={user}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
