function getISTDateString(d = new Date()) {
  const nowIST = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const year = nowIST.getFullYear();
  const month = String(nowIST.getMonth() + 1).padStart(2, '0');
  const day = String(nowIST.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

  return { 
    id: rest.leadId ? rest.leadId.toString() : _id.toString(), 
    _id: _id.toString(), 
    ...rest 
  };
}

module.exports = {
  formatDoc
};
