const axios = require('axios');

const sendOTPEmail = async (email, otp, tenant = {}) => {
  const { name = 'Elevate POS', logo, primaryColor = '#f97316' } = tenant;

  if (!process.env.EMAIL_PASS) {
    console.error('❌ BREVO API KEY MISSING: Please add EMAIL_PASS to your environment variables.');
    throw new Error('Email service not configured. Please contact support.');
  }

  console.log('--- SENDING PREMIUM EMAIL ---');
  
  try {
    const response = await axios.post('https://api.brevo.com/v3/smtp/email', {
      sender: { 
        name: name, 
        email: process.env.EMAIL_USER || 'jasonanthonytrillo@gmail.com'
      },
      to: [{ email: email }],
      subject: `[${otp}] Your Verification Code for ${name}`,
      htmlContent: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
            body { font-family: 'Inter', sans-serif; background-color: #f8fafc; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); }
            .header { background: ${primaryColor}; padding: 40px 20px; text-align: center; color: white; }
            .content { padding: 40px; text-align: center; color: #1e293b; }
            .logo { height: 60px; margin-bottom: 20px; border-radius: 12px; }
            .otp-box { background: #f1f5f9; padding: 32px; border-radius: 20px; margin: 24px 0; border: 2px dashed ${primaryColor}44; }
            .otp-code { font-size: 48px; font-weight: 900; letter-spacing: 12px; color: ${primaryColor}; margin: 0; }
            .footer { padding: 24px; text-align: center; font-size: 12px; color: #64748b; background: #f8fafc; }
            .btn { display: inline-block; padding: 16px 32px; background: ${primaryColor}; color: white; text-decoration: none; border-radius: 12px; font-weight: 700; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              ${logo ? `<img src="${logo}" class="logo" alt="${name}">` : ''}
              <h1 style="margin: 0; font-size: 28px; font-weight: 900; letter-spacing: -0.05em;">JOIN THE CLUB</h1>
            </div>
            <div class="content">
              <h2 style="margin-top: 0;">Welcome to ${name}!</h2>
              <p style="font-size: 16px; line-height: 1.6; color: #475569;">We're excited to have you. Please use the verification code below to complete your registration and start earning rewards.</p>
              
              <div class="otp-box">
                <h1 class="otp-code">${otp}</h1>
              </div>
              
              <p style="font-size: 14px; color: #94a3b8;">This code will expire in 10 minutes for your security.</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} ${name}. Powered by Elevate POS.</p>
              <p>If you didn't request this, you can safely ignore this email.</p>
            </div>
          </div>
        </body>
        </html>
      `
    }, {
      headers: {
        'api-key': process.env.EMAIL_PASS,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Premium Email Success:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Brevo API Failure:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || 'Failed to send verification email.');
  }
};

module.exports = { sendOTPEmail };
