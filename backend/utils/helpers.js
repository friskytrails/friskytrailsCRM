// Helper to format MongoDB document _id to id
function formatDoc(doc) {
  if (!doc) return null;
  const plainDoc = doc.toObject ? doc.toObject() : doc;
  const { _id, ...rest } = plainDoc;
  return { 
    id: rest.leadId ? rest.leadId.toString() : _id.toString(), 
    _id: _id.toString(), 
    ...rest 
  };
}

module.exports = {
  formatDoc
};
