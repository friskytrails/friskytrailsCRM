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

export default function LeadDetail({ API_URL, token, user, setLeads, leads, agents, products = [], statuses = [], updateLeadStatus, updateLeadBooking, assignAgent, bookLeadAPI }) {
  const defaultProducts = ["Meghalaya Package", "Hampta Pass Trek", "Rishikesh Activities", "Spiti Package", "Ladakh Package", "Kerala Trip"];
  const availableProducts = Array.from(new Set([...(products || []), ...defaultProducts]));
  const availableStatuses = Array.from(new Set([...(statuses || []), ...STATUS_OPTIONS.map(s => s.value)]));
  const { id } = useParams();
  const navigate = useNavigate();
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [noteInput, setNoteInput] = useState('');

  const [selectedImage, setSelectedImage] = useState(null); // base64 preview
  const [imageFile, setImageFile] = useState(null); // actual file to upload
  const [isUploading, setIsUploading] = useState(false);

  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    fullName: '',
    emailId: '',
    contactNumber: '',
    emergencyContactNumber: '',
    packageName: '',
    totalAmount: '',
    paidAmount: '',
    dueAmount: '',
    startDate: '',
    endDate: '',
    noOfPax: ''
  });
  const [isBooking, setIsBooking] = useState(false);

  const [isEditingProduct, setIsEditingProduct] = useState(false);
  const [productInput, setProductInput] = useState('');
  const [isTripSectionOpen, setIsTripSectionOpen] = useState(true);

  const [isEditingDates, setIsEditingDates] = useState(false);
  const [dateForm, setDateForm] = useState({ startDate: '', dueDate: '' });
  const [isSavingDates, setIsSavingDates] = useState(false);

  const handleStartEditingDates = () => {
    const rawStartDate = lead?.dates?.startDate || null;
    const rawDueDate = lead?.dates?.dueDate || lead?.dates?.endDate || null;

    setDateForm({
      startDate: formatDate(rawStartDate),
      dueDate: formatDate(rawDueDate)
    });
    setIsEditingDates(true);
  };

  const handleSaveDates = async () => {
    try {
      setIsSavingDates(true);
      const res = await fetch(`${API_URL}/leads/${lead.id || lead._id}/dates`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          startDate: dateForm.startDate || null,
          dueDate: dateForm.dueDate || null
        })
      });
      if (res.ok) {
        const updatedLead = await res.json();
        setLead(updatedLead);
        syncLeadToParent(updatedLead);
        setIsEditingDates(false);
        toast.success('Dates updated successfully!');
      } else {
        const errData = await res.json();
        toast.error(errData.error || 'Failed to update dates');
      }
    } catch (err) {
      console.error(err);
      toast.error('Server error updating dates');
    } finally {
      setIsSavingDates(false);
    }
  };

  const handleProductSave = async () => {
    if (!productInput.trim()) return;
    try {
      const res = await fetch(`${API_URL}/leads/${lead.id || lead._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ product: productInput.trim() })
      });
      if (res.ok) {
        const updated = await res.json();
        setLead(updated);
        syncLeadToParent(updated);
        setIsEditingProduct(false);
        toast.success("Product package updated successfully!");
      } else {
        toast.error("Failed to update product package");
      }
    } catch {
      toast.error("Error updating product package");
    }
  };

  const getAgentLeadCount = (agentId) => {
    return leads?.filter((l) => (l.agentIds || []).includes(agentId)).length || 0;
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
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
          headers: {
            'Authorization': `Bearer ${token}`
          },
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
    let d;
    if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [year, month, day] = dateStr.split('-');
      d = new Date(year, month - 1, day);
    } else {
      d = new Date(dateStr);
    }
    return d.toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  };

  const getStatusDef = (status) => {
    return STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];
  };

  const handleStatusChange = async (newStatus) => {
    if (!lead || lead.status === newStatus) return;

    if (newStatus === 'Booked') {
      setShowBookingModal(true);
      return;
    }

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

  const submitBooking = async (e) => {
    e.preventDefault();
    if (!bookLeadAPI) return;
    setIsBooking(true);
    const updated = await bookLeadAPI(lead.id, {
      ...bookingForm,
      totalAmount: Number(bookingForm.totalAmount) || 0,
      paidAmount: Number(bookingForm.paidAmount) || 0,
      dueAmount: Number(bookingForm.dueAmount) || 0,
      noOfPax: Number(bookingForm.noOfPax) || 0,
    });
    setIsBooking(false);
    if (updated) {
      setLead(updated);
      syncLeadToParent(updated);
      setShowBookingModal(false);
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

  // Retrieve active filtered lead sequence from sessionStorage (synced from Dashboard / AgentLeads)
  const getNavLeads = () => {
    try {
      const stored = sessionStorage.getItem('activeLeadIds');
      if (stored) {
        const activeIds = JSON.parse(stored);
        if (Array.isArray(activeIds) && activeIds.length > 0) {
          const leadMap = new Map((leads || []).map(l => [String(l.id || l._id), l]));
          const filteredNav = activeIds.map(idStr => leadMap.get(String(idStr))).filter(Boolean);
          if (filteredNav.length > 0 && filteredNav.some(l => String(l.id || l._id) === String(lead?.id || lead?._id || id))) {
            return filteredNav;
          }
        }
      }
    } catch (e) {
      console.error("Failed to parse activeLeadIds:", e);
    }
    return leads || [];
  };

  const navLeads = getNavLeads();
  const currentLeadIndex = navLeads.findIndex(l => String(l.id || l._id) === String(lead?.id || lead?._id || id));
  const prevLead = currentLeadIndex > 0 ? navLeads[currentLeadIndex - 1] : null;
  const nextLead = currentLeadIndex >= 0 && currentLeadIndex < navLeads.length - 1 ? navLeads[currentLeadIndex + 1] : null;
  const assignedAgents = (lead.agentIds || []).map(id => agents?.find(a => a.id === id)).filter(Boolean);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center text-sm text-gray-500 hover:text-orange-600 dark:text-slate-400 dark:hover:text-orange-400 font-medium transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => prevLead && navigate(`/leads/${prevLead.id || prevLead._id}`)}
            disabled={!prevLead}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer"
            title={prevLead ? `Previous Lead: ${prevLead.name || ''}` : 'First lead'}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Previous Lead
          </button>
          <button
            onClick={() => nextLead && navigate(`/leads/${nextLead.id || nextLead._id}`)}
            disabled={!nextLead}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer"
            title={nextLead ? `Next Lead: ${nextLead.name || ''}` : 'Last lead'}
          >
            Next Lead
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

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
          </div>
        </div>
        <div className="flex flex-wrap gap-3 mt-5">
          {lead.leadSource && (
            <span className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-semibold bg-blue-50 text-blue-700 border border-blue-100/50">
              Source: {lead.leadSource}
            </span>
          )}
          {/* Editable Product Package Badge for Admin */}
          {isEditingProduct ? (
            <div className="inline-flex items-center gap-1.5 bg-purple-50 dark:bg-purple-950/60 p-1.5 px-2 rounded-md border border-purple-200">
              <select
                value={productInput}
                onChange={(e) => setProductInput(e.target.value)}
                className="text-xs font-semibold text-purple-900 dark:text-purple-100 bg-white dark:bg-slate-900 border border-purple-300 rounded px-2 py-1 outline-none cursor-pointer"
                autoFocus
              >
                <option value="">Select a Product Package...</option>
                {availableProducts.map((p, idx) => (
                  <option key={idx} value={p}>{p}</option>
                ))}
              </select>
              <button
                onClick={handleProductSave}
                className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded transition-colors cursor-pointer"
              >
                Save
              </button>
              <button
                onClick={() => setIsEditingProduct(false)}
                className="px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs rounded transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-100/50">
              Product: {lead.product || 'Not Specified'}
              {user?.isAdmin && (
                <button
                  onClick={() => {
                    setProductInput(lead.product || '');
                    setIsEditingProduct(true);
                  }}
                  className="text-purple-500 hover:text-purple-700 dark:hover:text-purple-200 ml-1 cursor-pointer p-0.5 rounded transition-colors"
                  title="Edit Product Package"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                </button>
              )}
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
      <div className="flex flex-col xl:flex-row gap-6 mb-6">

        {/* Left Side: Status & Call Metrics */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 w-full">
          <div className="flex flex-col md:flex-row md:items-start gap-6 h-full">
            {/* Status Block */}
            <div className="flex flex-col items-start gap-3 min-w-[200px]">
              <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider flex items-center">
                <svg className="w-4 h-4 mr-2 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Lead Status
              </h2>
              <select
                value={lead.status || 'Fresh Leads'}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={!(user?.isAdmin || (lead.agentIds || []).includes(user?.id)) || (lead.status === 'Booked' && !user?.isAdmin)}
                className={`text-sm font-semibold py-2 px-4 rounded-lg border-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500 transition-colors ${getStatusDef(lead.status || 'Fresh Leads').color} ${(lead.status === 'Booked' && !user?.isAdmin) ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {availableStatuses.map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>

            {/* Call Metrics Block */}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider flex items-center">
                  <svg className="w-4 h-4 mr-2 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                  Call Metrics
                </h2>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3 border border-gray-100 dark:border-slate-600">
                  <span className="block text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold">Total Dial</span>
                  <span className="text-lg font-bold text-gray-800 dark:text-gray-100">{lead.booking?.totalDial || 0}</span>
                </div>
                <div className="bg-blue-50/60 dark:bg-blue-900/30 rounded-lg p-3 border border-blue-100 dark:border-blue-700/50">
                  <span className="block text-[10px] uppercase tracking-wider text-blue-500 dark:text-blue-400 font-semibold">Daily Dial</span>
                  <span className="text-lg font-bold text-gray-800 dark:text-gray-100">{lead.booking?.dailyDial || 0}</span>
                </div>
                <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3 border border-gray-100 dark:border-slate-600">
                  <span className="block text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold">Connected</span>
                  <span className="text-lg font-bold text-gray-800 dark:text-gray-100">{lead.booking?.connected || 0}</span>
                </div>
                <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3 border border-gray-100 dark:border-slate-600">
                  <span className="block text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold">Talk Time</span>
                  <span className="text-lg font-bold text-gray-800 dark:text-gray-100">{lead.booking?.talkTime || '0:0'}</span>
                </div>
                <div className="bg-blue-50/60 dark:bg-blue-900/30 rounded-lg p-3 border border-blue-100 dark:border-blue-700/50">
                  <span className="block text-[10px] uppercase tracking-wider text-blue-500 dark:text-blue-400 font-semibold">Daily Talk Time</span>
                  <span className="text-lg font-bold text-gray-800 dark:text-gray-100">{lead.booking?.dailyTalkTime || '0:0'}</span>
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

      </div>

      {/* Trip Information & Multi-Trip List - Collapsible */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 mb-6 overflow-hidden">
        {/* Simple Collapsible Header Bar */}
        <div 
          className="p-4 px-5 flex items-center justify-between gap-3 bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 cursor-pointer select-none"
          onClick={() => setIsTripSectionOpen(!isTripSectionOpen)}
        >
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
              Trip Information
            </h2>
            <span className="px-2 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 text-xs font-bold rounded-full">
              {((lead.trips && lead.trips.length > 0) ? lead.trips.length : ((lead.bookingDetails && (lead.status === 'Booked' || lead.bookingDetails.packageName)) ? 1 : 0))} Recorded
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsTripSectionOpen(!isTripSectionOpen)}
            className="w-8 h-8 rounded-lg bg-white dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
            title={isTripSectionOpen ? "Collapse section" : "Expand section"}
          >
            <svg 
              className={`w-4 h-4 transform transition-transform duration-200 ${isTripSectionOpen ? 'rotate-180' : 'rotate-0'}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor" 
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Content: Simple Trip List */}
        {isTripSectionOpen && (
          <div className="p-4">
            {(!lead.trips || lead.trips.length === 0) && (!lead.bookingDetails || (lead.status !== 'Booked' && !lead.bookingDetails.packageName)) ? (
              <div className="p-6 text-center text-gray-500 dark:text-slate-400 text-xs font-medium">
                No trips recorded for this lead yet.
              </div>
            ) : (
              <div className="space-y-3">
                {(lead.trips && lead.trips.length > 0 ? lead.trips : [lead.bookingDetails]).map((trip, idx) => {
                  if (!trip) return null;
                  const originalIndex = lead.trips && lead.trips.length > 0 ? idx : 0;
                  return (
                    <div 
                      key={trip._id || trip.tripId || idx} 
                      className="p-4 bg-gray-50 dark:bg-slate-900/70 rounded-xl border border-gray-200 dark:border-slate-700/80 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                    >
                      {/* Left Side: Package & Travel Info */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-gray-900 dark:text-white text-sm">
                            {trip.packageName || 'Trip Package'}
                          </span>
                          <span className="text-[11px] text-gray-500 dark:text-slate-400 font-semibold">
                            • {trip.noOfPax || 1} Pax
                          </span>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-gray-600 dark:text-slate-300 font-medium">
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5 text-gray-400 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {trip.startDate ? new Date(trip.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'} - {trip.endDate ? new Date(trip.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                          </span>
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5 text-gray-400 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            {trip.fullName || lead.name} ({trip.contactNumber || lead.phone})
                          </span>
                          {trip.emergencyContactNumber && (
                            <span className="flex items-center gap-1 text-rose-500 font-semibold">
                              <svg className="w-3.5 h-3.5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              Emergency: {trip.emergencyContactNumber}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right Side: Financials & Edit Button */}
                      <div className="flex items-center gap-4 self-start md:self-auto">
                        <div className="text-right">
                          <div className="text-[10px] text-gray-400 dark:text-slate-400 font-bold uppercase tracking-wider">Total / Due Balance</div>
                          <div className="font-bold text-gray-900 dark:text-slate-100 text-xs">
                            ₹{Number(trip.totalAmount || 0).toLocaleString('en-IN')}
                            <span className="text-gray-400 font-normal mx-1">|</span>
                            <span className={Number(trip.dueAmount || 0) > 0 ? 'text-rose-600 dark:text-rose-400 font-extrabold' : 'text-emerald-600 dark:text-emerald-400 font-bold'}>
                              Due: ₹{Number(trip.dueAmount || 0).toLocaleString('en-IN')}
                            </span>
                          </div>
                        </div>

                        {(user?.isAdmin || (lead.agentIds || []).includes(user?.id)) && (
                          <button
                            onClick={() => {
                              setBookingForm({
                                fullName: trip.fullName || lead.name || '',
                                emailId: trip.emailId || lead.mailId || '',
                                contactNumber: trip.contactNumber || lead.phone || '',
                                emergencyContactNumber: trip.emergencyContactNumber || '',
                                packageName: trip.packageName || lead.product || '',
                                totalAmount: trip.totalAmount || '',
                                paidAmount: trip.paidAmount || '',
                                dueAmount: trip.dueAmount || '',
                                startDate: trip.startDate ? new Date(trip.startDate).toISOString().substring(0, 10) : '',
                                endDate: trip.endDate ? new Date(trip.endDate).toISOString().substring(0, 10) : '',
                                noOfPax: trip.noOfPax || '1',
                                tripIndex: originalIndex,
                                tripId: trip.tripId || undefined
                              });
                              setShowBookingModal(true);
                            }}
                            className="p-2 bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-600 dark:text-slate-300 transition-colors cursor-pointer flex items-center gap-1 font-bold text-xs"
                            title="Edit Trip Details"
                          >
                            <svg className="w-3.5 h-3.5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            Edit
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Historical Call Logs */}
      {lead.callLogs && lead.callLogs.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 mb-6">
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider flex items-center mb-4">
            <svg className="w-4 h-4 mr-2 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Historical Call Logs
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-slate-700/50 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3 rounded-l-lg">Date</th>
                  <th className="px-4 py-3">Dials</th>
                  <th className="px-4 py-3 rounded-r-lg">Talk Time</th>
                </tr>
              </thead>
              <tbody>
                {[...lead.callLogs].reverse().map((log, idx) => (
                  <tr key={idx} className="border-b last:border-0 border-gray-100 dark:border-slate-700">
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{formatDisplayDate(log.date)}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{log.dailyDial}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{log.dailyTalkTime}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Two-section layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left section: Dates */}
        <div className="lg:col-span-2 space-y-6">

          {/* Dates */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider flex items-center">
                <svg className="w-4 h-4 mr-2 text-gray-400 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                Dates
              </h2>
              {(user?.isAdmin || (lead.agentIds || []).includes(user?.id)) && (
                !isEditingDates ? (
                  <button
                    onClick={handleStartEditingDates}
                    className="p-1 text-gray-400 hover:text-orange-500 transition-colors cursor-pointer"
                    title="Edit Dates"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSaveDates}
                      disabled={isSavingDates}
                      className="px-2.5 py-1 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded transition-colors cursor-pointer"
                    >
                      {isSavingDates ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => setIsEditingDates(false)}
                      className="px-2.5 py-1 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300 font-bold text-xs rounded hover:bg-gray-300 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                )
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 dark:text-slate-400 uppercase tracking-wider mb-1.5">Start Date</label>
                {isEditingDates ? (
                  <input
                    type="date"
                    value={dateForm.startDate}
                    onChange={(e) => setDateForm({ ...dateForm, startDate: e.target.value })}
                    className="w-full text-sm bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg p-2 text-gray-800 dark:text-slate-200 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                ) : (
                  <div className="text-sm font-medium text-gray-800 dark:text-slate-200 bg-gray-50 dark:bg-slate-900/60 p-2.5 rounded-lg border border-gray-200 dark:border-slate-700">
                    {formatDisplayDate(lead.dates?.startDate)}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 dark:text-slate-400 uppercase tracking-wider mb-1.5">Due Date / End Date</label>
                {isEditingDates ? (
                  <input
                    type="date"
                    value={dateForm.dueDate}
                    onChange={(e) => setDateForm({ ...dateForm, dueDate: e.target.value })}
                    className="w-full text-sm bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg p-2 text-gray-800 dark:text-slate-200 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                ) : (
                  <div className="text-sm font-medium text-gray-800 dark:text-slate-200 bg-gray-50 dark:bg-slate-900/60 p-2.5 rounded-lg border border-gray-200 dark:border-slate-700">
                    {formatDisplayDate(lead.dates?.dueDate || lead.dates?.endDate)}
                  </div>
                )}
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
                  placeholder="Write a comment... (Enter for new line, Ctrl + Enter or click Send to submit)"
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      handleSendNote();
                    }
                  }}
                  className="w-full text-sm p-3 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-gray-50/50 dark:bg-slate-900/50 text-gray-900 dark:text-gray-100 min-h-[80px]"
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

      {/* Booking Form Modal */}
      {showBookingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-900/50">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Booking Details</h3>
              <button onClick={() => setShowBookingModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={submitBooking} className="p-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Full Name</label>
                  <input type="text" required value={bookingForm.fullName} onChange={e => setBookingForm({ ...bookingForm, fullName: e.target.value })} className="w-full text-sm bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Email ID</label>
                  <input type="email" required value={bookingForm.emailId} onChange={e => setBookingForm({ ...bookingForm, emailId: e.target.value })} className="w-full text-sm bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Contact Number</label>
                  <input type="text" required value={bookingForm.contactNumber} onChange={e => setBookingForm({ ...bookingForm, contactNumber: e.target.value })} className="w-full text-sm bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Emergency Contact Number</label>
                  <input type="text" required value={bookingForm.emergencyContactNumber} onChange={e => setBookingForm({ ...bookingForm, emergencyContactNumber: e.target.value })} className="w-full text-sm bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none" />
                </div>
              </div>

              <hr className="border-gray-200 dark:border-slate-700 mb-6" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Package Name</label>
                  <select
                    required
                    value={bookingForm.packageName}
                    onChange={e => setBookingForm({ ...bookingForm, packageName: e.target.value })}
                    className="w-full text-sm bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none font-medium cursor-pointer text-gray-900 dark:text-gray-100"
                  >
                    <option value="">Select a Product Package...</option>
                    {availableProducts.map((p, idx) => (
                      <option key={idx} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">No. of Pax</label>
                  <input type="number" required value={bookingForm.noOfPax} onChange={e => setBookingForm({ ...bookingForm, noOfPax: e.target.value })} className="w-full text-sm bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Start Date</label>
                  <input type="date" required value={bookingForm.startDate} onChange={e => setBookingForm({ ...bookingForm, startDate: e.target.value })} className="w-full text-sm bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">End Date</label>
                  <input type="date" required value={bookingForm.endDate} onChange={e => setBookingForm({ ...bookingForm, endDate: e.target.value })} className="w-full text-sm bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none" />
                </div>
              </div>

              <hr className="border-gray-200 dark:border-slate-700 mb-6" />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-2">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Total Amount (₹)</label>
                  <input type="number" required value={bookingForm.totalAmount} onChange={e => setBookingForm({ ...bookingForm, totalAmount: e.target.value })} className="w-full text-sm bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Paid Amount (₹)</label>
                  <input type="number" required value={bookingForm.paidAmount} onChange={e => setBookingForm({ ...bookingForm, paidAmount: e.target.value })} className="w-full text-sm bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Due Amount (₹)</label>
                  <input type="number" required value={bookingForm.dueAmount} onChange={e => setBookingForm({ ...bookingForm, dueAmount: e.target.value })} className="w-full text-sm bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none" />
                </div>
              </div>

              <div className="mt-8 flex justify-end gap-3">
                <button type="button" onClick={() => setShowBookingModal(false)} className="px-4 py-2 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-800 dark:text-gray-200 border border-transparent dark:border-slate-600 rounded-lg font-semibold text-sm transition-colors cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={isBooking} className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold text-sm shadow transition-colors disabled:opacity-50 cursor-pointer">
                  {isBooking ? 'Saving...' : 'Confirm Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
