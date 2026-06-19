const crypto = require('crypto');

const generateOTP = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

const hashOTP = (otp) => {
  const pepper = process.env.OTP_PEPPER || 'default_pepper_secret';
  return crypto.createHmac("sha256", pepper).update(otp).digest("hex");
};

module.exports = {
  generateOTP,
  hashOTP
};
