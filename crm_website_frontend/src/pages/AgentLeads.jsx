import React from 'react';
import { useParams, Link } from 'react-router-dom';

export default function AgentLeads({ leads, agents }) {
  const { id } = useParams();
  const agent = agents.find(a => a.id === id);
  
  if (!agent) {
    return <div className="p-8 text-center text-gray-500">Agent not found</div>;
  }
  
  const agentLeads = leads.filter(lead => (lead.agentIds || []).includes(id));
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold text-2xl border border-orange-200 dark:border-orange-800/50">
            {(agent.name || '').split(' ').map(n => n?.[0] || '').join('')}
          </div>
          <div>
            <h1 className="text-3xl font-black text-gray-900 dark:text-white">
              {agent.name}'s Leads
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {agentLeads.length} {agentLeads.length === 1 ? 'Lead' : 'Leads'} Assigned
            </p>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agentLeads.length === 0 ? (
          <div className="col-span-full py-12 text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-gray-300 dark:border-slate-600">
            No leads assigned to this agent yet.
          </div>
        ) : (
          agentLeads.map(lead => (
            <Link key={lead.id} to={`/leads/${lead.id}`} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-5 hover:shadow-md transition-shadow group">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                  {lead.name || 'Unnamed Lead'}
                </h3>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-300">
                  {lead.status || 'Fresh Leads'}
                </span>
              </div>
              
              <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                <p className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                  {lead.phone || 'N/A'}
                </p>
                
                <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-slate-700 mt-2">
                  <div className="flex-1">
                    <span className="block text-[10px] uppercase text-gray-400">Origin</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">{lead.origin || '—'}</span>
                  </div>
                  <div className="text-orange-500">➔</div>
                  <div className="flex-1 text-right">
                    <span className="block text-[10px] uppercase text-gray-400">Dest</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">{lead.destination || '—'}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
