import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function Navbar({ darkMode, setDarkMode, user, handleLogout }) {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const getLinkClass = (path, isMobile = false) => {
    const baseClass = isMobile
      ? "text-sm font-semibold block px-4 py-2.5 rounded-xl transition-all duration-200"
      : "text-sm font-semibold px-3.5 py-2 rounded-xl transition-all duration-200 flex items-center";

    return location.pathname === path
      ? `${baseClass} bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400 shadow-sm`
      : `${baseClass} text-gray-600 dark:text-slate-300 hover:bg-gray-50/80 dark:hover:bg-slate-800/40 hover:text-orange-600 dark:hover:text-orange-400`;
  };

  return (
    <nav className="bg-white/80 dark:bg-slate-900/85 backdrop-blur-lg sticky top-0 z-50 border-b border-gray-100 dark:border-slate-800/80 transition-all shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            {/* Brand/Logo */}
            <div className="flex-shrink-0 flex items-center">
              <Link to="/" className="text-xl sm:text-2xl font-extrabold text-orange-600 dark:text-orange-500 tracking-tight flex items-center space-x-3 hover:opacity-90 transition-opacity">
                <img src="/logo.webp" alt="FriskyTrails Logo" className="h-14 sm:h-16 w-auto dark:invert transition-transform duration-300 hover:rotate-6" />
                <span className="hidden xs:inline">FriskyTrails CRM</span>
              </Link>
            </div>

            {/* Desktop Navigation Links */}
            {user && (
              <div className="hidden lg:flex ml-8 space-x-1.5 items-center">
                <Link to="/" className={getLinkClass('/')}>
                  Dashboard
                </Link>

                <Link to="/add-lead" className={getLinkClass('/add-lead')}>
                  Add Lead
                </Link>
                
                {user.isAdmin && (
                  <Link to="/agents" className={getLinkClass('/agents')}>
                    Agents
                  </Link>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-3">
            {/* Dark Mode Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2.5 rounded-xl text-gray-500 hover:bg-gray-50 dark:text-slate-400 dark:hover:bg-slate-800 border border-gray-100 dark:border-slate-800 transition-all cursor-pointer shadow-sm"
              aria-label="Toggle dark mode"
            >
              {darkMode ? (
                <svg style={{ width: '18px', height: '18px', display: 'block', stroke: '#fbbf24' }} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3v1m0 16v1m9-9h-1M4 9H3m15.364-3.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M14 12a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              ) : (
                <svg style={{ width: '18px', height: '18px', display: 'block', stroke: '#4b5563' }} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            {/* Desktop User Profile / Logout */}
            {user ? (
              <div className="hidden lg:flex items-center space-x-3 bg-gray-50/50 dark:bg-slate-800/30 p-1.5 pl-2.5 pr-2.5 rounded-2xl border border-gray-100/50 dark:border-slate-800/65">
                <div className="flex flex-col items-end">
                  <span className="text-xs font-bold text-gray-800 dark:text-slate-200">
                    {user.name}
                  </span>
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-orange-600 dark:text-orange-500">
                    {user.isAdmin ? 'Admin' : 'Agent'}
                  </span>
                </div>
                <Link to="/profile" className="inline-flex items-center justify-center h-8 w-8 rounded-xl bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400 font-bold border border-orange-200/50 dark:border-orange-900/50 shadow-sm text-sm hover:ring-2 hover:ring-orange-500 transition-all cursor-pointer">
                  {user.name.split(' ').map(n => n[0]).join('')}
                </Link>
                <div className="h-4 w-[1px] bg-gray-200 dark:bg-slate-700"></div>
                <button
                  onClick={handleLogout}
                  className="text-xs bg-red-50 hover:bg-red-100 text-red-600 font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-950/40 shadow-sm border border-red-100/30 dark:border-red-950/30"
                >
                  Logout
                </button>
              </div>
            ) : (
              <span className="hidden lg:inline text-xs font-extrabold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                CRM Portal
              </span>
            )}

            {/* Mobile Menu Toggle (Hamburger) */}
            {user && (
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="lg:hidden p-2.5 rounded-xl text-gray-500 hover:bg-gray-50 dark:text-slate-400 dark:hover:bg-slate-800 border border-gray-100 dark:border-slate-800 transition-all cursor-pointer shadow-sm"
                aria-label="Toggle Navigation Menu"
              >
                {isOpen ? (
                  <svg className="w-5 h-5 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                ) : (
                  <svg className="w-5 h-5 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="3" y1="12" x2="21" y2="12"></line>
                    <line x1="3" y1="6" x2="21" y2="6"></line>
                    <line x1="3" y1="18" x2="21" y2="18"></line>
                  </svg>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Collapsible Navigation Menu */}
      {user && isOpen && (
        <div className="lg:hidden bg-white/95 dark:bg-slate-900/95 border-t border-gray-100 dark:border-slate-800/80 backdrop-blur-lg">
          <div className="px-4 pt-2.5 pb-4 space-y-1.5 shadow-inner">
            <Link to="/" onClick={() => setIsOpen(false)} className={getLinkClass('/', true)}>
              Dashboard
            </Link>

            <Link to="/add-lead" onClick={() => setIsOpen(false)} className={getLinkClass('/add-lead', true)}>
              Add Lead
            </Link>

            {user.isAdmin && (
              <Link to="/agents" onClick={() => setIsOpen(false)} className={getLinkClass('/agents', true)}>
                Agents
              </Link>
            )}

            {/* User Profile and Logout section in mobile menu */}
            <div className="pt-4 mt-3 border-t border-gray-100 dark:border-slate-800 flex flex-col gap-3">
              <Link to="/profile" onClick={() => setIsOpen(false)} className="flex items-center space-x-3 px-2 group">
                <span className="inline-flex items-center justify-center h-9 w-9 rounded-xl bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400 font-bold border border-orange-200/50 dark:border-orange-900/50 shadow-sm text-sm group-hover:ring-2 group-hover:ring-orange-500 transition-all cursor-pointer">
                  {user.name.split(' ').map(n => n[0]).join('')}
                </span>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-gray-800 dark:text-slate-200">
                    {user.name}
                  </span>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-orange-600 dark:text-orange-500">
                    {user.isAdmin ? 'Admin' : 'Agent'}
                  </span>
                </div>
              </Link>
              <button
                onClick={() => {
                  setIsOpen(false);
                  handleLogout();
                }}
                className="w-full text-center text-sm bg-red-50 hover:bg-red-100 text-red-600 font-bold py-2.5 rounded-xl transition-all cursor-pointer dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-950/40 shadow-sm border border-red-100/30 dark:border-red-950/30"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
