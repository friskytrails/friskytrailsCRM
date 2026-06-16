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
    }
  });

  await transporter.sendMail({
    from: `"FriskyTrails CRM" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "FriskyTrails CRM - Verification Code",
    html: `
      <p>Hello ${name},</p>
      <p>Your verification code is: <strong>${otp}</strong></p>
      <p>This code will expire in 10 minutes.</p>
    `,
  });
};

module.exports = {
  sendOTPEmail
};
