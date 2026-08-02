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
    if (!title.trim()) return toast.error('Please enter a title');
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
        toast.success('Bug report submitted successfully!');
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

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 pb-12">
      {/* Top Bar Header */}
      <div className="bg-orange-500 px-4 sm:px-6 py-4 flex items-center gap-4 shadow-md">
        <button
          onClick={() => navigate('/profile')}
          className="text-white hover:text-orange-100 cursor-pointer p-1 rounded-lg transition-colors"
          title="Back to Profile"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-white tracking-wide">
          Bug Reports ({reports.length})
        </h1>
      </div>

      <div className="max-w-2xl mx-auto px-4 mt-6 space-y-6">
        {/* Report a Bug Form Card */}
        <div className="bg-slate-800/90 rounded-2xl border border-slate-700/80 p-5 shadow-lg">
          <h2 className="text-base font-bold text-white mb-4">Report a bug</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="text"
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-900/90 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <textarea
                rows={4}
                placeholder="What went wrong?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-900/90 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
              />
            </div>
            <button
              type="submit"
              disabled={submitting || !title.trim() || !description.trim()}
              className="w-full py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition-colors cursor-pointer shadow-sm"
            >
              {submitting ? 'Posting...' : 'Post Report'}
            </button>
          </form>
        </div>

        <p className="text-xs text-slate-400 text-center px-2">
          Reports are saved on the server and shared with every agent.
        </p>

        {/* Bug Reports Feed */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-10 text-slate-400 text-sm">
              Loading bug reports...
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm bg-slate-800/50 rounded-2xl border border-slate-800">
              No bug reports submitted yet.
            </div>
          ) : (
            reports.map((report) => (
              <div
                key={report.id || report._id}
                className="bg-slate-800/90 rounded-2xl border border-slate-700/80 p-5 space-y-2 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-base font-bold text-slate-100 break-words">
                    {report.title}
                  </h3>
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full shrink-0 ${
                    report.status === 'Resolved' 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                      : report.status === 'In Progress' 
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                  }`}>
                    {report.status || 'Open'}
                  </span>
                </div>

                <div className="text-xs text-orange-400 font-medium">
                  <span className="font-bold text-orange-400">{report.reporterName}</span>
                  <span className="mx-1.5 text-slate-500">•</span>
                  <span className="text-slate-400">{formatISTDate(report.createdAt)}</span>
                </div>

                <p className="text-sm text-slate-300 whitespace-pre-wrap pt-1 leading-relaxed">
                  {report.description}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
