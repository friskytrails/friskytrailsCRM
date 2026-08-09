const mongoose = require('mongoose');
const { getBookingDB } = require('../db/bookingDb');

const paymentSubdocumentSchema = new mongoose.Schema({
  paymentId: { type: String, required: true },
  paymentDate: { type: Date, required: true, default: Date.now },
  paymentFrom: { 
    type: String, 
    enum: ['TRAVELER', 'COMPANY'], 
    default: 'TRAVELER', 
    required: true 
  },
  paymentTo: { 
    type: String, 
    enum: ['TRAVELER', 'COMPANY'], 
    default: 'COMPANY', 
    required: true 
  },
  amountPaid: { type: Number, required: true, min: 0 },
  paymentMode: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['VERIFICATION-REQUIRED', 'VERIFIED', 'REJECTED', 'PAID', 'DISAPPROVED'], 
    default: 'VERIFICATION-REQUIRED', 
    required: true 
  },
  addedBy: { type: String, required: true },
  attachment: { type: String },
  attachmentName: { type: String },
  details: { type: String },
  invoiceNumber: { type: String },
  verified: { type: Boolean, default: false }
}, { timestamps: true });

const commentSubdocumentSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  senderName: { type: String },
  message: { type: String },
  fileUrl: { type: String },
  fileName: { type: String },
  fileType: { type: String },
  timestamp: { type: Date, default: Date.now }
});

const taskSubdocumentSchema = new mongoose.Schema({
  taskName: { type: String, required: true },
  isCompleted: { type: Boolean, default: false },
  updatedBy: { type: String },
  updatedAt: { type: Date, default: Date.now }
});

const bookingSchema = new mongoose.Schema({
  bookingId: { type: String, required: true, unique: true, index: true },
  paymentId: { type: String, required: false },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  packageName: { type: String, required: true, trim: true },
  location: { type: String, required: true, trim: true },
  totalAmount: { type: Number, required: true, min: 0, default: 0 },
  paidAmount: { type: Number, required: true, min: 0, default: 0 },
  dueAmount: { type: Number, required: true, min: 0, default: 0 },
  transactionId: { type: String, required: true, trim: true, unique: true, index: true },
  screenshot: { type: String, required: false, default: '' },
  travellerName: { type: String, required: true, trim: true },
  travellerEmail: { type: String, required: true, lowercase: true, trim: true },
  travellerPhone: { type: String, required: true, trim: true },
  createdBy: { type: mongoose.Schema.Types.Mixed, required: false },
  status: {
    type: String,
    default: 'Pending'
  },
  tripStatus: {
    type: String,
    default: 'Pending'
  },
  assignedTo: [{ type: mongoose.Schema.Types.Mixed }],
  adults: { type: Number, default: 1, min: 0 },
  children: { type: Number, default: 0, min: 0 },
  comments: [commentSubdocumentSchema],
  payments: [paymentSubdocumentSchema],
  profitMargin: { type: Number, default: 0 },
  tasks: [taskSubdocumentSchema],
  feedbackRating: { type: Number, default: 5, min: 1, max: 5 },
  feedbackComment: { type: String, default: '' }
}, { timestamps: true });

// Pre-save hook to calculate paidAmount and set dueAmount
bookingSchema.pre('save', function (next) {
  let verifiedPaid = 0;
  let hasVerifiedPayments = false;

  if (Array.isArray(this.payments) && this.payments.length > 0) {
    this.payments.forEach(p => {
      if (p.status === 'VERIFIED' || p.verified === true) {
        verifiedPaid += Number(p.amountPaid) || 0;
        hasVerifiedPayments = true;
      }
    });
  }

  if (hasVerifiedPayments) {
    this.paidAmount = verifiedPaid;
  } else if (Array.isArray(this.payments) && this.payments.length > 0) {
    let unrejectedSum = 0;
    this.payments.forEach(p => {
      if (p.status !== 'REJECTED' && p.status !== 'DISAPPROVED') {
        unrejectedSum += Number(p.amountPaid) || 0;
      }
    });
    this.paidAmount = unrejectedSum > 0 ? unrejectedSum : (Number(this.paidAmount) || 0);
  } else {
    this.paidAmount = Number(this.paidAmount) || 0;
  }

  this.dueAmount = Math.max(0, (Number(this.totalAmount) || 0) - (Number(this.paidAmount) || 0));

  if (typeof next === 'function') {
    next();
  }
});

function getBookingModel() {
  const db = getBookingDB();
  if (db && db.readyState === 1) {
    if (!db.models['Booking']) {
      db.model('Booking', bookingSchema);
    }
    return db.models['Booking'];
  }
  if (!mongoose.models['Booking']) {
    mongoose.model('Booking', bookingSchema);
  }
  return mongoose.models['Booking'];
}

const BookingProxy = new Proxy(function() {}, {
  get(target, prop) {
    const model = getBookingModel();
    const val = model[prop];
    return typeof val === 'function' ? val.bind(model) : val;
  },
  construct(target, args) {
    const Model = getBookingModel();
    return new Model(...args);
  }
});

module.exports = BookingProxy;
