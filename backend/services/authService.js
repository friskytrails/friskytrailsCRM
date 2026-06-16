const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config');
const { Resend } = require('resend');

async function register(name, email, password) {
  if (!name || !email || !password) {
    throw new Error("All fields are required");
  }

  const existingUser = await User.findByEmail(email);
  if (existingUser) {
    throw new Error("User already exists with this email");
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpiresAt = new Date(Date.now() + 10 * 60000); // 10 mins

  const newUser = {
    name,
    email: email.toLowerCase(),
    password: hashedPassword,
    isAdmin: false,
    createdAt: new Date(),
    isVerified: false,
    verificationOtp: otp,
    otpExpiresAt
  };

  const result = await User.insertUser(newUser);

  try {
    const resend = new Resend(config.RESEND_API_KEY);
    
    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: email.toLowerCase(),
      subject: 'FriskyTrails CRM - Verification Code',
      html: `<p>Hello ${name},</p><p>Your verification code is: <strong>${otp}</strong></p><p>This code will expire in 10 minutes.</p>`
    });
  } catch (error) {
    console.error("Failed to send OTP email via Resend", error);
  }

  return {
    message: "OTP sent successfully. Please verify your email.",
    userId: result.insertedId.toString()
  };
}

async function login(email, password) {
  if (!email || !password) {
    throw new Error("Email and password are required");
  }

  const user = await User.findByEmail(email);
  if (!user) {
    throw new Error("Invalid credentials");
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new Error("Invalid credentials");
  }

  if (!user.isVerified) {
    throw new Error("Please verify your email address first");
  }

  const token = jwt.sign(
    { userId: user._id.toString(), isAdmin: !!user.isAdmin },
    config.JWT_SECRET,
    { expiresIn: '7d' }
  );

  return {
    token,
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      isAdmin: !!user.isAdmin
    }
  };
}

async function getProfile(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    isAdmin: !!user.isAdmin
  };
}

async function updatePassword(userId, currentPassword, newPassword) {
  if (!currentPassword || !newPassword) {
    throw new Error("Current and new passwords are required");
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) {
    throw new Error("Incorrect current password");
  }

  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(newPassword, salt);
  await user.save();
}

async function updateProfile(userId, name, email) {
  if (!name || !email) {
    throw new Error("Name and email are required");
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  // Check if email is already taken by another user
  if (email.toLowerCase() !== user.email) {
    const existing = await User.findByEmail(email);
    if (existing && existing._id.toString() !== userId) {
      throw new Error("Email is already in use");
    }
  }

  user.name = name;
  user.email = email.toLowerCase();
  await user.save();

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    isAdmin: !!user.isAdmin
  };
}

async function verifyEmail(email, otp) {
  if (!email || !otp) throw new Error("Email and OTP are required");
  
  const user = await User.findByEmail(email);
  if (!user) throw new Error("User not found");
  if (user.isVerified) throw new Error("User is already verified");
  
  if (user.verificationOtp !== otp) {
    throw new Error("Invalid OTP");
  }
  
  if (user.otpExpiresAt < new Date()) {
    throw new Error("OTP has expired");
  }

  user.isVerified = true;
  user.verificationOtp = undefined;
  user.otpExpiresAt = undefined;
  await user.save();

  const token = jwt.sign(
    { userId: user._id.toString(), isAdmin: !!user.isAdmin },
    config.JWT_SECRET,
    { expiresIn: '7d' }
  );

  return {
    token,
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      isAdmin: !!user.isAdmin
    }
  };
}

async function resendOtp(email) {
  if (!email) throw new Error("Email is required");
  
  const user = await User.findByEmail(email);
  if (!user) throw new Error("User not found");
  if (user.isVerified) throw new Error("User is already verified");

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpiresAt = new Date(Date.now() + 10 * 60000); // 10 mins

  user.verificationOtp = otp;
  user.otpExpiresAt = otpExpiresAt;
  await user.save();

  try {
    const { Resend } = require('resend');
    const resend = new Resend(config.RESEND_API_KEY);
    
    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: email.toLowerCase(),
      subject: 'FriskyTrails CRM - New Verification Code',
      html: `<p>Hello ${user.name},</p><p>Your new verification code is: <strong>${otp}</strong></p><p>This code will expire in 10 minutes.</p>`
    });
  } catch (error) {
    console.error("Failed to resend OTP email via Resend", error);
  }

  return { message: "A new OTP has been sent to your email" };
}

module.exports = {
  register,
  login,
  getProfile,
  updatePassword,
  updateProfile,
  verifyEmail,
  resendOtp
};
