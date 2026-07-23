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

export default function NoteItem({ note, leadId, deleteNote, currentUser }) {
  const [imgError, setImgError] = React.useState(false);

  React.useEffect(() => {
    setImgError(false);
  }, [note.imageUrl]);

  const isMyNote = note.authorId ? note.authorId === currentUser?.id : note.author === currentUser?.name;
  const [imgError, setImgError] = useState(false);

  return (
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
        {note.imageUrl && (() => {
          const isDoc = note.imageUrl.match(/\.(pdf|doc|docx)$/i) || note.imageUrl.includes('/raw/upload/');
          const fileName = decodeURIComponent(note.imageUrl.split('/').pop() || 'file');
          return (
            <div className="mt-1.5 rounded overflow-hidden max-w-[240px] border border-gray-200/50 dark:border-slate-800 inline-block">
              {isDoc ? (
                <a
                  href={note.imageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 bg-gray-100 dark:bg-slate-800 text-sm font-semibold flex items-center cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors gap-2 block"
                  title="Click to view/download"
                >
                  <span className="text-base">📄</span>
                  <span className="truncate max-w-[180px]">{fileName}</span>
                </a>
              ) : imgError ? (
                <a
                  href={note.imageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 bg-gray-100 dark:bg-slate-800 text-xs font-semibold flex items-center cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors gap-1.5 block"
                >
                  <span>🖼️</span> View Image ({fileName})
                </a>
              ) : (
                <a
                  href={note.imageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block cursor-pointer"
                >
                  <img
                    src={note.imageUrl}
                    alt="Attachment preview"
                    className="w-full h-auto max-h-[140px] object-cover hover:opacity-95 transition-opacity rounded"
                    onError={() => setImgError(true)}
                  />
                </a>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
