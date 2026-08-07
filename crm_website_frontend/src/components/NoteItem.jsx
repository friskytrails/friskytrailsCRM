import React, { useState } from 'react';

const getNoteDisplayDate = (note) => {
  if (!note || !note.timestamp) return 'Unknown time';
  if (note.timestamp.includes(',')) return note.timestamp;
  const idStr = note.id || note._id;
  if (idStr && idStr.length === 24) {
    try {
      const timestamp = parseInt(idStr.substring(0, 8), 16) * 1000;
      if (!isNaN(timestamp)) {
        const date = new Date(timestamp);
        const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        const timeStr = note.timestamp.trim();
        return `${dateStr}, ${timeStr}`;
      }
    } catch {
      // ignore
    }
  }
  return note.timestamp;
};

const getSecureUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://')) {
    return url.replace('http://', 'https://');
  }
  return url;
};

export default function NoteItem({ note, leadId, deleteNote, currentUser }) {
  const [imgError, setImgError] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  React.useEffect(() => {
    setImgError(false);
  }, [note.imageUrl]);

  const isMyNote = note.authorId ? note.authorId === currentUser?.id : note.author === currentUser?.name;
  const rawUrl = note.imageUrl || '';
  const secureUrl = getSecureUrl(rawUrl);

  const isPdf = secureUrl.match(/\.pdf$/i) || (secureUrl.includes('/raw/upload/') && secureUrl.toLowerCase().includes('.pdf'));
  const isOfficeDoc = secureUrl.match(/\.(doc|docx|xls|xlsx|ppt|pptx)$/i);
  const isDoc = isPdf || isOfficeDoc || secureUrl.includes('/raw/upload/');
  const fileName = decodeURIComponent(rawUrl.split('/').pop() || 'attachment');

  const getViewerUrl = (url) => {
    if (isOfficeDoc) {
      return `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
    }
    return url;
  };

  const handleOpenExternal = (e) => {
    e.stopPropagation();
    const externalUrl = isOfficeDoc 
      ? `https://docs.google.com/gview?url=${encodeURIComponent(secureUrl)}`
      : secureUrl;
    window.open(externalUrl, '_blank', 'noopener,noreferrer');
  };

  const handleDownload = async (e) => {
    e.stopPropagation();
    try {
      const response = await fetch(secureUrl);
      if (!response.ok) {
        throw new Error(`Download failed with status ${response.status}`);
      }
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName || 'attachment';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Download error:', err);
      const link = document.createElement('a');
      link.href = secureUrl;
      link.download = fileName || 'attachment';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  React.useEffect(() => {
    if (!isPreviewOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsPreviewOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPreviewOpen]);

  const handleKeyDownTrigger = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsPreviewOpen(true);
    }
  };

  return (
    <>
      <div className={`flex items-start space-x-3 ${isMyNote ? '' : ''}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isMyNote ? 'bg-blue-100 dark:bg-orange-950' : 'bg-gray-100 dark:bg-slate-800'}`}>
          <span className={`text-xs font-bold ${isMyNote ? 'text-blue-600 dark:text-orange-400' : 'text-gray-500 dark:text-slate-400'}`}>
            {note.author?.charAt(0)?.toUpperCase() || '?'}
          </span>
        </div>
        <div className={`flex-1 p-3 rounded-lg border text-sm ${isMyNote ? 'bg-blue-50/60 border-blue-100/60 dark:bg-orange-950/40 dark:border-orange-900/50' : 'bg-gray-50 border-gray-100 dark:bg-slate-800/50 dark:border-slate-700/50'}`}>
          <div className="flex justify-between items-center mb-1">
            <span className={`text-xs font-semibold ${isMyNote ? 'text-blue-600 dark:text-orange-400' : 'text-gray-500 dark:text-slate-400'}`}>
              {note.author} {isMyNote && '(You)'}
            </span>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] text-gray-400">{getNoteDisplayDate(note)}</span>
              {(isMyNote || currentUser?.isAdmin) && deleteNote && (
                <button
                  onClick={() => deleteNote(leadId, note.id || note._id)}
                  className="text-red-400 hover:text-red-600 cursor-pointer p-0.5 rounded transition-colors"
                  title="Delete note"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              )}
            </div>
          </div>
          {note.text && <p className="text-gray-700 dark:text-slate-200 mt-0.5 whitespace-pre-wrap break-words">{note.text}</p>}
          
          {secureUrl && (
            <div className="mt-2 inline-block">
              {isDoc ? (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setIsPreviewOpen(true)}
                  onKeyDown={handleKeyDownTrigger}
                  className="p-3 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-sm font-semibold flex items-center cursor-pointer transition-colors gap-2 rounded-lg border border-gray-200 dark:border-slate-700 max-w-[260px] shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  title="Click to preview file"
                >
                  <span className="text-lg">📄</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-bold text-gray-800 dark:text-slate-200">{fileName}</div>
                    <div className="text-[10px] text-orange-600 dark:text-orange-400 font-medium">Click to preview</div>
                  </div>
                </div>
              ) : imgError ? (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setIsPreviewOpen(true)}
                  onKeyDown={handleKeyDownTrigger}
                  className="p-3 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-xs font-semibold flex items-center cursor-pointer transition-colors gap-2 rounded-lg border border-gray-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <span>🖼️</span>
                  <span className="text-orange-600 dark:text-orange-400 font-bold">View Image Attachment</span>
                </div>
              ) : (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setIsPreviewOpen(true)}
                  onKeyDown={handleKeyDownTrigger}
                  className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-slate-700 max-w-[240px] cursor-pointer group shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  title="Click to preview image"
                >
                  <img
                    src={secureUrl}
                    alt="Attachment preview"
                    className="w-full h-auto max-h-[140px] object-cover group-hover:scale-105 transition-transform duration-200"
                    onError={() => setImgError(true)}
                  />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1">
                    <span>🔍</span> Preview
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Interactive Modal File Preview */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl transition-colors">
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-gray-50 dark:bg-slate-800 border-b border-gray-150 dark:border-slate-700 flex items-center justify-between transition-colors">
              <div className="flex items-center space-x-2 min-w-0 pr-4">
                <span className="text-lg">{isDoc ? '📄' : '🖼️'}</span>
                <span className="text-sm font-bold text-gray-900 dark:text-white truncate">{fileName}</span>
              </div>
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                  title="Download file"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Download</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenExternal}
                  className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                  title="Open file in new tab"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  <span>Open External</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(false)}
                  className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                  title="Close preview"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 p-4 bg-gray-100 dark:bg-slate-950 flex items-center justify-center overflow-auto min-h-[400px] transition-colors">
              {isDoc ? (
                <iframe
                  src={getViewerUrl(secureUrl)}
                  className="w-full h-[70vh] rounded-xl border-0 bg-white"
                  title="File Preview"
                />
              ) : (
                <img
                  src={secureUrl}
                  alt="Full preview"
                  className="max-h-[75vh] max-w-full object-contain rounded-xl shadow-lg"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
