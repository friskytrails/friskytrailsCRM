const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Former Employee'],
    default: 'Active'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  monthlyTarget: {
    type: Number,
    default: 0,
    min: 0
  },
  targetCompleted: {
    type: Number,
    default: 0,
    min: 0
  },
  attendance: {
    type: String,
    enum: ['P', 'A', ''],
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  verificationOtp: {
    type: String,
    required: false,
    select: false
  },
  otpExpiresAt: {
    type: Date,
    required: false,
    select: false
  },
  otpAttempts: {
    type: Number,
    default: 0,
    select: false
  },
  resetPasswordOtp: {
    type: String,
    required: false,
    select: false
  },
  resetPasswordExpiresAt: {
    type: Date,
    required: false,
    select: false
  },
  resetPasswordAttempts: {
    type: Number,
    default: 0,
    select: false
  }
});

const User = mongoose.model('User', UserSchema);

module.exports = {
  Schema: UserSchema,
  Model: User,
  // Helper queries to retain service compatibility
  findById: async (id) => {
    return User.findById(id);
  },
  findByEmail: async (email) => {
    return User.findOne({ email: email.toLowerCase() }).select('+verificationOtp +otpExpiresAt +otpAttempts +resetPasswordOtp +resetPasswordExpiresAt +resetPasswordAttempts');
  },
  insertUser: async (userData) => {
    const user = new User(userData);
    await user.save();
    return { insertedId: user._id };
  },
  findAgents: async () => {
    return User.find({ isAdmin: false });
  }
};
