const axios = require('axios');

const sendOTPEmail = async (email, otp, tenant = {}) => {
  const { name = 'Hometown Brew', logo, primaryColor = '#f97316' } = tenant;

  let absoluteLogo = logo;
  if (logo && logo.startsWith('/')) {
    absoluteLogo = `https://hometownbrew.jasonanthonytrillo.workers.dev${logo}`;
  }

  if (!process.env.EMAIL_PASS) {
    console.log('\n=============================================');
    console.log(`🔑 [DEV MODE] OTP Code for ${email}: ${otp}`);
    console.log('=============================================\n');
    return { success: true, message: 'Mock OTP logged to console' };
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
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap');
            body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 40px 0; -webkit-font-smoothing: antialiased; }
            .wrapper { width: 100%; table-layout: fixed; background-color: #f1f5f9; padding-bottom: 40px; }
            .webkit { max-width: 600px; margin: 0 auto; }
            .outer { margin: 0 auto; width: 100%; max-width: 600px; border-spacing: 0; font-family: 'Inter', sans-serif; color: #333333; }
            
            .container { background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01); margin: 0 20px; }
            
            .header { padding: 40px 40px 30px; text-align: center; border-bottom: 1px solid #f1f5f9; }
            .logo-container { margin-bottom: 24px; }
            .logo { height: 48px; width: auto; border-radius: 12px; }
            .title { margin: 0; font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.025em; }
            
            .content { padding: 40px; text-align: center; }
            .greeting { font-size: 18px; font-weight: 600; color: #1e293b; margin-top: 0; margin-bottom: 16px; }
            .text { font-size: 15px; line-height: 1.6; color: #475569; margin: 0; }
            
            .otp-container { margin: 32px 0; padding: 32px 24px; background: linear-gradient(145deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 16px; border: 1px solid #e2e8f0; position: relative; }
            .otp-code { font-family: 'Inter', monospace; font-size: 42px; font-weight: 900; letter-spacing: 16px; color: ${primaryColor}; margin: 0; text-shadow: 2px 2px 0px rgba(0,0,0,0.02); display: inline-block; padding-left: 16px; }
            
            .security-notice { font-size: 13px; color: #64748b; margin-top: 24px; display: inline-block; }
            
            .divider { height: 1px; background-color: #e2e8f0; margin: 32px 0; }
            
            .footer { padding: 0 40px 40px; text-align: center; }
            .footer-text { font-size: 12px; color: #94a3b8; line-height: 1.5; margin: 0 0 8px; }
            .tenant-name { font-weight: 600; color: #64748b; }
          </style>
        </head>
        <body>
          <div class="wrapper">
            <div class="webkit">
              <table class="outer" align="center">
                <tr>
                  <td>
                    <div class="container">
                      <div class="header">
                        <div class="logo-container">
                          ${absoluteLogo ? `
                            <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                              <tr>
                                <td><img src="${absoluteLogo}" alt="${name}" style="height: 48px; width: auto; border-radius: 12px; display: block;"></td>
                              </tr>
                            </table>
                          ` : `
                            <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                              <tr>
                                <td align="center" valign="middle" style="width: 48px; height: 48px; background: ${primaryColor}; border-radius: 12px; color: white; font-weight: bold; font-size: 20px; line-height: 48px; text-align: center;">
                                  ${name.charAt(0)}
                                </td>
                              </tr>
                            </table>
                          `}
                        </div>
                        <h1 class="title">Secure Verification</h1>
                      </div>
                      
                      <div class="content">
                        <h2 class="greeting">Welcome to ${name}!</h2>
                        <p class="text">We received a request to sign in to your account. Please use the verification code below to complete your secure login.</p>
                        
                        <div class="otp-container">
                          <h1 class="otp-code">${otp}</h1>
                        </div>
                        
                        <p class="security-notice">
                          <span style="display:inline-block; width:16px; height:16px; line-height: 16px; text-align: center; background:${primaryColor}20; color:${primaryColor}; border-radius:50%; font-size:10px; font-weight:bold; margin-right:6px;">!</span>
                          This code expires in 10 minutes.
                        </p>
                      </div>
                      
                      <div class="footer">
                        <div class="divider"></div>
                        <p class="footer-text">This email was intended for <strong style="color: #64748b;">${email}</strong>.</p>
                        <p class="footer-text">Powered securely by <span class="tenant-name">Hometown Brew</span> &copy; ${new Date().getFullYear()}</p>
                      </div>
                    </div>
                  </td>
                </tr>
              </table>
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
