require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 5000,
  MONGODB_URI: process.env.MONGODB_URI,
  BOOKING_MONGODB_URI: process.env.BOOKING_MONGODB_URI || "mongodb+srv://choudharypratyush809:1jFGTP9NBLkt5YzM@cluster7.2mbgpzr.mongodb.net/ft_booking_system",
  JWT_SECRET: process.env.JWT_SECRET,
  RESEND_API_KEY: process.env.RESEND_API_KEY
};

