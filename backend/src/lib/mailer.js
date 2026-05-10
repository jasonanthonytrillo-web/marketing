const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // use STARTTLS
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false // Helps with some cloud connection issues
  },
  connectionTimeout: 10000,
});

const sendOTPEmail = async (email, otp, tenantName = 'Elevate POS') => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('❌ EMAIL SETTINGS MISSING: Please add EMAIL_USER and EMAIL_PASS to your environment variables.');
    throw new Error('Email service not configured. Please contact support.');
  }
  const mailOptions = {
    from: `"Elevate POS" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `Your Login Code: ${otp}`,
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #f97316; text-align: center;">${tenantName}</h2>
        <p style="font-size: 16px; color: #333;">Hello!</p>
        <p style="font-size: 16px; color: #333;">You requested a login code for your account. Please use the 6-digit code below to sign in:</p>
        <div style="background: #f8fafc; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
          <h1 style="font-size: 40px; letter-spacing: 10px; margin: 0; color: #0f172a;">${otp}</h1>
        </div>
        <p style="font-size: 14px; color: #666; text-align: center;">This code will expire in 5 minutes. If you did not request this, you can safely ignore this email.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">&copy; 2024 Elevate POS. Powered by Project Million.</p>
      </div>
    `,
  };

  return transporter.sendMail(mailOptions);
};

module.exports = { sendOTPEmail };
