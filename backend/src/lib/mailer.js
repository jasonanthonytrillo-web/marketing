const axios = require('axios');

const sendOTPEmail = async (email, otp, tenantName = 'Elevate POS') => {
  if (!process.env.EMAIL_PASS) {
    console.error('❌ BREVO API KEY MISSING: Please add EMAIL_PASS to your environment variables.');
    throw new Error('Email service not configured. Please contact support.');
  }

  console.log('--- BREVO API ATTEMPT ---');
  
  try {
    const response = await axios.post('https://api.brevo.com/v3/smtp/email', {
      sender: { 
        name: tenantName, 
        email: 'jasonanthonytrillo@gmail.com' // Using your verified account email
      },
      to: [{ email: email }],
      subject: `Your Verification Code for ${tenantName}`,
      htmlContent: `
        <div style="font-family: sans-serif; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #f97316; text-align: center;">Welcome to ${tenantName}</h2>
          <p>Thank you for signing up! Please use the following code to verify your email address:</p>
          <div style="background: #fdf2f2; padding: 20px; text-align: center; border-radius: 10px; margin: 20px 0;">
            <h1 style="margin: 0; font-size: 32px; letter-spacing: 5px; color: #f97316;">${otp}</h1>
          </div>
          <p style="color: #666; font-size: 12px; text-align: center;">This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
        </div>
      `
    }, {
      headers: {
        'api-key': process.env.EMAIL_PASS,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Brevo API Success:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Brevo API Failure:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || 'Failed to send verification email.');
  }
};

module.exports = { sendOTPEmail };
