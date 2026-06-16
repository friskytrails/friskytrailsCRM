const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config');
const { sendOTPEmail } = require('../utils/sendEmail');
const { generateOTP, hashOTP } = require('../utils/otp');

const MAX_OTP_ATTEMPTS = 5;

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

  const otp = generateOTP();
  const hashedOtp = hashOTP(otp);
  const otpExpiresAt = new Date(Date.now() + 10 * 60000); // 10 mins

  const newUser = {
    name,
    email: email.toLowerCase(),
    password: hashedPassword,
    isAdmin: false,
    createdAt: new Date(),
    isVerified: false,
    verificationOtp: hashedOtp,
    otpExpiresAt,
    otpAttempts: 0
  };

  const result = await User.insertUser(newUser);

  let emailFailed = false;
  try {
    await sendOTPEmail(email.toLowerCase(), otp, name);
  } catch (error) {
    console.error("Failed to send OTP email via Nodemailer", error);
    emailFailed = true;
  }

  return {
    message: emailFailed ? "Account created but failed to send OTP email." : "OTP sent successfully. Please verify your email.",
    userId: result.insertedId.toString(),
    emailFailed
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
      isAdmin: !!user.isAdmin,
      isVerified: user.isVerified
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
    isAdmin: !!user.isAdmin,
    isVerified: user.isVerified
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
    isAdmin: !!user.isAdmin,
    isVerified: user.isVerified
  };
}

async function verifyEmail(email, otp) {
  if (!email || !otp) throw new Error("Email and OTP are required");
  
  const user = await User.findByEmail(email);
  if (!user) throw new Error("User not found");
  if (user.isVerified) throw new Error("User is already verified");
  
  if (user.otpExpiresAt < new Date()) {
    user.verificationOtp = undefined;
    user.otpExpiresAt = undefined;
    user.otpAttempts = 0;
    await user.save();
    throw new Error("OTP has expired");
  }

  if (user.otpAttempts >= MAX_OTP_ATTEMPTS) {
    throw new Error("Too many failed attempts. Please request a new OTP.");
  }
  
  const hashedInputOtp = hashOTP(otp);
  if (user.verificationOtp !== hashedInputOtp) {
    user.otpAttempts += 1;
    await user.save();
    throw new Error("Invalid OTP");
  }

  user.isVerified = true;
  user.verificationOtp = undefined;
  user.otpExpiresAt = undefined;
  user.otpAttempts = 0;
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
      isAdmin: !!user.isAdmin,
      isVerified: user.isVerified
    }
  };
}

async function resendOtp(email) {
  if (!email) throw new Error("Email is required");
  
  const user = await User.findByEmail(email);
  if (!user) throw new Error("User not found");
  if (user.isVerified) throw new Error("User is already verified");
  
  if (user.otpExpiresAt && user.otpExpiresAt > new Date() && user.otpAttempts < MAX_OTP_ATTEMPTS) {
    throw new Error("An OTP has already been sent recently. Please wait before requesting another.");
  }

  const otp = generateOTP();
  const hashedOtp = hashOTP(otp);
  const otpExpiresAt = new Date(Date.now() + 10 * 60000); // 10 mins

  user.verificationOtp = hashedOtp;
  user.otpExpiresAt = otpExpiresAt;
  user.otpAttempts = 0;
  await user.save();

  let emailFailed = false;
  try {
    await sendOTPEmail(email.toLowerCase(), otp, user.name);
  } catch (error) {
    console.error("Failed to resend OTP email via Nodemailer", error);
    emailFailed = true;
  }

  return { 
    message: emailFailed ? "Failed to resend OTP email." : "A new OTP has been sent to your email",
    emailFailed
  };
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
