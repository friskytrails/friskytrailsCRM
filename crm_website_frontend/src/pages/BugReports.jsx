import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function BugReports({ token, API_URL, user }) {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [filter, setFilter] = useState('all');

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/bugs`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setReports(data);
      } else {
        toast.error('Failed to load bug reports');
      }
    } catch {
      toast.error('Network error loading bug reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchReports();
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return toast.error('Please enter an issue title');
    if (!description.trim()) return toast.error('Please describe what went wrong');

    try {
      setSubmitting(true);
      const res = await fetch(`${API_URL}/bugs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim()
        })
      });

      if (res.ok) {
        const newReport = await res.json();
        setReports(prev => [newReport, ...prev]);
        setTitle('');
        setDescription('');
        toast.success('Bug report posted successfully!');
      } else {
        const errData = await res.json();
        toast.error(errData.error || 'Failed to submit bug report');
      }
    } catch {
      toast.error('Server error submitting bug report');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (reportId, currentStatus) => {
    const isClosed = currentStatus === 'Closed' || currentStatus === 'Resolved';
    const newStatus = isClosed ? 'Open' : 'Closed';
    try {
      const res = await fetch(`${API_URL}/bugs/${reportId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (res.ok) {
        const updated = await res.json();
        setReports(prev => prev.map(r => ((r.id || r._id) === reportId ? updated : r)));
        toast.success(`Bug marked as ${newStatus}`);
      } else {
        const errData = await res.json();
        toast.error(errData.error || 'Failed to update status');
      }
    } catch {
      toast.error('Server error updating status');
    }
  };

  const formatISTDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const filteredReports = reports.filter(r => {
    const isClosed = r.status === 'Closed' || r.status === 'Resolved';
    if (filter === 'open') return !isClosed;
    if (filter === 'closed') return isClosed;
    return true;
  });

  const openCount = reports.filter(r => r.status !== 'Closed' && r.status !== 'Resolved').length;
  const closedCount = reports.length - openCount;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-gray-900 dark:text-slate-100 pb-16 transition-colors">
      {/* Top Header Bar */}
      <div className="bg-orange-500 text-white shadow-sm border-b border-orange-600/30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/profile')}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white cursor-pointer"
              title="Back to Profile"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 className="text-lg font-bold text-white tracking-wide">
              Bug Reports
            </h1>
          </div>
          <span className="bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full">
            {reports.length} {reports.length === 1 ? 'Report' : 'Reports'}
          </span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 mt-6 space-y-6">
        {/* Submit Bug Form Card */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700/80 p-5 sm:p-6 shadow-sm">
          <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">Report a Bug</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-4">Submit issues or problems encountered in the platform.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1">
                Title
              </label>
              <input
                type="text"
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1">
                Description
              </label>
              <textarea
                rows={4}
                placeholder="What went wrong?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
              />
            </div>
            <button
              type="submit"
              disabled={submitting || !title.trim() || !description.trim()}
              className="w-full py-2.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm rounded-lg transition-colors cursor-pointer shadow-sm"
            >
              {submitting ? 'Posting Report...' : 'Post Report'}
            </button>
          </form>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-800 pb-3">
          <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
            Reported Issues
          </span>
          <div className="flex items-center gap-1 bg-gray-200/60 dark:bg-slate-800 p-1 rounded-lg">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                filter === 'all'
                  ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              All ({reports.length})
            </button>
            <button
              onClick={() => setFilter('open')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                filter === 'open'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Open ({openCount})
            </button>
            <button
              onClick={() => setFilter('closed')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                filter === 'closed'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Closed ({closedCount})
            </button>
          </div>
        </div>

        {/* Feed List */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-10 text-gray-500 dark:text-slate-400 text-sm">
              Loading bug reports...
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="text-center py-10 text-gray-500 dark:text-slate-400 text-sm bg-white dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-800">
              {filter === 'open' 
                ? 'No open bug reports.' 
                : filter === 'closed' 
                ? 'No closed bug reports.' 
                : 'No bug reports submitted yet.'}
            </div>
          ) : (
            filteredReports.map((report) => {
              const isClosed = report.status === 'Closed' || report.status === 'Resolved';

              return (
                <div
                  key={report.id || report._id}
                  className={`bg-white dark:bg-slate-800 rounded-xl border transition-all p-5 shadow-sm space-y-3 ${
                    isClosed
                      ? 'border-gray-200 dark:border-slate-800 opacity-90'
                      : 'border-gray-200 dark:border-slate-700/80'
                  }`}
                >
                  {/* Card Header Info */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-gray-900 dark:text-white break-words">
                        {report.title}
                      </h3>
                      <div className="text-xs text-orange-600 dark:text-orange-400 font-medium mt-1">
                        <span className="font-bold">{report.reporterName}</span>
                        <span className="mx-1.5 text-gray-400 dark:text-slate-500">•</span>
                        <span className="text-gray-500 dark:text-slate-400">{formatISTDate(report.createdAt)}</span>
                      </div>
                    </div>

                    {/* Status Badge & Action Toggle */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-md border ${
                        isClosed
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30'
                          : 'bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-400 border-orange-300 dark:border-orange-500/30'
                      }`}>
                        {isClosed ? 'Closed' : 'Open'}
                      </span>

                      <button
                        onClick={() => handleToggleStatus(report.id || report._id, report.status)}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-md transition-colors cursor-pointer border ${
                          isClosed
                            ? 'border-orange-300 dark:border-orange-500/40 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/30'
                            : 'border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        {isClosed ? 'Reopen' : 'Close'}
                      </button>
                    </div>
                  </div>

                  {/* Description Box */}
                  <p className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap pt-1 leading-relaxed">
                    {report.description}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
