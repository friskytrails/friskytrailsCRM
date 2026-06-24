const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const PendingUser = require('../models/PendingUser');
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

  let pendingUser = await PendingUser.findOne({ email: email.toLowerCase() });
  if (pendingUser) {
    throw new Error("An account registration for this email is already pending. Please verify your email or use the resend OTP option.");
  }

  pendingUser = new PendingUser({
    name,
    email: email.toLowerCase(),
    password: hashedPassword,
    verificationOtp: hashedOtp,
    otpExpiresAt,
    otpAttempts: 0
  });
  try {
    await pendingUser.save();
  } catch (error) {
    if (error.code === 11000 || error.code === 'E11000') {
      throw new Error("An account registration for this email is already pending. Please verify your email or use the resend OTP option.");
    }
    throw error;
  }

  let emailFailed = false;
  try {
    await sendOTPEmail(email.toLowerCase(), otp, name);
  } catch (error) {
    console.error("Failed to send OTP email via Nodemailer", error);
    emailFailed = true;
  }

  return {
    message: emailFailed ? "Account created but failed to send OTP email." : "OTP sent successfully. Please verify your email.",
    emailFailed
  };
}

async function login(email, password) {
  if (!email || !password) {
    throw new Error("Email and password are required");
  }

  const user = await User.findByEmail(email);
  if (!user) {
    const pendingUser = await PendingUser.findOne({ email: email.toLowerCase() });
    if (pendingUser) {
      throw new Error("Please verify your email address first");
    }
    throw new Error("Invalid credentials");
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new Error("Invalid credentials");
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
  
  const pendingUser = await PendingUser.findOne({ email: email.toLowerCase() });
  if (!pendingUser) {
    const existingUser = await User.findByEmail(email);
    if (existingUser) throw new Error("User is already verified");
    throw new Error("User not found or registration expired");
  }
  
  if (pendingUser.otpExpiresAt < new Date()) {
    throw new Error("OTP has expired. Please request a new one.");
  }

  if (pendingUser.otpAttempts >= MAX_OTP_ATTEMPTS) {
    throw new Error("Too many failed attempts. Please request a new OTP.");
  }
  
  const hashedInputOtp = hashOTP(otp);
  if (pendingUser.verificationOtp !== hashedInputOtp) {
    pendingUser.otpAttempts += 1;
    await pendingUser.save();
    throw new Error("Invalid OTP");
  }

  const newUser = {
    name: pendingUser.name,
    email: pendingUser.email,
    password: pendingUser.password,
    isAdmin: false,
    createdAt: new Date(),
    isVerified: true
  };

  const result = await User.insertUser(newUser);
  const user = await User.findById(result.insertedId);

  await PendingUser.deleteOne({ _id: pendingUser._id });

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
  
  const existingUser = await User.findByEmail(email);
  if (existingUser) throw new Error("User is already verified");
  
  let pendingUser = await PendingUser.findOne({ email: email.toLowerCase() });
  if (!pendingUser) {
    throw new Error("User not found or registration expired");
  }
  
  if (pendingUser.otpExpiresAt && pendingUser.otpExpiresAt > new Date() && pendingUser.otpAttempts < MAX_OTP_ATTEMPTS) {
    throw new Error("An OTP has already been sent recently. Please wait before requesting another.");
  }

  const otp = generateOTP();
  const hashedOtp = hashOTP(otp);
  const otpExpiresAt = new Date(Date.now() + 10 * 60000); // 10 mins

  pendingUser.verificationOtp = hashedOtp;
  pendingUser.otpExpiresAt = otpExpiresAt;
  pendingUser.otpAttempts = 0;
  await pendingUser.save();

  let emailFailed = false;
  try {
    await sendOTPEmail(email.toLowerCase(), otp, pendingUser.name);
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
