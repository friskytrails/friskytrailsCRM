

export default function AgentsList({ agents = [], leads = [], updateAgentStatus }) {
  // Precompute a map of agentId -> count
  const agentLeadCounts = leads.reduce((acc, lead) => {
    if (lead.agentId) {
      acc[lead.agentId] = (acc[lead.agentId] || 0) + 1;
    }
    return acc;
  }, {});

  const handleStatusChange = (agentId, newStatus) => {
    if (updateAgentStatus) {
      updateAgentStatus(agentId, newStatus);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="bg-white dark:bg-slate-800 shadow-xl rounded-xl p-6 border border-gray-100 dark:border-slate-700">
        <div className="border-b border-gray-100 dark:border-slate-700 pb-4 mb-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Current Agents ({agents.length})</h3>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
            Overview of the travel agents in your CRM, their current lead loads, and account status.
          </p>
        </div>

        {agents.length === 0 ? (
          <p className="text-sm text-gray-400 italic text-center py-8">No agents registered in the system yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {agents.map((agent) => {
              const count = agentLeadCounts[agent.id] || 0;
              const status = agent.status || 'Active';

              const statusColors = {
                'Active': 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-400',
                'Inactive': 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400',
                'Former Employee': 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-slate-700 dark:text-slate-300'
              };

              return (
                <div key={agent.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50/60 dark:bg-slate-900/40 hover:bg-gray-50 dark:hover:bg-slate-900/60 transition-colors rounded-xl border border-gray-100 dark:border-slate-800 gap-4">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold text-sm border border-orange-200/50 dark:border-orange-900/50 shrink-0">
                      {(agent.name || '').split(' ').map(n => n?.[0] || '').join('')}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                        {agent.name}
                        {status !== 'Active' && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${statusColors[status] || statusColors['Inactive']}`}>
                            {status}
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] text-gray-400 dark:text-slate-500 font-mono mt-0.5">{agent.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4 sm:ml-auto">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${count > 0 ? 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400' : 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                      {count} {count === 1 ? 'Lead' : 'Leads'}
                    </span>

                    <div className="flex items-center space-x-2 border-l pl-4 border-gray-200 dark:border-slate-700">
                      <span className="text-[10px] uppercase font-bold text-gray-400">Status:</span>
                      <select
                        value={status}
                        onChange={(e) => handleStatusChange(agent.id, e.target.value)}
                        className="text-xs font-semibold bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                        <option value="Former Employee">Former Employee</option>
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
