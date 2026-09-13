const mongoose = require('mongoose');

function getISTDateString(d = new Date()) {
  const nowIST = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const year = nowIST.getFullYear();
  const month = String(nowIST.getMonth() + 1).padStart(2, '0');
  const day = String(nowIST.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseTimeToSeconds(str) {
  if (!str || typeof str !== 'string') return 0;
  const parts = str.trim().split(':').map(val => parseInt(val, 10));
  if (parts.some(isNaN)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return 0;
}

function formatSecondsToTime(totalSec) {
  if (!totalSec || isNaN(totalSec) || totalSec <= 0) return '0:00';
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
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
  const todayDate = getISTDateString();
  let lastCallDate = null;
  if (rest.booking) {
    lastCallDate = rest.booking.lastCall
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

  // Deduplicate, sanitize, and disaggregate cumulative callLogs by date if present
  if (Array.isArray(rest.callLogs) && rest.callLogs.length > 0) {
    const logMap = new Map();
    for (const log of rest.callLogs) {
      if (log && log.date) {
        const existing = logMap.get(log.date);
        if (!existing || (log.dailyDial || 0) > (existing.dailyDial || 0)) {
          logMap.set(log.date, {
            date: log.date,
            dailyDial: log.dailyDial || 0,
            dailyTalkTime: log.dailyTalkTime || '0:0'
          });
        }
      }
    }
    const deduped = Array.from(logMap.values()).sort((a, b) => (a.date > b.date ? 1 : -1));

    // Compound cumulative signal check for dial counts and talk time
    const totalDial = rest.booking?.totalDial || 0;
    const lastEntry = deduped[deduped.length - 1];
    const isDialNonDecreasing = deduped.every(
      (log, i) => i === 0 || (log.dailyDial || 0) >= (deduped[i - 1].dailyDial || 0)
    );
    const isDialCumulative =
      deduped.length > 1 &&
      isDialNonDecreasing &&
      totalDial > 0 &&
      (lastEntry?.dailyDial || 0) === totalDial;

    const totalTalkSec = parseTimeToSeconds(rest.booking?.talkTime);
    const lastTalkSec = parseTimeToSeconds(lastEntry?.dailyTalkTime);
    const isTalkNonDecreasing = deduped.every(
      (log, i) => i === 0 || parseTimeToSeconds(log.dailyTalkTime) >= parseTimeToSeconds(deduped[i - 1].dailyTalkTime)
    );
    const isTalkCumulative =
      isDialCumulative ||
      (deduped.length > 1 && isTalkNonDecreasing && totalTalkSec > 0 && lastTalkSec === totalTalkSec);

    // Disaggregate cumulative dials and talk times to per-day delta values
    const corrected = deduped.map((log, i) => {
      let dailyDial = log.dailyDial || 0;
      if (isDialCumulative) {
        const prevCumulative = i === 0 ? 0 : (deduped[i - 1].dailyDial || 0);
        dailyDial = Math.max(0, dailyDial - prevCumulative);
      }

      let dailyTalkTime = log.dailyTalkTime || '0:0';
      if (isTalkCumulative) {
        const prevTalkSec = i === 0 ? 0 : parseTimeToSeconds(deduped[i - 1].dailyTalkTime);
        const currTalkSec = parseTimeToSeconds(log.dailyTalkTime);
        const deltaTalkSec = Math.max(0, currTalkSec - prevTalkSec);
        dailyTalkTime = formatSecondsToTime(deltaTalkSec);
      }

      return { ...log, dailyDial, dailyTalkTime };
    });

    rest.callLogs = corrected;

    // If last call was today, synchronize booking.dailyDial and booking.dailyTalkTime to today's disaggregated log
    if (rest.booking && lastCallDate === todayDate) {
      const todayLog = corrected.find(log => log.date === todayDate);
      if (todayLog) {
        rest.booking = {
          ...rest.booking,
          dailyDial: todayLog.dailyDial,
          dailyTalkTime: todayLog.dailyTalkTime
        };
      }
    }
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
  isStrictObjectId,
  parseTimeToSeconds,
  formatSecondsToTime
};
