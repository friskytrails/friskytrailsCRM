import { useState, useRef, useEffect } from 'react';

export default function AgentMultiSelect({ agents, selectedAgentIds = [], onChange, getAgentLeadCount, disabled = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleToggle = (agentId) => {
    if (selectedAgentIds.includes(agentId)) {
      onChange([]);
    } else {
      onChange([agentId]);
      setIsOpen(false);
    }
  };

  const selectedAgent = agents.find(a => selectedAgentIds.includes(a.id));
  const buttonText = selectedAgent 
    ? selectedAgent.name 
    : 'Select Agent';

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-xs font-semibold bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded p-2 focus:outline-none focus:ring-1 focus:ring-orange-500 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        <span className="truncate">{buttonText}</span>
        <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          <div className="p-1">
            {agents.map(agent => {
              const isSelected = selectedAgentIds.includes(agent.id);
              const count = getAgentLeadCount ? getAgentLeadCount(agent.id) : 0;
              const statusText = agent.status && agent.status !== 'Active' ? ` (${agent.status})` : (!agent.isVerified ? ' (Unverified)' : '');
              const isAgentDisabled = (agent.status && agent.status !== 'Active') || !agent.isVerified;

              return (
                <label 
                  key={agent.id} 
                  className={`flex items-center space-x-2 px-2 py-1.5 rounded hover:bg-gray-50 dark:hover:bg-slate-700/50 cursor-pointer ${isAgentDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <input
                    type="radio"
                    checked={isSelected}
                    disabled={isAgentDisabled}
                    onChange={() => {
                      if (!isAgentDisabled) {
                        handleToggle(agent.id);
                      }
                    }}
                    className="w-3.5 h-3.5 text-orange-600 border-gray-300 rounded-full focus:ring-orange-500 dark:bg-slate-700 dark:border-slate-600"
                  />
                  <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">
                    {agent.name}{statusText} 
                    <span className="text-gray-400 font-normal ml-1">
                      ({count} {count === 1 ? 'lead' : 'leads'})
                    </span>
                  </span>
                </label>
              );
            })}
            {agents.length === 0 && (
              <div className="px-2 py-2 text-xs text-gray-500 text-center">No agents available</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
