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
  createdAt: {
    type: Date,
    default: Date.now
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
    return User.findOne({ email: email.toLowerCase() });
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
