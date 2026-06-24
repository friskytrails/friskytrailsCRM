const nodemailer = require("nodemailer");

const sendOTPEmail = async (email, otp, name = "Agent") => {
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

  const escapeHTML = str => str.replace(/[&<>'"]/g, tag => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'}[tag]));

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

  const escapeHTML = str => str.replace(/[&<>'"]/g, tag => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'}[tag]));

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

module.exports = {
  sendOTPEmail,
  sendPasswordResetEmail
};
