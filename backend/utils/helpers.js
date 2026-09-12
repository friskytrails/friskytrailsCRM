const mongoose = require('mongoose');

function getISTDateString(d = new Date()) {
  const nowIST = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const year = nowIST.getFullYear();
  const month = String(nowIST.getMonth() + 1).padStart(2, '0');
  const day = String(nowIST.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Strict validation for MongoDB ObjectId (instance or 24-char hex string)
function isStrictObjectId(val) {
  if (!val) return false;
  if (val instanceof mongoose.Types.ObjectId) return true;
  if (typeof val === 'string') {
    return /^[0-9a-fA-F]{24}$/.test(val.trim());
  }
  if (typeof val === 'object' && typeof val.toString === 'function') {
    const str = val.toString();
    return typeof str === 'string' && /^[0-9a-fA-F]{24}$/.test(str);
  }
  return false;
}

// Helper to format MongoDB document _id to id
function formatDoc(doc) {
  if (!doc) return null;
  const plainDoc = doc.toObject ? doc.toObject() : doc;
  const { _id, ...rest } = plainDoc;
  
  // Lazy Reset pattern for attendance
  if (rest.attendance) {
    const todayStr = getISTDateString();
    if (rest.attendanceDate !== todayStr) {
      rest.attendance = '';
    }
  }

  // Lazy Reset pattern for daily call metrics (booking.dailyDial, booking.dailyTalkTime)
  // If the last recorded call was NOT today (IST), zero out daily counters in the API response.
  // This acts as a safety net so the frontend always sees correct values even when the
  // Atlas Trigger (midnight reset) hasn't fired yet or is unavailable in local dev.
  // NOTE: The DB document itself is NOT mutated — only the response payload is corrected.
  if (rest.booking) {
    const todayDate = getISTDateString();
    const lastCallDate = rest.booking.lastCall
      ? getISTDateString(new Date(rest.booking.lastCall))
      : null;

    if (!lastCallDate || lastCallDate !== todayDate) {
      rest.booking = {
        ...rest.booking,
        dailyDial: 0,
        dailyTalkTime: '0:0',
      };
    }
  }

  // Deduplicate and sanitize callLogs by date if present
  if (Array.isArray(rest.callLogs) && rest.callLogs.length > 0) {
    const logMap = new Map();
    for (const log of rest.callLogs) {
      if (log && log.date) {
        const existing = logMap.get(log.date);
        if (!existing || (log.dailyDial || 0) > (existing.dailyDial || 0)) {
          logMap.set(log.date, log);
        }
      }
    }
    rest.callLogs = Array.from(logMap.values());
  }

  const idStr = _id ? _id.toString() : '';
  return { 
    id: rest.leadId !== undefined && rest.leadId !== null ? rest.leadId.toString() : idStr, 
    _id: idStr, 
    ...rest 
  };
}

module.exports = {
  formatDoc,
  isStrictObjectId
};
