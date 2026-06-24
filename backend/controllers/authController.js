const authService = require('../services/authService');

async function register(req, res) {
  try {
    const { name, email, password } = req.body;
    const result = await authService.register(name, email, password);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

async function getProfile(req, res) {
  try {
    const profile = await authService.getProfile(req.user.userId);
    res.json(profile);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

async function updatePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    await authService.updatePassword(req.user.userId, currentPassword, newPassword);
    res.json({ message: "Password updated successfully" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

async function updateProfile(req, res) {
  try {
    const { name, email } = req.body;
    const updatedUser = await authService.updateProfile(req.user.userId, name, email);
    res.json({ message: "Profile updated successfully", user: updatedUser });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

async function verifyEmail(req, res) {
  try {
    const { email, otp } = req.body;
    const result = await authService.verifyEmail(email, otp);
    res.json(result);
  } catch (error) {
    console.error("verifyEmail error:", error.message);
    res.status(400).json({ error: "Invalid request" });
  }
}

async function resendOtp(req, res) {
  try {
    const { email } = req.body;
    const result = await authService.resendOtp(email);
    res.json(result);
  } catch (error) {
    console.error("resendOtp error:", error.message);
    res.status(400).json({ error: "Invalid request" });
  }
}

async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    const result = await authService.forgotPassword(email);
    res.json(result);
  } catch (error) {
    console.error("forgotPassword error:", error.message);
    res.status(400).json({ error: "Invalid request" });
  }
}

async function resetPassword(req, res) {
  try {
    const { email, otp, newPassword } = req.body;
    const result = await authService.resetPassword(email, otp, newPassword);
    res.json(result);
  } catch (error) {
    console.error("resetPassword error:", error.message);
    res.status(400).json({ error: error.message || "Invalid request" });
  }
}

module.exports = {
  register,
  login,
  getProfile,
  updatePassword,
  updateProfile,
  verifyEmail,
  resendOtp,
  forgotPassword,
  resetPassword
};
