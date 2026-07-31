import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const API_URL = `${import.meta.env.VITE_API_URL}`;

export default function ManagerDashboard({ user, token, leads = [] }) {
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user?.isManager || user?.isAdmin) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    if (!token || !user?.isManager) {
      setLoading(false);
      return;
    }
    fetchTeam();
  }, [token, user]);

  async function fetchTeam() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/agents/my-team`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTeam(data);
      } else {
        toast.error('Failed to load team data');
      }
    } catch {
      toast.error('Could not connect to server');
    } finally {
      setLoading(false);
    }
  }

  const getLocalDateString = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleAttendanceUpdate = async (agentId, newAttendance) => {
    try {
      const res = await fetch(`${API_URL}/agents/${agentId}/metrics`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ attendance: newAttendance, attendanceDate: getLocalDateString(new Date()) })
      });
      if (res.ok) {
        setTeam(prevTeam => prevTeam.map(a => a.id === agentId ? { ...a, attendance: newAttendance } : a));
        toast.success('Attendance updated');
      } else {
        toast.error('Failed to update attendance');
      }
    } catch {
      toast.error('Network error');
    }
  };

  const agentLeadCounts = leads.reduce((acc, lead) => {
    (lead.agentIds || []).forEach(agentId => {
      acc[agentId] = (acc[agentId] || 0) + 1;
    });
    return acc;
  }, {});

  const statusColors = {
    Active: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50',
    Inactive: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/50',
    'Former Employee': 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-slate-700 dark:text-slate-300',
  };

  if (!user?.isManager || user?.isAdmin) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">My Team</h1>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Total Team Members" value={team.length} color="violet"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>} />
        <StatCard label="Total Leads" value={team.reduce((sum, agent) => sum + (agentLeadCounts[agent.id] || 0), 0)} color="emerald"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>} />
        <StatCard label="Active Members today (Present)" value={team.filter(a => a.attendance === 'P').length} color="emerald"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
            <p className="text-sm text-gray-500 dark:text-slate-400 font-medium">Loading your team...</p>
          </div>
        </div>
      ) : team.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-800/80 rounded-2xl border border-gray-200 dark:border-slate-700">
          <div className="bg-violet-50 dark:bg-violet-900/30 p-4 rounded-2xl mb-4">
            <svg className="w-10 h-10 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-gray-700 dark:text-slate-300 mb-1">No agents assigned yet</h3>
          <p className="text-sm text-gray-400 dark:text-slate-500 text-center max-w-xs">Your admin has not assigned any agents to your team yet.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-sm text-gray-600 bg-gray-50 dark:bg-slate-700 dark:text-gray-300 border-b border-gray-200 dark:border-slate-700 font-medium">
                <tr>
                  <th className="px-6 py-4 font-medium font-sans">Agent Name</th>
                  <th className="px-6 py-4 font-medium font-sans">Number of Leads</th>
                  <th className="px-6 py-4 font-medium font-sans">Status</th>
                  <th className="px-6 py-4 font-medium font-sans">Monthly Target</th>
                  <th className="px-6 py-4 font-medium font-sans">Today's Attendance</th>
                  <th className="px-6 py-4 font-medium font-sans">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700/50">
                {team.map(agent => {
                  const progress = agent.monthlyTarget > 0 ? Math.min(100, Math.round((agent.targetCompleted / agent.monthlyTarget) * 100)) : 0;
                  return (
                    <tr key={agent.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors bg-white dark:bg-slate-800/80">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-semibold text-gray-900 dark:text-white">{agent.name}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 font-bold text-gray-900 dark:text-white">
                          <span className={`px-2 py-0.5 rounded-md text-xs ${agentLeadCounts[agent.id] > 0 ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400' : 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-400'}`}>
                            {agentLeadCounts[agent.id] || 0}
                          </span>
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {agent.status === 'Active' ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                            Active
                          </span>
                        ) : agent.isVerified ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                            Verified <svg className="w-4 h-4 text-emerald-500 dark:text-emerald-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-300">
                            {agent.status || 'Inactive'}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-2 w-36">
                          <div className="flex justify-between text-xs font-medium">
                            <span className="text-gray-700 dark:text-slate-300">Progress</span>
                            <span className="text-gray-900 dark:text-white">{progress}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-full bg-violet-600 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={agent.attendance || ''}
                          onChange={(e) => handleAttendanceUpdate(agent.id, e.target.value)}
                          className={`text-xs font-bold px-2.5 py-1.5 rounded-lg border border-transparent cursor-pointer focus:ring-2 focus:ring-violet-500 outline-none transition-colors ${
                            agent.attendance === 'P' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' :
                            agent.attendance === 'A' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' :
                            'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-400'
                          }`}
                        >
                          <option value="">Not marked</option>
                          <option value="P">Present</option>
                          <option value="A">Absent</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link 
                          to={`/agents/${agent.id}`} 
                          className="inline-flex items-center justify-center px-4 py-2 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 dark:bg-violet-600 dark:hover:bg-violet-700 rounded-md transition-colors"
                        >
                          View Leads
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color }) {
  const borderColors = {
    violet: 'border-violet-200 dark:border-violet-800/50',
    emerald: 'border-emerald-200 dark:border-emerald-800/50',
  };
  const iconColors = {
    violet: 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400',
    emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400',
  };

  return (
    <div className={`bg-white dark:bg-slate-800/80 rounded-xl border ${borderColors[color] || borderColors.emerald} p-4 shadow-sm flex items-center gap-4`}>
      <div className={`p-3 rounded-xl ${iconColors[color] || iconColors.emerald}`}>{icon}</div>
      <div className="flex flex-col gap-1">
        <span className="text-[13px] text-gray-700 dark:text-slate-300 font-medium leading-none">{label}:</span>
        <span className="text-2xl font-black text-gray-900 dark:text-white leading-none">{value}</span>
      </div>
    </div>
  );
}
