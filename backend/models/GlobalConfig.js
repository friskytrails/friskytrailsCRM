const mongoose = require('mongoose');

const GlobalConfigSchema = new mongoose.Schema({
  key: { 
    type: String, 
    required: true, 
    unique: true, 
    default: 'GLOBAL_SETTINGS' 
  },
  products: {
    type: [String],
    default: [
      "Meghalaya Package",
      "Hampta Pass Trek",
      "Rishikesh Activities",
      "Spiti Package",
      "Ladakh Package",
      "Kerala Trip",
    ]
  }
}, { timestamps: true });

module.exports = mongoose.model('GlobalConfig', GlobalConfigSchema);
