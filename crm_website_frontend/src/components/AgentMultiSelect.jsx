import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function AgentMultiSelect({ agents, selectedAgentIds = [], onChange, getAgentLeadCount, disabled = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);
  const [coords, setCoords] = useState(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        (dropdownRef.current && dropdownRef.current.contains(event.target)) ||
        (buttonRef.current && buttonRef.current.contains(event.target))
      ) {
        return;
      }
      setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Update coords when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setCoords({
        left: rect.left,
        top: rect.bottom + window.scrollY,
        width: rect.width
      });
    }
  }, [isOpen]);

  // Close on scroll or resize to prevent detached floating
  useEffect(() => {
    function handleScrollOrResize(e) {
      // Don't close if scrolling inside the dropdown itself
      if (dropdownRef.current && dropdownRef.current.contains(e.target)) return;
      if (isOpen) setIsOpen(false);
    }
    if (isOpen) {
      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);
    }
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen]);

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
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-xs font-semibold bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded p-2 focus:outline-none focus:ring-1 focus:ring-orange-500 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        <span className="truncate">{buttonText}</span>
        <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
      </button>

      {isOpen && !disabled && coords && createPortal(
        <div 
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: coords.top + 4,
            left: coords.left,
            width: coords.width,
            zIndex: 9999
          }}
          className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg shadow-xl max-h-48 overflow-y-auto"
        >
          <div className="p-1">
            {agents
              .filter(agent => {
                const isActive = (agent.status || 'Active') === 'Active' && agent.isVerified !== false;
                const isItinerary = agent.isItinerary || agent.role === 'itinerary';
                const isPresent = agent.attendance !== 'A';
                return isActive && !isItinerary && isPresent;
              })
              .map(agent => {
                const isSelected = selectedAgentIds.includes(agent.id);
                const count = getAgentLeadCount ? getAgentLeadCount(agent.id) : 0;

                return (
                  <label 
                    key={agent.id} 
                    className="flex items-center space-x-2 px-2 py-1.5 rounded hover:bg-gray-50 dark:hover:bg-slate-700/50 cursor-pointer"
                  >
                    <input
                      type="radio"
                      checked={isSelected}
                      onClick={() => handleToggle(agent.id)}
                      readOnly
                      className="w-3.5 h-3.5 text-orange-600 border-gray-300 rounded-full focus:ring-orange-500 dark:bg-slate-700 dark:border-slate-600 cursor-pointer"
                    />
                    <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">
                      {agent.name} 
                      <span className="text-gray-400 font-normal ml-1">
                        ({count} {count === 1 ? 'lead' : 'leads'})
                      </span>
                    </span>
                  </label>
                );
              })}
            {agents.filter(agent => {
              const isActive = (agent.status || 'Active') === 'Active' && agent.isVerified !== false;
              const isItinerary = agent.isItinerary || agent.role === 'itinerary';
              const isPresent = agent.attendance !== 'A';
              return isActive && !isItinerary && isPresent;
            }).length === 0 && (
              <div className="px-2 py-2 text-xs text-gray-500 text-center">No agents available</div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
