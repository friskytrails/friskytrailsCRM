const mongoose = require('mongoose');

const NoteSchema = new mongoose.Schema({
  id: {
    type: String,
    required: false
  },
  text: {
    type: String,
    required: false,
    default: ''
  },
  timestamp: {
    type: String,
    required: false,
    default: () => new Date().toISOString()
  },
  author: {
    type: String,
    required: false,
    default: 'System'
  },
  authorId: {
    type: String,
    required: false
  },
  imageUrl: {
    type: String,
    required: false
  }
});

const CallLogSchema = new mongoose.Schema({
  date: {
    type: String, // Format: YYYY-MM-DD
    required: true
  },
  dailyDial: {
    type: Number,
    default: 0
  },
  dailyTalkTime: {
    type: String,
    default: '0:0'
  }
});

const LeadSchema = new mongoose.Schema({
  leadId: {
    type: Number,
    unique: true,
    sparse: true
  },
  name: {
    type: String,
    required: false,
    default: ''
  },
  phone: {
    type: String,
    required: true,
    unique: true
  },
  age: {
    type: Number,
    required: false
  },
  origin: {
    type: String,
    required: false,
    default: ''
  },
  destination: {
    type: String,
    required: false,
    default: ''
  },
  leadSource: {
    type: String,
    required: false,
    default: ''
  },
  mailId: {
    type: String,
    required: false,
    unique: true,
    sparse: true
  },
  product: {
    type: String,
    required: false,
    default: ''
  },
  travelDate: {
    type: String,
    required: false,
    default: ''
  },
  numberOfPersons: {
    type: Number,
    required: false,
    default: null
  },
  agentIds: {
    type: [String],
    default: []
  },
  labels: {
    type: [String],
    default: []
  },
  dates: {
    startDate: { type: Date, default: null },
    dueDate: { type: Date, default: null },
    reminderDate: { type: Date, default: null }
  },
  notes: {
    type: [NoteSchema],
    default: []
  },
  createdBy: {
    name: { type: String, default: '' },
    email: { type: String, default: '' }
  },
  status: {
    type: String,
    default: 'Fresh Leads'
  },
  booking: {
    totalDial: { type: Number, default: 0 },
    dailyDial: { type: Number, default: 0 },
    connected: { type: Number, default: 0 },
    talkTime: { type: String, default: '0:0' },
    dailyTalkTime: { type: String, default: '0:0' },
    firstCall: { type: Date, default: null },
    lastCall: { type: Date, default: null }
  },
  callLogs: {
    type: [CallLogSchema],
    default: []
  },
  trips: {
    type: [mongoose.Schema.Types.Mixed],
    default: []
  }
}, { timestamps: true });

// Performance indexes for query acceleration and instant sorting
LeadSchema.index({ agentIds: 1 });
LeadSchema.index({ status: 1 });
LeadSchema.index({ createdAt: -1 });
LeadSchema.index({ agentIds: 1, status: 1 });
LeadSchema.index({ agentIds: 1, createdAt: -1 });
LeadSchema.index({ status: 1, createdAt: -1 });
LeadSchema.index({ agentIds: 1, status: 1, createdAt: -1 });

const Lead = mongoose.model('Lead', LeadSchema);

module.exports = {
  Schema: LeadSchema,
  Model: Lead,
  // Helper queries to retain service compatibility
  findAll: async () => {
    return Lead.find({});
  },
  findById: async (id) => {
    const strId = id?.toString?.() || id;
    if (mongoose.Types.ObjectId.isValid(strId) && typeof strId === 'string' && strId.length === 24) {
      return Lead.findById(strId);
    }
    const numId = Number(strId);
    if (!isNaN(numId)) {
      return Lead.findOne({ leadId: numId });
    }
    return null;
  },
  insertLead: async (leadData) => {
    // Find the lead with the highest leadId
    const lastLead = await Lead.findOne({}, { leadId: 1 }).sort({ leadId: -1 });
    const nextId = lastLead && lastLead.leadId ? lastLead.leadId + 1 : 1;
    
    const lead = new Lead({
      ...leadData,
      leadId: nextId
    });
    await lead.save();
    return { insertedId: lead._id };
  },
  updateLead: async (id, data, agentIdCondition = undefined) => {
    let query = {};
    if (mongoose.Types.ObjectId.isValid(id) && typeof id === 'string' && id.length === 24) {
      query = { _id: id };
    } else {
      const numId = Number(id);
      if (!isNaN(numId)) {
        query = { leadId: numId };
      } else {
        return null;
      }
    }
    if (agentIdCondition !== undefined) {
      if (Array.isArray(agentIdCondition)) {
        query.agentIds = { $in: agentIdCondition };
      } else {
        query.agentIds = agentIdCondition;
      }
    }
    const updateDoc = { ...data };
    const pushDoc = updateDoc.$push;
    delete updateDoc.$push;
    const unsetDoc = updateDoc.$unset;
    delete updateDoc.$unset;
    const finalUpdate = {};
    if (Object.keys(updateDoc).length > 0) {
      finalUpdate.$set = updateDoc;
    }
    if (pushDoc) {
      finalUpdate.$push = pushDoc;
    }
    if (unsetDoc) {
      finalUpdate.$unset = unsetDoc;
    }

    return Lead.findOneAndUpdate(
      query,
      finalUpdate,
      { new: true }
    );
  },
  pushNote: async (id, note, agentIdCondition = undefined) => {
    let query = {};
    if (mongoose.Types.ObjectId.isValid(id) && typeof id === 'string' && id.length === 24) {
      query = { _id: id };
    } else {
      const numId = Number(id);
      if (!isNaN(numId)) {
        query = { leadId: numId };
      } else {
        return null;
      }
    }
    if (agentIdCondition !== undefined) {
      if (Array.isArray(agentIdCondition)) {
        query.agentIds = { $in: agentIdCondition };
      } else {
        query.agentIds = agentIdCondition;
      }
    }
    return Lead.findOneAndUpdate(
      query,
      { $push: { notes: note } },
      { new: true }
    );
  },
  deleteNote: async (id, noteId, agentIdCondition = undefined) => {
    let query = {};
    if (mongoose.Types.ObjectId.isValid(id) && typeof id === 'string' && id.length === 24) {
      query = { _id: id };
    } else {
      const numId = Number(id);
      if (!isNaN(numId)) {
        query = { leadId: numId };
      } else {
        return null;
      }
    }
    if (agentIdCondition !== undefined) {
      if (Array.isArray(agentIdCondition)) {
        query.agentIds = { $in: agentIdCondition };
      } else {
        query.agentIds = agentIdCondition;
      }
    }

    let noteObjectId;
    try {
      noteObjectId = new mongoose.Types.ObjectId(noteId);
    } catch(e) {
      noteObjectId = noteId;
    }

    return Lead.findOneAndUpdate(
      query,
      { $pull: { notes: { $or: [{ id: noteId }, { _id: noteObjectId }] } } },
      { new: true }
    );
  }
};
