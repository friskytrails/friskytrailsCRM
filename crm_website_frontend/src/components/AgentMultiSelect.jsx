import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function AgentMultiSelect({ agents, selectedAgentIds = [], onChange, getAgentLeadCount, disabled = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
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

  // Update coords and reset search query when opening/closing
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const dropdownMaxHeight = 240;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const shouldOpenUpwards = spaceBelow < dropdownMaxHeight && spaceAbove > spaceBelow;

      let left = rect.left;
      const width = Math.max(rect.width, 220);
      if (left + width > window.innerWidth - 10) {
        left = Math.max(10, window.innerWidth - width - 10);
      }

      setCoords({
        left,
        top: shouldOpenUpwards ? rect.top + window.scrollY - 4 : rect.bottom + window.scrollY + 4,
        width,
        openUpwards: shouldOpenUpwards,
        maxHeight: shouldOpenUpwards
          ? Math.min(240, Math.max(160, spaceAbove - 20))
          : Math.min(240, Math.max(160, spaceBelow - 20))
      });
      // Focus search input on next frame
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 50);
    } else {
      setSearchQuery('');
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

  const selectedAgent = agents.find(a => selectedAgentIds.includes(a.id || a._id));
  const buttonText = selectedAgent 
    ? selectedAgent.name 
    : 'Select Agent';

  const eligibleAgents = agents.filter(agent => {
    const agId = agent.id || agent._id;
    const isSelected = selectedAgentIds.includes(agId);
    const isActive = (agent.status || 'Active') === 'Active' && agent.isVerified !== false;
    const isItinerary = agent.isItinerary || agent.role === 'itinerary';
    const isPresent = agent.attendance !== 'A';
    return isSelected || (isActive && !isItinerary && isPresent);
  });

  const filteredAgents = eligibleAgents.filter(agent => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return (
      (agent.name || '').toLowerCase().includes(q) ||
      (agent.email || '').toLowerCase().includes(q)
    );
  });

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="w-full flex items-center justify-between text-xs font-semibold bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded p-2 focus:outline-none focus:ring-1 focus:ring-orange-500 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        <span className="truncate">{buttonText}</span>
        <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
      </button>

      {isOpen && !disabled && coords && createPortal(
        <div 
          ref={dropdownRef}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: coords.top,
            left: coords.left,
            width: coords.width,
            transform: coords.openUpwards ? 'translateY(-100%)' : 'none',
            maxHeight: coords.maxHeight || 240,
            zIndex: 9999
          }}
          className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Search Header */}
          <div className="p-2 border-b border-gray-100 dark:border-slate-700 bg-gray-50/70 dark:bg-slate-900/50 sticky top-0 z-20">
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search agent..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setIsOpen(false);
                  }
                }}
                className="w-full text-xs bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg pl-7 pr-6 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-500 text-gray-900 dark:text-slate-100 placeholder-gray-400"
              />
              <svg className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-2 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Agents List */}
          <div className="p-1 overflow-y-auto flex-1">
            {Boolean(selectedAgent) && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange([]);
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs font-bold cursor-pointer transition-colors border-b border-gray-100 dark:border-slate-700/60 mb-1 text-left"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>Unassign Lead</span>
              </button>
            )}

            {filteredAgents.map(agent => {
              const agId = agent.id || agent._id;
              const isSelected = selectedAgentIds.includes(agId);
              const count = getAgentLeadCount ? (getAgentLeadCount(agId) ?? (agent.id ? getAgentLeadCount(agent.id) : 0)) : 0;

              return (
                <div 
                  key={agId} 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggle(agId);
                  }}
                  className="flex items-center space-x-2 px-2 py-1.5 rounded hover:bg-orange-50/60 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
                >
                  <input
                    type="radio"
                    checked={isSelected}
                    readOnly
                    className="w-3.5 h-3.5 text-orange-600 border-gray-300 rounded-full focus:ring-orange-500 dark:bg-slate-700 dark:border-slate-600 cursor-pointer pointer-events-none"
                  />
                  <span className="text-xs text-gray-700 dark:text-gray-300 font-medium truncate flex-1 select-none">
                    {agent.name} 
                    <span className="text-gray-400 font-normal ml-1">
                      ({count} {count === 1 ? 'lead' : 'leads'})
                    </span>
                  </span>
                </div>
              );
            })}

            {filteredAgents.length === 0 && (
              <div className="px-2 py-3 text-xs text-gray-400 text-center">
                {searchQuery ? 'No matching agents' : 'No agents available'}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
