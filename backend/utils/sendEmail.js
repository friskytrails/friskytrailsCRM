const nodemailer = require("nodemailer");

// Create a single reusable transporter object
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: process.env.NODE_ENV === 'production' ? true : false
  },
  connectionTimeout: 10000,
  socketTimeout: 15000
});

// Helper function to escape HTML
const escapeHTML = str => str.replace(/[&<>'"]/g, tag => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'}[tag]));

const sendOTPEmail = async (email, otp, name = "Agent") => {
  await transporter.sendMail({
    from: `"FriskyTrails CRM" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "FriskyTrails CRM - Verification Code",
    timeout: 15000,
    html: `
      <p>Hello ${escapeHTML(name)},</p>
      <p>Your verification code is: <strong>${otp}</strong></p>
      <p>This code will expire in 10 minutes.</p>
    `,
  });
};

const sendPasswordResetEmail = async (email, otp, name = "User") => {
  await transporter.sendMail({
    from: `"FriskyTrails CRM" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "FriskyTrails CRM - Password Reset Code",
    timeout: 15000,
    html: `
      <p>Hello ${escapeHTML(name)},</p>
      <p>You requested a password reset. Your reset code is: <strong>${otp}</strong></p>
      <p>This code will expire in 10 minutes. If you did not request a password reset, please ignore this email.</p>
    `,
  });
};

const sendAgentApprovalEmail = async (email, name = "Agent") => {
  await transporter.sendMail({
    from: `"FriskyTrails CRM" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "FriskyTrails CRM - Account Approved!",
    timeout: 15000,
    html: `
      <p>Hello ${escapeHTML(name)},</p>
      <p>Great news! Your agent account on FriskyTrails CRM has been approved by an administrator.</p>
      <p>You can now log in using your email address and the password you created during registration.</p>
      <p>Welcome to the team!</p>
    `,
  });
};

const sendAgentRejectionEmail = async (email, name = "Agent") => {
  await transporter.sendMail({
    from: `"FriskyTrails CRM" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "FriskyTrails CRM - Account Update",
    timeout: 15000,
    html: `
      <p>Hello ${escapeHTML(name)},</p>
      <p>We are writing to inform you that your registration request for an agent account on FriskyTrails CRM has been declined by an administrator.</p>
      <p>If you believe this was a mistake, please contact support or your team lead.</p>
    `,
  });
};

module.exports = {
  sendOTPEmail,
  sendPasswordResetEmail,
  sendAgentApprovalEmail,
  sendAgentRejectionEmail
};
