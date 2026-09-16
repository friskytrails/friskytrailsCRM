import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import NoteItem from '../components/NoteItem';
import AgentMultiSelect from '../components/AgentMultiSelect';
import { uploadFileToCloudinary } from '../utils/uploadHelper';
import FocusTrap from 'focus-trap-react';

const STATUS_OPTIONS = [
  { value: 'Fresh Leads', color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800' },
  { value: 'Interested Leads', color: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-800' },
  { value: 'Pre Prospect Leads', color: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800' },
  { value: 'Prospect Leads', color: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-800' },
  { value: 'Booked', color: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/60 dark:text-green-300 dark:border-green-700' },
  { value: 'Rejected Leads', color: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/60 dark:text-red-300 dark:border-red-700' },
  { value: 'Future Leads', color: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/40 dark:text-cyan-300 dark:border-cyan-800' },
  { value: 'Non Responding Leads', color: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' },
  { value: 'Itinerary Required', color: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-800' },
  { value: 'Itinerary Updated', color: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/40 dark:text-teal-300 dark:border-teal-800' },
  { value: 'B2B Leads', color: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-900/40 dark:text-fuchsia-300 dark:border-fuchsia-800' }
];

export default function LeadDetail({ API_URL, token, user, setLeads, leads, agents, products = [], statuses = [], updateLeadStatus, updateLeadBooking, assignAgent, bookLeadAPI, createBookingAPI, editBookingAPI, getBookingAPI }) {
  const defaultProducts = ["Meghalaya Package", "Hampta Pass Trek", "Rishikesh Activities", "Spiti Package", "Ladakh Package", "Kerala Trip"];
  const availableProducts = (products && products.length > 0) ? products : defaultProducts;
  const availableStatuses = (statuses && statuses.length > 0) ? statuses : STATUS_OPTIONS.map(s => s.value);
  const { id } = useParams();
  const navigate = useNavigate();
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [noteInput, setNoteInput] = useState('');

  const [selectedImage, setSelectedImage] = useState(null); // base64 preview
  const [imageFile, setImageFile] = useState(null); // actual file to upload
  const [isUploading, setIsUploading] = useState(false);

  const [showBookingModal, setShowBookingModal] = useState(false);
  const [editingBookingId, setEditingBookingId] = useState(null);
  const [bookingForm, setBookingForm] = useState({
    travellerName: '',
    travellerEmail: '',
    travellerPhone: '',
    adults: 1,
    children: 0,
    packageName: '',
    location: '',
    startDate: '',
    endDate: '',
    totalAmount: '',
    paidAmount: '',
    dueAmount: 0,
    transactionId: '',
    paymentMode: 'Kalpana BOI',
    status: 'Pending',
    screenshotFile: null,
    screenshotPreview: null
  });
  const [isBooking, setIsBooking] = useState(false);
  const [isLoadingBooking, setIsLoadingBooking] = useState(false);

  const [isEditingProduct, setIsEditingProduct] = useState(false);
  const [productInput, setProductInput] = useState('');
  const [isEditingTravelDate, setIsEditingTravelDate] = useState(false);
  const [travelDateInput, setTravelDateInput] = useState('');
  const [isEditingPersons, setIsEditingPersons] = useState(false);
  const [personsInput, setPersonsInput] = useState('');
  const [isTripSectionOpen, setIsTripSectionOpen] = useState(false);
  const [isCallMetricsOpen, setIsCallMetricsOpen] = useState(true);
  const [isEditingTalkTime, setIsEditingTalkTime] = useState(false);
  const [dailyTalkTimeInput, setDailyTalkTimeInput] = useState('');
  const [isSavingTalkTime, setIsSavingTalkTime] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const shareMenuRef = useRef(null);

  // Keep the parent leads array in sync
  const syncLeadToParent = useCallback((updatedLead) => {
    if (setLeads && updatedLead) {
      setLeads(prev => prev.map(l => (l.id === updatedLead.id || l._id === updatedLead._id) ? updatedLead : l));
    }
  }, [setLeads]);

  // Safely updates local lead state while preserving stitched booking trips
  // if a mutation response was returned without stitched trips ({ withBookings: false })
  const updateLocalLead = useCallback((updatedLead) => {
    if (!updatedLead) return;
    setLead(prev => {
      const trips = (Array.isArray(updatedLead.trips) && updatedLead.trips.length > 0)
        ? updatedLead.trips
        : (prev?.trips || updatedLead.trips || []);
      const merged = { ...updatedLead, trips };
      syncLeadToParent(merged);
      return merged;
    });
  }, [syncLeadToParent]);

  // Safe clipboard helper with fallback for environments lacking navigator.clipboard
  const copyToClipboard = useCallback(async (text, successMsg, errorMsg) => {
    if (navigator?.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        toast.success(successMsg);
        return;
      } catch (err) {
        console.warn("navigator.clipboard failed, attempting fallback:", err);
      }
    }
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (success) {
        toast.success(successMsg);
        return;
      }
    } catch (fallbackErr) {
      console.error("Fallback clipboard copy failed:", fallbackErr);
    }
    toast.error(errorMsg || "Failed to copy to clipboard");
  }, []);

  // Close share dropdown on outside click or Escape key
  useEffect(() => {
    if (!showShareMenu) return;
    const handleClickOutside = (e) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(e.target)) {
        setShowShareMenu(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowShareMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showShareMenu]);

  // Active lead IDs for next/previous navigation
  const [navLeadIds, setNavLeadIds] = useState(() => {
    try {
      const stored = sessionStorage.getItem('activeLeadIds');
      if (stored) {
        const activeIds = JSON.parse(stored);
        if (Array.isArray(activeIds) && activeIds.length > 0) {
          return activeIds.map(item => (typeof item === 'object' && item !== null) ? String(item.id || item._id) : String(item)).filter(Boolean);
        }
      }
    } catch (e) {
      console.error("Failed to parse activeLeadIds:", e);
    }
    return [];
  });

  // Helper to parse time strings ('MM:SS' or 'HH:MM:SS') into seconds
  const parseTimeToSeconds = (str) => {
    if (!str || typeof str !== 'string') return 0;
    const parts = str.trim().split(':').map(val => parseInt(val, 10));
    if (parts.some(isNaN)) return 0;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 1) return parts[0];
    return 0;
  };

  // Helper to format seconds back into 'M:SS' or 'H:MM:SS'
  const formatSecondsToTime = (totalSec) => {
    if (!totalSec || isNaN(totalSec) || totalSec <= 0) return '0:00';
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  };

  // Memoized call log deduplication — only recomputes when lead.callLogs or totalDial/talkTime changes.
  // Applies compound cumulative disaggregation:
  //   Signal A: Logs are monotonically non-decreasing oldest→newest.
  //   Signal B: The newest entry's dailyDial/dailyTalkTime === booking.totalDial/talkTime.
  const dedupedCallLogs = useMemo(() => {
    if (!lead || !lead.callLogs || lead.callLogs.length === 0) return [];

    // Step 1: Deduplicate by date — keep the entry with the highest dailyDial per date
    const deduped = Object.values(
      lead.callLogs.reduce((acc, log) => {
        const key = log.date;
        if (!acc[key] || (log.dailyDial || 0) > (acc[key].dailyDial || 0)) {
          acc[key] = log;
        }
        return acc;
      }, {})
    );

    // Step 2: Sort chronologically (oldest first) to evaluate cumulative pattern
    deduped.sort((a, b) => (a.date > b.date ? 1 : -1));

    // Step 3: Compound cumulative signal check for dial counts and talk time
    const totalDial = lead?.booking?.totalDial || 0;
    const lastEntry = deduped[deduped.length - 1];
    const isDialNonDecreasing = deduped.every(
      (log, i) => i === 0 || (log.dailyDial || 0) >= (deduped[i - 1].dailyDial || 0)
    );
    const isDialCumulative =
      deduped.length > 1 &&
      isDialNonDecreasing &&
      totalDial > 0 &&
      (lastEntry?.dailyDial || 0) === totalDial;

    const totalTalkSec = parseTimeToSeconds(lead?.booking?.talkTime);
    const lastTalkSec = parseTimeToSeconds(lastEntry?.dailyTalkTime);
    const isTalkNonDecreasing = deduped.every(
      (log, i) => i === 0 || parseTimeToSeconds(log.dailyTalkTime) >= parseTimeToSeconds(deduped[i - 1].dailyTalkTime)
    );
    const isTalkCumulative =
      isDialCumulative ||
      (deduped.length > 1 && isTalkNonDecreasing && totalTalkSec > 0 && lastTalkSec === totalTalkSec);

    // Step 4: Disaggregate cumulative dials and talk times to per-day delta values
    const corrected = deduped.map((log, i) => {
      let dailyDial = log.dailyDial || 0;
      if (isDialCumulative) {
        const prevCumulative = i === 0 ? 0 : (deduped[i - 1].dailyDial || 0);
        dailyDial = Math.max(0, dailyDial - prevCumulative);
      }

      let dailyTalkTime = log.dailyTalkTime || '0:00';
      if (isTalkCumulative) {
        const prevTalkSec = i === 0 ? 0 : parseTimeToSeconds(deduped[i - 1].dailyTalkTime);
        const currTalkSec = parseTimeToSeconds(log.dailyTalkTime);
        const deltaTalkSec = Math.max(0, currTalkSec - prevTalkSec);
        dailyTalkTime = formatSecondsToTime(deltaTalkSec);
      }

      return { ...log, dailyDial, dailyTalkTime };
    });

    // Step 5: Filter out zero dials (days where no calls took place) and return newest-first for UI display
    return corrected
      .filter(log => (Number(log.dailyDial) || 0) > 0)
      .sort((a, b) => (b.date > a.date ? 1 : -1));
  }, [lead?.callLogs, lead?.booking?.totalDial, lead?.booking?.talkTime]);

  const formatISTDateTime = (dateStr) => {
    if (!dateStr) return 'Not set';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Not set';
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getISTDateAndParts = (dateStr) => {
    if (!dateStr) {
      const now = new Date();
      const options = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false };
      const parts = new Intl.DateTimeFormat('en-GB', options).formatToParts(now);
      const getPart = (type) => parts.find(p => p.type === type)?.value || '00';
      return {
        date: `${getPart('year')}-${getPart('month')}-${getPart('day')}`,
        time: `${getPart('hour')}:${getPart('minute')}`
      };
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      return { date: '', time: '' };
    }
    const options = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false };
    const parts = new Intl.DateTimeFormat('en-GB', options).formatToParts(d);
    const getPart = (type) => parts.find(p => p.type === type)?.value || '00';
    return {
      date: `${getPart('year')}-${getPart('month')}-${getPart('day')}`,
      time: `${getPart('hour')}:${getPart('minute')}`
    };
  };

  const [isEditingReminder, setIsEditingReminder] = useState(false);
  const [reminderDateInput, setReminderDateInput] = useState('');
  const [reminderTimeInput, setReminderTimeInput] = useState('');
  const [isSavingReminder, setIsSavingReminder] = useState(false);

  const handleStartEditReminder = () => {
    const { date, time } = getISTDateAndParts(lead?.dates?.reminderDate);
    setReminderDateInput(date);
    setReminderTimeInput(time);
    setIsEditingReminder(true);
  };

  const handleSaveReminder = async (customValue) => {
    try {
      setIsSavingReminder(true);
      let targetReminderDate = null;
      if (customValue !== undefined) {
        targetReminderDate = customValue;
      } else if (reminderDateInput) {
        const timeToUse = reminderTimeInput || '09:00';
        targetReminderDate = new Date(`${reminderDateInput}T${timeToUse}:00+05:30`).toISOString();
      }

      const res = await fetch(`${API_URL}/leads/${lead.id || lead._id}/reminder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          reminderDate: targetReminderDate
        })
      });
      if (res.ok) {
        const updatedLead = await res.json();
        updateLocalLead(updatedLead);
        setIsEditingReminder(false);
        toast.success(targetReminderDate ? 'Reminder updated!' : 'Reminder cleared!');
      } else {
        const errData = await res.json();
        toast.error(errData.error || 'Failed to update reminder');
      }
    } catch (err) {
      console.error(err);
      toast.error('Server error updating reminder');
    } finally {
      setIsSavingReminder(false);
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
        updateLocalLead(updated);
        setIsEditingProduct(false);
        toast.success("Product package updated successfully!");
      } else {
        toast.error("Failed to update product package");
      }
    } catch {
      toast.error("Error updating product package");
    }
  };

  const handleTravelDateSave = async () => {
    try {
      const res = await fetch(`${API_URL}/leads/${lead.id || lead._id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ travelDate: travelDateInput })
      });
      if (res.ok) {
        const updated = await res.json();
        updateLocalLead(updated);
        setIsEditingTravelDate(false);
        toast.success("Travel date updated successfully!");
      } else {
        const errData = await res.json();
        toast.error(errData.error || "Failed to update travel date");
      }
    } catch {
      toast.error("Error updating travel date");
    }
  };

  const handlePersonsSave = async () => {
    try {
      const trimmed = String(personsInput || '').trim();
      let num = null;
      if (trimmed !== '') {
        num = Number(trimmed);
        if (!Number.isSafeInteger(num) || num < 1) {
          toast.error("Number of persons must be a positive integer (at least 1).");
          return;
        }
      }
      const res = await fetch(`${API_URL}/leads/${lead.id || lead._id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ numberOfPersons: num })
      });
      if (res.ok) {
        const updated = await res.json();
        updateLocalLead(updated);
        setIsEditingPersons(false);
        toast.success("Number of persons updated successfully!");
      } else {
        const errData = await res.json();
        toast.error(errData.error || "Failed to update number of persons");
      }
    } catch {
      toast.error("Error updating number of persons");
    }
  };

  const [agentLeadCounts, setAgentLeadCounts] = useState({});

  const fetchLeadCounts = useCallback(async () => {
    if (!token || !API_URL) return;
    try {
      const res = await fetch(`${API_URL}/leads/counts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAgentLeadCounts(data.agentCounts || {});
      }
    } catch (err) {
      console.error('Error fetching lead counts:', err);
    }
  }, [token, API_URL]);

  useEffect(() => {
    fetchLeadCounts();
  }, [fetchLeadCounts]);

  const getAgentLeadCount = useCallback((agentId) => {
    const key = String(agentId || '');
    return agentLeadCounts[key] || 0;
  }, [agentLeadCounts]);

  const handleBackClick = () => {
    const savedBackUrl = sessionStorage.getItem('leadDetail_backUrl');
    if (savedBackUrl) {
      navigate(savedBackUrl);
    } else {
      navigate('/agents');
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      toast.error("File size must be 15MB or smaller");
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

  // Ensure navigation sequence is populated even when opening direct link or refreshing
  useEffect(() => {
    const currentId = String(lead?.id || lead?._id || id || '');
    if (!token || !API_URL || !currentId) return;

    if (navLeadIds.length > 0 && navLeadIds.some(nId => String(nId) === currentId)) {
      return;
    }

    const fetchSequence = async () => {
      try {
        const res = await fetch(`${API_URL}/leads?pagination=false`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : (data.leads || []);
          const ids = list.map(l => String(l.id || l._id)).filter(Boolean);
          if (ids.length > 0) {
            setNavLeadIds(ids);
            sessionStorage.setItem('activeLeadIds', JSON.stringify(ids));
          }
        }
      } catch (err) {
        console.error("Failed to fetch lead navigation sequence:", err);
      }
    };

    fetchSequence();
  }, [id, lead?.id, lead?._id, token, API_URL, navLeadIds]);


  const handleSendNote = async () => {
    if (!noteInput.trim() && !imageFile) return;

    setIsUploading(true);
    try {
      let finalImageUrl = null;

      // Upload file directly to Cloudinary using signed upload credentials
      if (imageFile) {
        try {
          finalImageUrl = await uploadFileToCloudinary(imageFile, token, API_URL);
        } catch (uploadErr) {
          console.error('Direct upload error:', uploadErr);
          toast.error(`File upload failed: ${uploadErr.message}`);
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
        updateLocalLead(updated);
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
        updateLocalLead(updated);
        toast.success('Note deleted');
      } else {
        toast.error('Failed to delete note');
      }
    } catch (error) {
      console.error(error);
      toast.error('Server connection error');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(d);
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
      if (user?.isItinerary) {
        toast.error("Itinerary Team members cannot book leads");
        return;
      }
      setEditingBookingId(null);
      setBookingForm({
        travellerName: lead.name || '',
        travellerEmail: lead.mailId || lead.email || lead.travellerEmail || '',
        travellerPhone: lead.phone || '',
        adults: (Number(lead.numberOfPersons) > 0 ? Number(lead.numberOfPersons) : (Number(lead.bookingDetails?.noOfPax) > 0 ? Number(lead.bookingDetails.noOfPax) : 1)),
        children: 0,
        packageName: lead.product || '',
        location: lead.destination || lead.location || lead.destinationLocation || '',
        startDate: '',
        endDate: '',
        totalAmount: '',
        paidAmount: '',
        dueAmount: 0,
        transactionId: '',
        paymentMode: 'Kalpana BOI',
        status: 'Pending',
        screenshotFile: null,
        screenshotPreview: null
      });
      setShowBookingModal(true);
      return;
    }

    const previousLead = { ...lead };
    setLead({ ...lead, status: newStatus });
    const updated = await updateLeadStatus(lead.id, newStatus);
    if (updated) {
      updateLocalLead(updated);
      fetchLeadCounts();
    } else {
      setLead(previousLead);
    }
  };

  const submitBooking = async (e) => {
    e.preventDefault();

    if (!bookingForm.travellerName || !bookingForm.travellerName.trim()) {
      toast.error("Full Name is required.");
      return;
    }
    if (!bookingForm.travellerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bookingForm.travellerEmail.trim())) {
      toast.error("Valid Email ID is required.");
      return;
    }
    const cleanPhone = (bookingForm.travellerPhone || '').trim();
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      toast.error("Phone Number must be exactly 10 digits starting with 6, 7, 8, or 9.");
      return;
    }
    const adultsNum = parseInt(bookingForm.adults, 10);
    const childrenNum = parseInt(bookingForm.children, 10);
    const validAdults = (!isNaN(adultsNum) && adultsNum >= 0) ? adultsNum : 1;
    const validChildren = (!isNaN(childrenNum) && childrenNum >= 0) ? childrenNum : 0;
    if (validAdults === 0 && validChildren === 0) {
      toast.error("Total passengers must be at least 1.");
      return;
    }
    if (!bookingForm.packageName || !bookingForm.packageName.trim()) {
      toast.error("Package Name is required.");
      return;
    }
    if (!bookingForm.location || !bookingForm.location.trim()) {
      toast.error("Destination Location is required.");
      return;
    }
    if (!bookingForm.startDate || !bookingForm.endDate) {
      toast.error("Start Date and End Date are required.");
      return;
    }
    if (new Date(bookingForm.endDate) < new Date(bookingForm.startDate)) {
      toast.error("End Date cannot be earlier than Start Date.");
      return;
    }
    const tot = parseFloat(bookingForm.totalAmount);
    const pd = parseFloat(bookingForm.paidAmount);
    if (isNaN(tot) || tot < 0) {
      toast.error("Total Amount must be a non-negative number.");
      return;
    }
    if (isNaN(pd) || pd < 0) {
      toast.error("Paid Amount must be a non-negative number.");
      return;
    }
    if (pd > tot) {
      toast.error("Paid Amount cannot exceed Total Amount.");
      return;
    }
    const isEdit = !!editingBookingId;
    const cleanTxn = (bookingForm.transactionId || '').trim();

    if (!isEdit) {
      if (!cleanTxn || !/^[a-zA-Z0-9_-]+$/.test(cleanTxn)) {
        toast.error("Transaction ID is required (only letters, numbers, underscore, hyphen allowed).");
        return;
      }
      if (!bookingForm.screenshotFile) {
        toast.error("Transaction screenshot file is mandatory for booking.");
        return;
      }
    }

    setIsBooking(true);

    const formData = new FormData();
    formData.append('travellerName', bookingForm.travellerName.trim());
    formData.append('travellerEmail', bookingForm.travellerEmail.trim());
    formData.append('travellerPhone', cleanPhone);
    formData.append('adults', validAdults);
    formData.append('children', validChildren);
    formData.append('noOfPax', validAdults + validChildren);
    formData.append('numberOfPersons', validAdults + validChildren);
    formData.append('packageName', bookingForm.packageName.trim());
    formData.append('location', bookingForm.location.trim());
    formData.append('startDate', bookingForm.startDate);
    formData.append('endDate', bookingForm.endDate);
    formData.append('totalAmount', tot);
    formData.append('paidAmount', pd);
    if (cleanTxn) formData.append('transactionId', cleanTxn);
    if (bookingForm.paymentMode) formData.append('paymentMode', bookingForm.paymentMode);
    if (bookingForm.status) formData.append('status', bookingForm.status);
    formData.append('leadId', lead.id);
    if (bookingForm.screenshotFile) {
      formData.append('screenshot', bookingForm.screenshotFile);
    }

    let result = null;
    if (isEdit && editBookingAPI) {
      result = await editBookingAPI(editingBookingId, formData);
    } else if (createBookingAPI) {
      result = await createBookingAPI(formData);
    }
    setIsBooking(false);

    if (result) {
      setShowBookingModal(false);
      setEditingBookingId(null);

      const tripObj = {
        bookingId: result.bookingId,
        travellerName: result.travellerName,
        travellerEmail: result.travellerEmail,
        travellerPhone: result.travellerPhone,
        adults: result.adults !== undefined ? result.adults : validAdults,
        children: result.children !== undefined ? result.children : validChildren,
        noOfPax: result.noOfPax !== undefined ? result.noOfPax : (validAdults + validChildren),
        packageName: result.packageName,
        location: result.location,
        startDate: result.startDate,
        endDate: result.endDate,
        totalAmount: result.totalAmount,
        paidAmount: result.paidAmount,
        dueAmount: result.dueAmount,
        transactionId: result.transactionId,
        paymentMode: result.paymentMode,
        screenshot: result.screenshot,
        status: result.status || 'Booked',
        createdAt: result.createdAt || new Date()
      };

      const existingTrips = Array.isArray(lead.trips) ? lead.trips : [];
      let updatedTrips;
      if (isEdit) {
        updatedTrips = existingTrips.map(t => {
          if ((t.bookingId && t.bookingId === editingBookingId) || t._id === editingBookingId) {
            return { ...t, ...tripObj };
          }
          return t;
        });
      } else {
        updatedTrips = [...existingTrips, tripObj];
      }

      const shouldUpdateBookingDetails = !isEdit || (lead.bookingDetails && lead.bookingDetails.bookingId === editingBookingId);

      const updatedLead = {
        ...lead,
        status: 'Booked',
        trips: updatedTrips,
        bookingDetails: shouldUpdateBookingDetails ? {
          ...lead.bookingDetails,
          ...tripObj
        } : lead.bookingDetails
      };

      setLead(updatedLead);
      syncLeadToParent(updatedLead);
      fetchLeadCounts();
    }
  };

  const handleAssignAgent = async (newIds) => {
    if (!lead || !assignAgent) return;
    const previousLead = { ...lead };
    const currentAgents = (lead.agentIds || []).map(String).sort();
    const nextAgents = (newIds || []).map(String).sort();
    const isAgentChanged = currentAgents.length !== nextAgents.length || currentAgents.some((val, idx) => val !== nextAgents[idx]);

    const resetBooking = isAgentChanged ? {
      totalDial: 0,
      dailyDial: 0,
      connected: 0,
      talkTime: '0:0',
      dailyTalkTime: '0:0',
      firstCall: null,
      lastCall: null
    } : (lead.booking || {});

    const optimisticLead = {
      ...lead,
      agentIds: newIds,
      booking: resetBooking,
      callLogs: isAgentChanged ? [] : (lead.callLogs || [])
    };

    setLead(optimisticLead); // Optimistic update
    syncLeadToParent(optimisticLead);

    const updated = await assignAgent(lead.id, newIds);
    if (updated) {
      updateLocalLead(updated);
      fetchLeadCounts();
    } else {
      setLead(previousLead);
      syncLeadToParent(previousLead);
    }
  };

  const handleOpenTalkTimeModal = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!user?.isAdmin) return;
    setDailyTalkTimeInput(lead?.booking?.dailyTalkTime || '0:0');
    setIsEditingTalkTime(true);
  };

  const handleSaveTalkTime = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!user?.isAdmin || !updateLeadBooking || !lead) return;

    const trimmedDaily = (dailyTalkTimeInput || '').trim();
    const talkTimeRegex = /^\d+(:[0-5]?\d){1,2}$/;

    if (!trimmedDaily) {
      toast.error("Please enter daily talk time");
      return;
    }
    if (!talkTimeRegex.test(trimmedDaily)) {
      toast.error("Invalid Daily Talk Time format. Use MM:SS or HH:MM:SS (e.g. 05:30)");
      return;
    }

    setIsSavingTalkTime(true);
    try {
      const currentBooking = lead.booking || {};
      const now = new Date().toISOString();
      const payload = {
        dailyTalkTime: trimmedDaily,
        dailyDial: Math.max(Number(currentBooking.dailyDial) || 0, 1),
        totalDial: Math.max(Number(currentBooking.totalDial) || 0, 1),
        connected: Math.max(Number(currentBooking.connected) || 0, 1)
      };

      if (!currentBooking.firstCall) {
        payload.firstCall = now;
      }
      if (!currentBooking.lastCall) {
        payload.lastCall = now;
      }

      const updated = await updateLeadBooking(lead.id || lead._id, payload);
      if (updated) {
        updateLocalLead(updated);
        setIsEditingTalkTime(false);
        toast.success("Daily talk time and call log updated successfully");
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to update talk time");
    } finally {
      setIsSavingTalkTime(false);
    }
  };

  const handleCopyLeadLink = () => {
    setShowShareMenu(false);
    copyToClipboard(window.location.href, "Lead link copied to clipboard!", "Failed to copy link");
  };

  const handleCopyLeadSummary = () => {
    setShowShareMenu(false);
    if (!lead) return;
    const summary = [
      `📋 Lead: ${lead.name || 'Unnamed'}`,
      `📞 Phone: ${lead.phone || 'N/A'}`,
      lead.mailId ? `✉️ Email: ${lead.mailId}` : null,
      lead.destination ? `📍 Destination: ${lead.destination}` : null,
      lead.product ? `📦 Package: ${lead.product}` : null,
      lead.travelDate ? `📅 Travel Date: ${lead.travelDate}` : null,
      lead.numberOfPersons ? `👥 Pax: ${lead.numberOfPersons}` : null,
      `📊 Status: ${lead.status || 'Fresh Leads'}`,
      `🔗 Link: ${window.location.href}`
    ].filter(Boolean).join('\n');

    copyToClipboard(summary, "Lead details copied to clipboard!", "Failed to copy details");
  };

  const handleShareWhatsApp = () => {
    setShowShareMenu(false);
    if (!lead) return;
    const summary = [
      `*Lead Details - Frisky Trails CRM*`,
      `*Name:* ${lead.name || 'Unnamed'}`,
      `*Phone:* ${lead.phone || 'N/A'}`,
      lead.mailId ? `*Email:* ${lead.mailId}` : null,
      lead.destination ? `*Destination:* ${lead.destination}` : null,
      lead.product ? `*Package:* ${lead.product}` : null,
      lead.travelDate ? `*Travel Date:* ${lead.travelDate}` : null,
      lead.numberOfPersons ? `*Pax:* ${lead.numberOfPersons}` : null,
      `*Status:* ${lead.status || 'Fresh Leads'}`,
      `*CRM Link:* ${window.location.href}`
    ].filter(Boolean).join('\n');

    const encoded = encodeURIComponent(summary);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
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
      <div className="flex flex-col items-center justify-center h-[50vh]">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-200">Lead not found</h2>
        <button onClick={() => navigate(-1)} className="text-orange-600 hover:text-orange-700 text-sm font-semibold mt-2 inline-block cursor-pointer">  Go Back</button>
      </div>
    );
  }

  const currentLeadId = String(lead?.id || lead?._id || id || '');
  const currentLeadIndex = navLeadIds.findIndex(leadId => String(leadId) === currentLeadId);
  const prevLeadId = currentLeadIndex > 0 ? navLeadIds[currentLeadIndex - 1] : null;
  const nextLeadId = (currentLeadIndex >= 0 && currentLeadIndex < navLeadIds.length - 1) ? navLeadIds[currentLeadIndex + 1] : null;
  const assignedAgents = (lead.agentIds || []).map(id => agents?.find(a => a.id === id)).filter(Boolean);

  if (user?.isItinerary) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Top Navigation Bar */}
        <div className="flex items-center justify-between gap-2 mb-4 sm:mb-6 flex-wrap sm:flex-nowrap">
          <button
            onClick={handleBackClick}
            className="inline-flex items-center text-sm text-gray-500 hover:text-orange-600 dark:text-slate-400 dark:hover:text-orange-400 font-medium transition-colors cursor-pointer shrink-0"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={() => prevLeadId && navigate(`/leads/${prevLeadId}`)}
              disabled={!prevLeadId}
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer whitespace-nowrap"
              title={prevLeadId ? 'Previous Lead' : 'First lead'}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              <span className="hidden sm:inline">Previous Lead</span>
              <span className="sm:hidden">Prev</span>
            </button>
            <button
              onClick={() => nextLeadId && navigate(`/leads/${nextLeadId}`)}
              disabled={!nextLeadId}
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer whitespace-nowrap"
              title={nextLeadId ? 'Next Lead' : 'Last lead'}
            >
              <span className="hidden sm:inline">Next Lead</span>
              <span className="sm:hidden">Next</span>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Lead Header Card */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{lead.name || 'Unnamed Lead'}</h1>
                {lead.product && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border border-purple-100/30">
                    {lead.product}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500 dark:text-slate-400">
                <span className="font-semibold text-gray-700 dark:text-slate-200">
                  Assigned To: {assignedAgents.length > 0 ? assignedAgents.map(a => a.name).join(', ') : 'Unassigned'}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {(lead.origin || lead.destination) && (
                <div className="bg-gray-50 dark:bg-slate-900/60 rounded-xl px-4 py-2 flex items-center space-x-3 text-xs border border-gray-100 dark:border-slate-700/60">
                  <div>
                    <span className="block text-[9px] uppercase tracking-wider text-gray-400 font-semibold">Origin</span>
                    <span className="font-medium text-gray-800 dark:text-slate-200">{lead.origin || '—'}</span>
                  </div>
                  <div className="text-orange-500 font-bold">➔</div>
                  <div>
                    <span className="block text-[9px] uppercase tracking-wider text-gray-400 font-semibold">Destination</span>
                    <span className="font-medium text-gray-800 dark:text-slate-200">{lead.destination || '—'}</span>
                  </div>
                </div>
              )}

              <select
                value={lead.status || 'Fresh Leads'}
                onChange={(e) => handleStatusChange(e.target.value)}
                className={`text-xs font-bold py-1 px-2.5 rounded-lg border-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500 transition-colors ${(STATUS_OPTIONS.find(s => s.value === (lead.status || 'Fresh Leads')) || STATUS_OPTIONS[0]).color}`}
              >
                {availableStatuses.map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Comments Section */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-3.5 sm:p-6 overflow-hidden">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center mb-6">
            <svg className="w-4 h-4 mr-2 text-orange-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Comments & Notes Section ({lead.notes ? lead.notes.length : 0})
          </h2>

          {/* Note Input */}
          <div className="flex items-start space-x-2.5 sm:space-x-3 mb-6 min-w-0">
            <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-400 flex items-center justify-center font-bold text-xs shrink-0">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              {selectedImage && (
                <div className="relative inline-block mb-3 rounded-lg overflow-hidden border border-gray-200 dark:border-slate-700 max-w-full">
                  {selectedImage.startsWith('DOCUMENT:') ? (
                    <div className="p-3 sm:p-4 bg-gray-100 dark:bg-slate-800 text-xs sm:text-sm font-semibold flex items-center h-20 w-auto max-w-full truncate">
                      📄 <span className="truncate ml-1">{selectedImage.replace('DOCUMENT:', '')}</span>
                    </div>
                  ) : (
                    <img src={selectedImage} alt="Upload preview" className="h-20 w-auto object-cover max-w-full" />
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
                placeholder="Write a comment / note for itinerary... (Ctrl + Enter or click Send to submit)"
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handleSendNote();
                  }
                }}
                className="w-full text-sm p-3 border border-gray-200 dark:border-slate-700 dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none h-24"
              />
              <div className="flex items-center justify-between mt-2">
                <label className="flex items-center space-x-1.5 text-xs text-gray-500 hover:text-orange-600 dark:text-slate-400 dark:hover:text-orange-400 font-semibold cursor-pointer transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  <span>Attach Image or File</span>
                  <input
                    type="file"
                    accept="image/*,.pdf,.doc,.docx"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
                <button
                  onClick={handleSendNote}
                  disabled={(!noteInput.trim() && !imageFile) || isUploading}
                  className="bg-orange-600 hover:bg-orange-700 text-white text-xs px-4 py-2 rounded-xl font-bold cursor-pointer disabled:opacity-50 transition-colors shadow-sm"
                >
                  {isUploading ? 'Uploading...' : 'Send Note'}
                </button>
              </div>
            </div>
          </div>

          {/* Notes List */}
          <div className="space-y-3 border-t border-gray-100 dark:border-slate-700/60 pt-6 overflow-x-hidden">
            {(!lead.notes || lead.notes.length === 0) ? (
              <div className="text-center py-10 bg-gray-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-gray-200 dark:border-slate-700">
                <p className="text-sm font-medium text-gray-400 dark:text-slate-500">No notes or comments added yet.</p>
              </div>
            ) : (
              lead.notes.map((note) => (
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
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4 flex-wrap sm:flex-nowrap">
        <button
          onClick={handleBackClick}
          className="inline-flex items-center text-sm text-gray-500 hover:text-orange-600 dark:text-slate-400 dark:hover:text-orange-400 font-medium transition-colors cursor-pointer shrink-0"
        >
          <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Share Lead Dropdown */}
          <div className="relative" ref={shareMenuRef}>
            <button
              onClick={() => setShowShareMenu(!showShareMenu)}
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all shadow-sm cursor-pointer whitespace-nowrap"
              title="Share this lead"
            >
              <svg className="w-3.5 h-3.5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              <span>Share</span>
            </button>

            {showShareMenu && (
              <div className="absolute right-0 mt-1 w-52 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-200 dark:border-slate-700 py-1.5 z-40 animate-in fade-in zoom-in-95 duration-100">
                <button
                  onClick={handleCopyLeadLink}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-gray-700 dark:text-slate-200 hover:bg-orange-50 dark:hover:bg-slate-700 hover:text-orange-600 dark:hover:text-orange-400 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  Copy Lead Link
                </button>
                <button
                  onClick={handleCopyLeadSummary}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-gray-700 dark:text-slate-200 hover:bg-orange-50 dark:hover:bg-slate-700 hover:text-orange-600 dark:hover:text-orange-400 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                  </svg>
                  Copy Details (Text)
                </button>
                <button
                  onClick={handleShareWhatsApp}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-gray-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-slate-700 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-2 cursor-pointer border-t border-gray-100 dark:border-slate-700/60 mt-1 pt-1.5 transition-colors"
                >
                  <span className="text-emerald-500 font-bold">💬</span>
                  Share via WhatsApp
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => prevLeadId && navigate(`/leads/${prevLeadId}`)}
            disabled={!prevLeadId}
            className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer whitespace-nowrap"
            title={prevLeadId ? 'Previous Lead' : 'First lead'}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden sm:inline">Previous Lead</span>
            <span className="sm:hidden">Prev</span>
          </button>
          <button
            onClick={() => nextLeadId && navigate(`/leads/${nextLeadId}`)}
            disabled={!nextLeadId}
            className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer whitespace-nowrap"
            title={nextLeadId ? 'Next Lead' : 'Last lead'}
          >
            <span className="hidden sm:inline">Next Lead</span>
            <span className="sm:hidden">Next</span>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-4 sm:p-5 mb-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white truncate">{lead.name || 'Unnamed Lead'}</h1>
          </div>
          <div className="flex-1 flex justify-center w-full sm:w-auto">
            <div className="bg-gray-50 dark:bg-slate-900/60 rounded-xl p-3 sm:p-4 flex items-center space-x-3 sm:space-x-6 w-full max-w-[320px] sm:max-w-[360px]">
              <div className="text-center flex-1 min-w-0">
                <span className="block text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Origin</span>
                <span className="text-xs sm:text-sm font-medium text-gray-800 dark:text-slate-200 truncate block">{lead.origin || '—'}</span>
              </div>
              <div className="text-orange-500 font-bold shrink-0">➔</div>
              <div className="text-center flex-1 min-w-0">
                <span className="block text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Destination</span>
                <span className="text-xs sm:text-sm font-medium text-gray-800 dark:text-slate-200 truncate block">{lead.destination || '—'}</span>
              </div>
            </div>
          </div>
          <div className="flex-1 flex flex-col sm:items-end justify-center gap-1.5 mt-2 sm:mt-0">
            <span className="flex items-center text-xs sm:text-sm font-semibold text-gray-600 dark:text-gray-300">
              <svg className="w-4 h-4 mr-1.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
              {lead.phone}
            </span>
            {lead.mailId && (
              <span className="flex items-center text-xs sm:text-sm font-semibold text-gray-600 dark:text-gray-300 break-all">
                <svg className="w-4 h-4 mr-1.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                {lead.mailId}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5 mt-3">
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
                className="px-2 py-1 bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-200 text-xs rounded transition-colors cursor-pointer font-medium"
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
          {/* Editable Travel Date Badge */}
          {isEditingTravelDate ? (
            <div className="inline-flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/60 p-1.5 px-2 rounded-md border border-emerald-200 dark:border-emerald-800">
              <input
                type="date"
                value={travelDateInput}
                onChange={(e) => setTravelDateInput(e.target.value)}
                className="text-xs font-semibold text-emerald-900 dark:text-emerald-100 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 rounded px-2 py-1 outline-none cursor-pointer"
                autoFocus
              />
              <button
                onClick={handleTravelDateSave}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded transition-colors cursor-pointer"
              >
                Save
              </button>
              <button
                onClick={() => setIsEditingTravelDate(false)}
                className="px-2 py-1 bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-200 text-xs rounded transition-colors cursor-pointer font-medium"
              >
                Cancel
              </button>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-100/50">
              📅 Travel Date: {lead.travelDate ? formatDisplayDate(lead.travelDate) : 'Not Set'}
              {(user?.isAdmin || (lead.agentIds || []).includes(user?.id) || (lead.agentIds || []).includes(user?.userId)) && (
                <button
                  onClick={() => {
                    setTravelDateInput(lead.travelDate || '');
                    setIsEditingTravelDate(true);
                  }}
                  className="text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-200 ml-1 cursor-pointer p-0.5 rounded transition-colors"
                  title="Edit Travel Date"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                </button>
              )}
            </span>
          )}

          {/* Editable Number of Persons Badge */}
          {isEditingPersons ? (
            <div className="inline-flex items-center gap-1.5 bg-cyan-50 dark:bg-cyan-950/60 p-1.5 px-2 rounded-md border border-cyan-200 dark:border-cyan-800">
              <input
                type="number"
                min="1"
                placeholder="No. of persons"
                value={personsInput}
                onChange={(e) => setPersonsInput(e.target.value)}
                className="w-24 text-xs font-semibold text-cyan-900 dark:text-cyan-100 bg-white dark:bg-slate-900 border border-cyan-300 dark:border-cyan-700 rounded px-2 py-1 outline-none"
                autoFocus
              />
              <button
                onClick={handlePersonsSave}
                className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs rounded transition-colors cursor-pointer"
              >
                Save
              </button>
              <button
                onClick={() => setIsEditingPersons(false)}
                className="px-2 py-1 bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-200 text-xs rounded transition-colors cursor-pointer font-medium"
              >
                Cancel
              </button>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300 border border-cyan-100/50">
              👥 Persons: {lead.numberOfPersons !== undefined && lead.numberOfPersons !== null && lead.numberOfPersons !== '' ? `${lead.numberOfPersons} Pax` : (lead.bookingDetails?.noOfPax ? `${lead.bookingDetails.noOfPax} Pax` : 'Not Set')}
              {(user?.isAdmin || (lead.agentIds || []).includes(user?.id) || (lead.agentIds || []).includes(user?.userId)) && (
                <button
                  onClick={() => {
                    setPersonsInput(lead.numberOfPersons !== undefined && lead.numberOfPersons !== null ? String(lead.numberOfPersons) : (lead.bookingDetails?.noOfPax ? String(lead.bookingDetails.noOfPax) : ''));
                    setIsEditingPersons(true);
                  }}
                  className="text-cyan-500 hover:text-cyan-700 dark:hover:text-cyan-200 ml-1 cursor-pointer p-0.5 rounded transition-colors"
                  title="Edit Number of Persons"
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
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-3.5 sm:p-4 mb-4">
        {/* Status Bar: Status on Left, Call Metrics Header & Toggle on Right */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Status Block */}
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Status:
            </span>
            <select
              value={lead.status || 'Fresh Leads'}
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={!(user?.isAdmin || (lead.agentIds || []).includes(user?.id)) || (lead.status === 'Booked' && !user?.isAdmin)}
              className={`text-xs font-bold py-1.5 px-3 rounded-lg border cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500 transition-colors shadow-sm ${getStatusDef(lead.status || 'Fresh Leads').color} ${(lead.status === 'Booked' && !user?.isAdmin) ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {availableStatuses.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          {/* Call Metrics Header & Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              Call Metrics
            </span>
            <button
              type="button"
              onClick={() => setIsCallMetricsOpen(!isCallMetricsOpen)}
              className="text-[11px] font-semibold text-gray-500 dark:text-slate-400 hover:text-orange-600 dark:hover:text-orange-400 px-2 py-0.5 rounded-md border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/60 transition-colors cursor-pointer flex items-center gap-1 shadow-sm"
              title={isCallMetricsOpen ? "Collapse Call Metrics" : "Expand Call Metrics"}
            >
              <span>{isCallMetricsOpen ? 'Collapse' : 'Expand'}</span>
              <svg className={`w-3 h-3 transform transition-transform duration-200 ${isCallMetricsOpen ? 'rotate-180' : 'rotate-0'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Call Metrics Grid: 1 compact row on desktop! */}
        {isCallMetricsOpen && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 mt-2.5 pt-2.5 border-t border-gray-100 dark:border-slate-700/60">
            <div className="bg-gray-50 dark:bg-slate-700/40 rounded-lg p-2 border border-gray-100 dark:border-slate-600/50 text-center flex flex-col justify-center">
              <span className="block text-[9px] uppercase tracking-wider text-gray-400 dark:text-gray-400 font-bold truncate">Total Dial</span>
              <span className="text-sm font-extrabold text-gray-800 dark:text-gray-100">{lead.booking?.totalDial || 0}</span>
            </div>
            <div className="bg-blue-50/60 dark:bg-blue-900/30 rounded-lg p-2 border border-blue-100/60 dark:border-blue-700/40 text-center flex flex-col justify-center">
              <span className="block text-[9px] uppercase tracking-wider text-blue-500 dark:text-blue-400 font-bold truncate">Daily Dial</span>
              <span className="text-sm font-extrabold text-gray-800 dark:text-gray-100">{lead.booking?.dailyDial || 0}</span>
            </div>
            <div className="bg-gray-50 dark:bg-slate-700/40 rounded-lg p-2 border border-gray-100 dark:border-slate-600/50 text-center flex flex-col justify-center">
              <span className="block text-[9px] uppercase tracking-wider text-gray-400 dark:text-gray-400 font-bold truncate">Connected</span>
              <span className="text-sm font-extrabold text-gray-800 dark:text-gray-100">{lead.booking?.connected || 0}</span>
            </div>
            <div className="bg-gray-50 dark:bg-slate-700/40 rounded-lg p-2 border border-gray-100 dark:border-slate-600/50 text-center flex flex-col justify-center">
              <span className="block text-[9px] uppercase tracking-wider text-gray-400 dark:text-gray-400 font-bold truncate">Talk Time</span>
              <span className="text-sm font-extrabold text-gray-800 dark:text-gray-100">{lead.booking?.talkTime || '0:0'}</span>
            </div>
            <div 
              onClick={handleOpenTalkTimeModal}
              role={user?.isAdmin ? "button" : undefined}
              tabIndex={user?.isAdmin ? 0 : undefined}
              onKeyDown={user?.isAdmin ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleOpenTalkTimeModal();
                }
              } : undefined}
              className={`bg-blue-50/60 dark:bg-blue-900/30 rounded-lg p-2 border border-blue-100/60 dark:border-blue-700/40 text-center flex flex-col justify-center relative group ${user?.isAdmin ? 'cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/40 transition-all' : ''}`}
              title={user?.isAdmin ? "Click to edit talk time (Admin)" : undefined}
            >
              <div className="flex items-center justify-center gap-1">
                <span className="block text-[9px] uppercase tracking-wider text-blue-500 dark:text-blue-400 font-bold truncate">Daily Talk</span>
                {user?.isAdmin && (
                  <svg className="w-2.5 h-2.5 text-blue-400 group-hover:text-blue-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                )}
              </div>
              <span className="text-sm font-extrabold text-gray-800 dark:text-gray-100">{lead.booking?.dailyTalkTime || '0:0'}</span>
            </div>
            <div className="bg-gray-50 dark:bg-slate-700/40 rounded-lg p-2 border border-gray-100 dark:border-slate-600/50 text-center flex flex-col justify-center">
              <span className="block text-[9px] uppercase tracking-wider text-gray-400 dark:text-gray-400 font-bold truncate">Age</span>
              <span className="text-sm font-extrabold text-gray-800 dark:text-gray-100">{computeAge()}</span>
            </div>
            <div className="bg-amber-50/60 dark:bg-amber-900/30 rounded-lg p-2 border border-amber-100/60 dark:border-amber-700/40 text-center flex flex-col justify-center">
              <span className="block text-[9px] uppercase tracking-wider text-amber-500 dark:text-amber-400 font-bold truncate">First Call</span>
              <span className="text-[11px] font-bold text-gray-700 dark:text-gray-200 truncate block" title={lead.booking?.firstCall ? formatDisplayDate(lead.booking.firstCall) : 'No call recorded'}>
                {lead.booking?.firstCall ? formatDisplayDate(lead.booking.firstCall) : '—'}
              </span>
            </div>
            <div className="bg-amber-50/60 dark:bg-amber-900/30 rounded-lg p-2 border border-amber-100/60 dark:border-amber-700/40 text-center flex flex-col justify-center">
              <span className="block text-[9px] uppercase tracking-wider text-amber-500 dark:text-amber-400 font-bold truncate">Last Call</span>
              <span className="text-[11px] font-bold text-gray-700 dark:text-gray-200 truncate block" title={lead.booking?.lastCall ? formatDisplayDate(lead.booking.lastCall) : 'No call recorded'}>
                {lead.booking?.lastCall ? formatDisplayDate(lead.booking.lastCall) : '—'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Two-section layout: Reminder & Trip Info on Left, Chat on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6 mb-4">
        {/* Left section: Historical Call Logs, Reminder & Trip Information */}
        <div className="lg:col-span-2 space-y-6">

          {/* Historical Call Logs */}
          {dedupedCallLogs.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider flex items-center gap-2">
                  <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Historical Call Logs
                </h2>
                <span className="px-2 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 text-[11px] font-bold rounded-full">
                  {dedupedCallLogs.length} {dedupedCallLogs.length === 1 ? 'Day' : 'Days'}
                </span>
              </div>
              <div className="overflow-x-auto max-h-[220px] overflow-y-auto pr-0.5">
                <table className="w-full text-xs text-left">
                  <thead className="text-[10px] text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-slate-700/50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 rounded-l-lg">Date</th>
                      <th className="px-3 py-2 text-center">Dials</th>
                      <th className="px-3 py-2 text-right rounded-r-lg">Talk Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dedupedCallLogs.map((log, idx) => (
                      <tr key={idx} className="border-b last:border-0 border-gray-100 dark:border-slate-700 hover:bg-gray-50/50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-3 py-2 font-semibold text-gray-900 dark:text-white whitespace-nowrap">{formatDisplayDate(log.date)}</td>
                        <td className="px-3 py-2 text-center font-bold text-gray-700 dark:text-gray-200">{log.dailyDial}</td>
                        <td className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-300">{log.dailyTalkTime}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Reminder / Due Date Card */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-5">
            {(() => {
              const canEditReminder = user?.isAdmin || (lead.agentIds || []).some(id => String(id) === String(user?.id || user?._id));
              return (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider flex items-center gap-2">
                      <span>📅</span>
                      Reminder
                    </h2>
                    <div className="flex items-center gap-3">
                      {lead.dates?.reminderDate && !isEditingReminder && canEditReminder && (
                        <button
                          onClick={() => handleSaveReminder(null)}
                          disabled={isSavingReminder}
                          className="text-xs font-bold text-orange-600 dark:text-orange-400 hover:text-orange-700 cursor-pointer transition-colors"
                        >
                          Clear
                        </button>
                      )}
                      {!isEditingReminder && canEditReminder && (
                        <button
                          onClick={handleStartEditReminder}
                          className="p-1 text-gray-400 hover:text-orange-500 transition-colors cursor-pointer"
                          title="Edit Reminder Date & Time"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {isEditingReminder ? (
                    <div className="space-y-3 mt-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1">
                            Date (IST)
                          </label>
                          <input
                            type="date"
                            required
                            value={reminderDateInput}
                            onChange={(e) => setReminderDateInput(e.target.value)}
                            className="w-full text-sm bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg p-2.5 text-gray-800 dark:text-slate-200 focus:ring-2 focus:ring-orange-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1">
                            Time (IST)
                          </label>
                          <input
                            type="time"
                            required
                            value={reminderTimeInput}
                            onChange={(e) => setReminderTimeInput(e.target.value)}
                            className="w-full text-sm bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg p-2.5 text-gray-800 dark:text-slate-200 focus:ring-2 focus:ring-orange-500 outline-none"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => handleSaveReminder()}
                          disabled={isSavingReminder || !reminderDateInput}
                          className="flex-1 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-lg transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
                        >
                          {isSavingReminder ? 'Saving...' : 'Save Date & Time'}
                        </button>
                        <button
                          onClick={() => setIsEditingReminder(false)}
                          className="px-3 py-2 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300 font-bold text-xs rounded-lg hover:bg-gray-300 transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 mt-2">
                      <div 
                        onClick={() => canEditReminder && handleStartEditReminder()}
                        className={`text-sm font-semibold text-gray-800 dark:text-slate-200 ${canEditReminder ? 'cursor-pointer hover:text-orange-600 dark:hover:text-orange-400 transition-colors' : ''}`}
                        title={canEditReminder ? 'Click to edit date & time' : ''}
                      >
                        <span className="text-gray-500 dark:text-slate-400 font-medium mr-1.5">Set:</span>
                        {formatISTDateTime(lead.dates?.reminderDate)}
                      </div>

                      {canEditReminder && (
                        <button
                          onClick={handleStartEditReminder}
                          className="w-full py-2.5 px-4 rounded-xl border border-gray-300 dark:border-slate-700 bg-gray-50/80 dark:bg-slate-900/60 hover:bg-gray-100 dark:hover:bg-slate-700/80 text-orange-600 dark:text-orange-400 font-bold text-sm text-center transition-colors cursor-pointer shadow-sm"
                        >
                          Change Date & Time
                        </button>
                      )}
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          {/* Trip Information & Multi-Trip List - Collapsible */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
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
                  {lead.trips?.length || 0} Recorded
                </span>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsTripSectionOpen(!isTripSectionOpen);
                }}
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
                {(!lead.trips || lead.trips.length === 0) ? (
                  <div className="p-6 text-center text-gray-500 dark:text-slate-400 text-xs font-medium">
                    No trips recorded for this lead yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(lead.trips || []).map((trip, idx) => {
                      if (!trip) return null;
                      return (
                        <div 
                          key={trip._id || trip.tripId || idx} 
                          className="p-4 bg-gray-50 dark:bg-slate-900/70 rounded-xl border border-gray-200 dark:border-slate-700/80 flex flex-col xl:flex-row xl:items-center justify-between gap-3 text-xs"
                        >
                          {/* Left Side: Package & Travel Info */}
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-gray-900 dark:text-white text-sm">
                                {trip.packageName || 'Trip Package'}
                                {trip.location ? ` (${trip.location})` : ''}
                              </span>
                              <span className="text-[11px] text-gray-500 dark:text-slate-400 font-semibold">
                                • {(() => {
                                  const adultCount = (Number(trip.adults) > 0)
                                    ? Number(trip.adults)
                                    : (Number(trip.noOfPax) > 0 ? Number(trip.noOfPax) : (Number(lead.numberOfPersons) > 0 ? Number(lead.numberOfPersons) : 1));
                                  const childCount = Number(trip.children) || 0;
                                  const totalPax = adultCount + childCount;
                                  return `${totalPax} Pax${childCount > 0 ? ` (${adultCount} Adult${adultCount > 1 ? 's' : ''}, ${childCount} Child${childCount > 1 ? 'ren' : ''})` : ''}`;
                                })()}
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
                                {trip.travellerName || trip.fullName || lead.name} ({trip.travellerPhone || trip.contactNumber || lead.phone})
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
                                ₹{Number(trip.totalAmount ?? trip.bookingDetails?.totalAmount ?? 0).toLocaleString('en-IN')}
                                <span className="text-gray-400 font-normal mx-1">|</span>
                                <span className={Number(trip.dueAmount ?? trip.bookingDetails?.dueAmount ?? 0) > 0 ? 'text-rose-600 dark:text-rose-400 font-extrabold' : 'text-emerald-600 dark:text-emerald-400 font-bold'}>
                                  Due: ₹{Number(trip.dueAmount ?? trip.bookingDetails?.dueAmount ?? 0).toLocaleString('en-IN')}
                                </span>
                              </div>
                            </div>

                            {!user?.isItinerary && (() => {
                              const tripKey = trip.bookingId || trip._id || trip.id || trip.transactionId;
                              const hasValidKey = !!tripKey;

                              return (
                                <button
                                  type="button"
                                  disabled={!hasValidKey}
                                  onClick={() => {
                                    try {
                                      const lookupKey = tripKey;
                                      setEditingBookingId(lookupKey);

                                      let startDt = '';
                                      let endDt = '';
                                      if (trip.startDate) {
                                        startDt = formatDate(trip.startDate);
                                      }
                                      if (trip.endDate) {
                                        endDt = formatDate(trip.endDate);
                                      }

                                      const tot = (trip.totalAmount !== undefined && trip.totalAmount !== null) ? trip.totalAmount : (lead.bookingDetails?.totalAmount ?? '');
                                      const pd = (trip.paidAmount !== undefined && trip.paidAmount !== null) ? trip.paidAmount : (lead.bookingDetails?.paidAmount ?? '');
                                      const due = (tot !== '' && pd !== '') ? Math.max(0, Number(tot) - Number(pd)) : (trip.dueAmount ?? lead.bookingDetails?.dueAmount ?? 0);
                                      const txn = trip.transactionId || trip.paymentId || (Array.isArray(trip.payments) && trip.payments[0] ? (trip.payments[0].details || trip.payments[0].transactionId) : '') || trip.details || lead.bookingDetails?.transactionId || lead.bookingDetails?.paymentId || lead.bookingDetails?.details || '';
                                      const payMode = trip.paymentMode || (Array.isArray(trip.payments) && trip.payments[0] ? trip.payments[0].paymentMode : '') || lead.bookingDetails?.paymentMode || 'Kalpana BOI';
                                      const ssPreview = trip.screenshot || trip.screenshotUrl || (Array.isArray(trip.payments) && trip.payments[0] ? trip.payments[0].attachment : '') || lead.bookingDetails?.screenshot || lead.bookingDetails?.screenshotUrl || lead.bookingDetails?.attachment || null;
                                      const tripChildCount = (trip.children !== undefined && !isNaN(Number(trip.children))) ? Number(trip.children) : 0;
                                      const tripExplicitAdults = (trip.adults !== undefined && trip.adults !== null && !isNaN(Number(trip.adults))) ? Number(trip.adults) : undefined;
                                      const tripFallbackPax = (Number(trip.noOfPax) > 0 ? Number(trip.noOfPax) : (Number(lead.numberOfPersons) > 0 ? Number(lead.numberOfPersons) : undefined));
                                      const tripResolvedAdults = tripExplicitAdults !== undefined ? tripExplicitAdults : (tripFallbackPax !== undefined ? tripFallbackPax : (tripChildCount > 0 ? 0 : 1));

                                      setBookingForm({
                                        travellerName: trip.travellerName || trip.fullName || lead.name || '',
                                        travellerEmail: trip.travellerEmail || trip.emailId || trip.email || lead.mailId || lead.email || '',
                                        travellerPhone: trip.travellerPhone || trip.contactNumber || trip.phone || lead.phone || '',
                                        adults: tripResolvedAdults,
                                        children: tripChildCount,
                                        packageName: trip.packageName || lead.product || '',
                                        location: trip.location || trip.destination || trip.destinationLocation || lead.destination || lead.location || '',
                                        startDate: startDt,
                                        endDate: endDt,
                                        totalAmount: tot,
                                        paidAmount: pd,
                                        dueAmount: due,
                                        transactionId: txn,
                                        paymentMode: payMode,
                                        status: trip.status || lead.bookingDetails?.status || 'Pending',
                                        screenshotFile: null,
                                        screenshotPreview: ssPreview
                                      });
                                      setShowBookingModal(true);

                                      if (getBookingAPI && lookupKey) {
                                        setIsLoadingBooking(true);
                                        const queryOptions = {};
                                        if (trip.packageName) queryOptions.packageName = trip.packageName;
                                        
                                        getBookingAPI(lookupKey, queryOptions).then(res => {
                                          setEditingBookingId(currentId => {
                                            if (currentId !== lookupKey) return currentId;
                                            
                                            if (res) {
                                              let fetchedStart = '';
                                              let fetchedEnd = '';
                                              if (res.startDate) {
                                                fetchedStart = formatDate(res.startDate);
                                              }
                                              if (res.endDate) {
                                                fetchedEnd = formatDate(res.endDate);
                                              }

                                              const resChildCount = (res.children !== undefined && !isNaN(Number(res.children))) ? Number(res.children) : 0;
                                              const resExplicitAdults = (res.adults !== undefined && res.adults !== null && !isNaN(Number(res.adults))) ? Number(res.adults) : undefined;
                                              const resFallbackPax = (Number(res.noOfPax) > 0 ? Number(res.noOfPax) : undefined);
                                              const resResolvedAdults = resExplicitAdults !== undefined ? resExplicitAdults : (resFallbackPax !== undefined ? resFallbackPax : (resChildCount > 0 ? 0 : 1));

                                              setBookingForm(prev => ({
                                                ...prev,
                                                travellerName: res.travellerName || res.fullName || prev.travellerName,
                                                travellerEmail: res.travellerEmail || res.emailId || res.email || prev.travellerEmail,
                                                travellerPhone: res.travellerPhone || res.contactNumber || res.phone || prev.travellerPhone,
                                                adults: resResolvedAdults,
                                                children: resChildCount,
                                                packageName: res.packageName || prev.packageName,
                                                location: res.location || res.destination || res.destinationLocation || prev.location,
                                                startDate: fetchedStart || prev.startDate,
                                                endDate: fetchedEnd || prev.endDate,
                                                totalAmount: res.totalAmount ?? prev.totalAmount,
                                                paidAmount: res.paidAmount ?? prev.paidAmount,
                                                dueAmount: res.dueAmount ?? prev.dueAmount,
                                                transactionId: res.transactionId || res.paymentId || (Array.isArray(res.payments) && res.payments[0] ? (res.payments[0].details || res.payments[0].transactionId) : '') || prev.transactionId,
                                                paymentMode: res.paymentMode || (Array.isArray(res.payments) && res.payments[0] ? res.payments[0].paymentMode : '') || prev.paymentMode,
                                                status: res.status || prev.status,
                                                screenshotPreview: res.screenshot || res.screenshotUrl || (Array.isArray(res.payments) && res.payments[0] ? res.payments[0].attachment : '') || prev.screenshotPreview
                                              }));
                                            }
                                            
                                            setIsLoadingBooking(false);
                                            return currentId;
                                          });
                                        }).catch(err => {
                                          console.error("Error fetching booking details:", err);
                                          setEditingBookingId(currentId => {
                                            if (currentId === lookupKey) setIsLoadingBooking(false);
                                            return currentId;
                                          });
                                        });
                                      }
                                    } catch (err) {
                                      console.error("Error opening edit modal:", err);
                                      setShowBookingModal(true);
                                    }
                                  }}
                                  className={`p-2 border rounded-lg flex items-center gap-1 font-bold text-xs transition-colors ${!hasValidKey ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-500' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100 cursor-pointer dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700'}`}
                                  title={!hasValidKey ? "Trip lacks an identifier" : "Edit Trip Details"}
                                >
                                  <svg className="w-3.5 h-3.5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                  Edit
                                </button>
                              );
                            })()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

        </div>

        {/* Right section: Comments & Activity (Chat) */}
        <div className="lg:col-span-3 min-w-0">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-3.5 sm:p-5 overflow-hidden">
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider flex items-center mb-4">
              <svg className="w-4 h-4 mr-2 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              Comments & Activity
            </h2>

            {/* Note input */}
            <div className="flex items-start space-x-2.5 sm:space-x-3 mb-6 min-w-0">
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-orange-600">{user?.name?.charAt(0)?.toUpperCase() || 'U'}</span>
              </div>
              <div className="flex-1 min-w-0">
                {selectedImage && (
                  <div className="relative inline-block mb-3 rounded-lg overflow-hidden border border-gray-200 dark:border-slate-700 max-w-full">
                    {selectedImage.startsWith('DOCUMENT:') ? (
                      <div className="p-3 sm:p-4 bg-gray-100 dark:bg-slate-800 text-xs sm:text-sm font-semibold flex items-center h-20 w-auto max-w-full truncate">
                        📄 <span className="truncate ml-1">{selectedImage.replace('DOCUMENT:', '')}</span>
                      </div>
                    ) : (
                      <img src={selectedImage} alt="Upload preview" className="h-20 w-auto object-cover max-w-full" />
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
            <div className="space-y-3 max-h-[500px] overflow-y-auto overflow-x-hidden pr-1">
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
        <FocusTrap focusTrapOptions={{ escapeDeactivates: false, fallbackFocus: '.modal-content' }}>
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm modal-content"
            role="dialog"
            aria-modal="true"
            aria-label={editingBookingId ? `Edit Booking (${editingBookingId})` : 'Add New Booking'}
            tabIndex="-1"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setShowBookingModal(false);
                setEditingBookingId(null);
              }
            }}
          >
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-900/60">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {editingBookingId ? `Edit Booking (${editingBookingId})` : 'Add New Booking'}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {editingBookingId ? 'Update traveller, trip, and payment verification details' : 'Fill in traveller, trip, and payment verification details'}
                  </p>
                </div>
                <button 
                  onClick={() => {
                    setShowBookingModal(false);
                    setEditingBookingId(null);
                  }} 
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                  aria-label="Close"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <form onSubmit={submitBooking} className="p-6 overflow-y-auto flex-1 space-y-6">
                <fieldset disabled={isLoadingBooking || isBooking} className="space-y-6 min-w-0">
                  {/* Section 1: Traveller Information */}
              <div>
                <h4 className="text-sm font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  1. Traveller Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Full Name *</label>
                    <input 
                      type="text" 
                      required 
                      value={bookingForm.travellerName} 
                      onChange={e => setBookingForm({ ...bookingForm, travellerName: e.target.value })} 
                      placeholder="e.g. John Doe"
                      className="w-full text-sm bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Email ID *</label>
                    <input 
                      type="email" 
                      required 
                      value={bookingForm.travellerEmail} 
                      onChange={e => setBookingForm({ ...bookingForm, travellerEmail: e.target.value })} 
                      placeholder="john@example.com"
                      className="w-full text-sm bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Phone Number (10 digits) *</label>
                    <input 
                      type="tel" 
                      required 
                      maxLength={10}
                      value={bookingForm.travellerPhone} 
                      onChange={e => setBookingForm({ ...bookingForm, travellerPhone: e.target.value })} 
                      placeholder="9876543210"
                      className="w-full text-sm bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Adults *</label>
                    <input 
                      type="number" 
                      min={0}
                      required 
                      value={bookingForm.adults} 
                      onChange={e => setBookingForm({ ...bookingForm, adults: e.target.value })} 
                      className="w-full text-sm bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Children *</label>
                    <input 
                      type="number" 
                      min={0}
                      required 
                      value={bookingForm.children} 
                      onChange={e => setBookingForm({ ...bookingForm, children: e.target.value })} 
                      className="w-full text-sm bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none" 
                    />
                  </div>
                </div>
              </div>

              <hr className="border-gray-200 dark:border-slate-700" />

              {/* Section 2: Trip & Package Details */}
              <div>
                <h4 className="text-sm font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 002 2h1.5a2.5 2.5 0 002.5-2.5V8.065M12 3a9 9 0 100 18 9 9 0 000-18z" /></svg>
                  2. Trip & Package Details
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Package Name *</label>
                    <input 
                      type="text" 
                      required 
                      value={bookingForm.packageName} 
                      onChange={e => setBookingForm({ ...bookingForm, packageName: e.target.value })} 
                      placeholder="e.g. Classic Bali Adventure"
                      className="w-full text-sm bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Destination Location *</label>
                    <input 
                      type="text" 
                      required 
                      value={bookingForm.location} 
                      onChange={e => setBookingForm({ ...bookingForm, location: e.target.value })} 
                      placeholder="e.g. Ubud, Bali, Indonesia"
                      className="w-full text-sm bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Start Date *</label>
                    <input 
                      type="date" 
                      required 
                      value={bookingForm.startDate} 
                      onChange={e => setBookingForm({ ...bookingForm, startDate: e.target.value })} 
                      className="w-full text-sm bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">End Date *</label>
                    <input 
                      type="date" 
                      required 
                      min={bookingForm.startDate}
                      value={bookingForm.endDate} 
                      onChange={e => setBookingForm({ ...bookingForm, endDate: e.target.value })} 
                      className="w-full text-sm bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none" 
                    />
                  </div>
                </div>
              </div>

              <hr className="border-gray-200 dark:border-slate-700" />

              {/* Section 3: Billing & Transaction Verification */}
              <div>
                <h4 className="text-sm font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                  3. Billing & Transaction Verification
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Total Amount (₹) *</label>
                    <input 
                      type="number" 
                      min={0}
                      required 
                      value={bookingForm.totalAmount} 
                      onChange={e => {
                        const tot = e.target.value;
                        const pd = bookingForm.paidAmount;
                        const due = (tot !== '' && pd !== '') ? Math.max(0, Number(tot) - Number(pd)) : 0;
                        setBookingForm({ ...bookingForm, totalAmount: tot, dueAmount: due });
                      }} 
                      className="w-full text-sm bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Paid Amount (₹) *</label>
                    <input 
                      type="number" 
                      min={0}
                      required 
                      value={bookingForm.paidAmount} 
                      onChange={e => {
                        const pd = e.target.value;
                        const tot = bookingForm.totalAmount;
                        const due = (tot !== '' && pd !== '') ? Math.max(0, Number(tot) - Number(pd)) : 0;
                        setBookingForm({ ...bookingForm, paidAmount: pd, dueAmount: due });
                      }} 
                      className="w-full text-sm bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Calculated Due Amount (₹)</label>
                    <input 
                      type="number" 
                      readOnly
                      disabled
                      value={bookingForm.dueAmount} 
                      className="w-full text-sm bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-gray-500 font-semibold cursor-not-allowed" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Transaction ID {!editingBookingId && '*'}</label>
                    <input 
                      type="text" 
                      required={!editingBookingId}
                      value={bookingForm.transactionId} 
                      onChange={e => setBookingForm({ ...bookingForm, transactionId: e.target.value })} 
                      placeholder="TXN874291857"
                      className="w-full text-sm bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Payment Mode *</label>
                    <select
                      required
                      value={bookingForm.paymentMode}
                      onChange={e => setBookingForm({ ...bookingForm, paymentMode: e.target.value })}
                      className="w-full text-sm bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none font-medium cursor-pointer"
                    >
                      <option value="Kalpana BOI">Kalpana BOI</option>
                      <option value="Kalpana PNB">Kalpana PNB</option>
                      <option value="Babita AU">Babita AU</option>
                      <option value="Hari Mohan BOB">Hari Mohan BOB</option>
                      <option value="FT HDFC">FT HDFC</option>
                      <option value="Pratyush SBI">Pratyush SBI</option>
                    </select>
                  </div>
                </div>

                {editingBookingId && (
                  <div className="mb-4">
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Booking Status</label>
                    <select
                      value={bookingForm.status || 'Pending'}
                      onChange={e => setBookingForm({ ...bookingForm, status: e.target.value })}
                      className="w-full text-sm bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none font-medium cursor-pointer"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Booked">Booked</option>
                      <option value="Cancelled">Cancelled</option>
                      <option value="On Hold">On Hold</option>
                      <option value="Confirmed">Confirmed</option>
                      <option value="Partial Payment">Partial Payment</option>
                      <option value="Payment Done">Payment Done</option>
                    </select>
                  </div>
                )}

                {/* Screenshot Upload */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Transaction Screenshot (PNG/JPG/PDF, max 5MB) {editingBookingId ? '(Optional replacement)' : '*'}
                  </label>
                  <input 
                    type="file" 
                    required={!editingBookingId}
                    accept="image/png, image/jpeg, image/jpg, application/pdf"
                    onChange={e => {
                      const file = e.target.files[0];
                      if (file) {
                        if (file.size > 5 * 1024 * 1024) {
                          toast.error("File size cannot exceed 5 MB.");
                          e.target.value = '';
                          return;
                        }
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setBookingForm(prev => ({
                            ...prev,
                            screenshotFile: file,
                            screenshotPreview: reader.result
                          }));
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100 dark:file:bg-slate-700 dark:file:text-orange-300 cursor-pointer border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-1.5"
                  />
                  {bookingForm.screenshotPreview && (
                    <div className="mt-2 flex items-center gap-3 bg-gray-50 dark:bg-slate-900/50 p-2 rounded-lg border border-gray-200 dark:border-slate-700">
                      {bookingForm.screenshotFile?.type === 'application/pdf' || bookingForm.screenshotPreview.endsWith('.pdf') ? (
                        <span className="text-xs text-red-500 font-semibold flex items-center gap-1">📄 PDF screenshot attached</span>
                      ) : (
                        <img src={bookingForm.screenshotPreview} alt="Screenshot Preview" className="h-16 w-16 object-cover rounded-md border" />
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Buttons */}
              <div className="pt-4 border-t border-gray-200 dark:border-slate-700 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => {
                    setShowBookingModal(false);
                    setEditingBookingId(null);
                  }} 
                  className="px-5 py-2 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-800 dark:text-gray-200 rounded-lg font-semibold text-sm transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isBooking} 
                  className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold text-sm shadow transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-2"
                >
                  {isBooking ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {editingBookingId ? 'Saving Changes...' : 'Submitting Booking...'}
                    </>
                  ) : (
                    editingBookingId ? 'Save Changes' : 'Submit Booking'
                  )}
                </button>
              </div>
              </fieldset>
            </form>
          </div>
        </div>
      </FocusTrap>
    )}

    {/* Admin Edit Talk Time Modal */}
    {isEditingTalkTime && user?.isAdmin && (
      <FocusTrap focusTrapOptions={{ escapeDeactivates: false, fallbackFocus: '.talk-time-modal' }}>
        <div 
          className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 talk-time-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Edit Talk Time"
          tabIndex="-1"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setIsEditingTalkTime(false);
            }
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsEditingTalkTime(false);
            }
          }}
        >
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3.5 border-b border-gray-100 dark:border-slate-700 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">Edit Daily Talk Time</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Admin Control — Adjust daily duration and log</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingTalkTime(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSaveTalkTime} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                  Daily Talk Time
                </label>
                <input
                  type="text"
                  value={dailyTalkTimeInput}
                  onChange={(e) => setDailyTalkTimeInput(e.target.value)}
                  placeholder="e.g. 05:30 or 1:05:20"
                  autoFocus
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-sm font-medium focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                />
                <p className="text-[11px] text-gray-400 dark:text-slate-400 mt-1">Format: MM:SS or HH:MM:SS</p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsEditingTalkTime(false)}
                  className="px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-300 text-xs font-bold hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingTalkTime}
                  className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow hover:shadow-md transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {isSavingTalkTime ? 'Saving...' : 'Save Daily Talk Time'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </FocusTrap>
    )}
  </div>
);
}

