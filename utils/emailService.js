const nodemailer = require('nodemailer');

// Create transporter (configurable, defaults to Gmail SMTP)
const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
const smtpPort = Number(process.env.SMTP_PORT || 465);
const smtpSecure = process.env.SMTP_SECURE === 'false' ? false : true; // default secure for 465

const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// Send OTP email
const sendOTPEmail = async (email, otp) => {
    try {
        const mailOptions = {
            from: `"MemoryHaze" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Your MemoryHaze Verification Code',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                            line-height: 1.6;
                            color: #333;
                            max-width: 600px;
                            margin: 0 auto;
                            padding: 20px;
                        }
                        .container {
                            background: linear-gradient(135deg, #fef3f3 0%, #fff9f0 100%);
                            border-radius: 16px;
                            padding: 40px;
                            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                        }
                        .header {
                            text-align: center;
                            margin-bottom: 30px;
                        }
                        .header h1 {
                            color: #e85d75;
                            font-size: 28px;
                            margin: 0;
                        }
                        .otp-box {
                            background: white;
                            border: 2px solid #e85d75;
                            border-radius: 12px;
                            text-align: center;
                            padding: 30px;
                            margin: 30px 0;
                        }
                        .otp-code {
                            font-size: 36px;
                            font-weight: bold;
                            color: #e85d75;
                            letter-spacing: 8px;
                            margin: 10px 0;
                        }
                        .content {
                            color: #555;
                            font-size: 16px;
                        }
                        .footer {
                            text-align: center;
                            margin-top: 30px;
                            color: #888;
                            font-size: 14px;
                        }
                        .warning {
                            background: #fff3cd;
                            border-left: 4px solid #ffc107;
                            padding: 12px;
                            margin: 20px 0;
                            border-radius: 4px;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🌸 MemoryHaze</h1>
                        </div>
                        
                        <div class="content">
                            <p>Hello!</p>
                            <p>Thank you for signing up with MemoryHaze. To complete your registration, please use the verification code below:</p>
                        </div>
                        
                        <div class="otp-box">
                            <p style="margin: 0; color: #888; font-size: 14px;">Your Verification Code</p>
                            <div class="otp-code">${otp}</div>
                            <p style="margin: 0; color: #888; font-size: 12px;">Valid for 10 minutes</p>
                        </div>
                        
                        <div class="warning">
                            <strong>⚠️ Security Notice:</strong> Never share this code with anyone. MemoryHaze will never ask you for this code.
                        </div>
                        
                        <div class="content">
                            <p>If you didn't request this code, please ignore this email.</p>
                        </div>
                        
                        <div class="footer">
                            <p>This is an automated message, please do not reply.</p>
                            <p>&copy; 2024 MemoryHaze. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };

        await transporter.sendMail(mailOptions);
        return { success: true };
    } catch (error) {
        console.error('Email sending error:', error);
        return { success: false, error: error.message };
    }
};

const sendCredentialsEmail = async (email, password) => {
    try {
        const mailOptions = {
            from: `"MemoryHaze" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Your MemoryHaze Account Credentials',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                        .container { background: linear-gradient(135deg, #fef3f3 0%, #fff9f0 100%); border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                        .header { text-align: center; margin-bottom: 30px; }
                        .header h1 { color: #e85d75; font-size: 28px; margin: 0; }
                        .box { background: white; border: 2px solid #e85d75; border-radius: 12px; padding: 20px; margin: 20px 0; }
                        .label { color: #888; font-size: 14px; margin: 0; }
                        .value { font-size: 18px; font-weight: bold; color: #e85d75; margin: 4px 0 0; }
                        .footer { text-align: center; margin-top: 30px; color: #888; font-size: 14px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🌸 MemoryHaze</h1>
                        </div>
                        <p>Your account has been created by an administrator. Use the credentials below to sign in:</p>
                        <div class="box">
                            <p class="label">Email</p>
                            <p class="value">${email}</p>
                        </div>
                        <div class="box">
                            <p class="label">Temporary Password</p>
                            <p class="value">${password}</p>
                        </div>
                        <p>For security, please change your password after first login.</p>
                        <div class="footer">
                            <p>This is an automated message, please do not reply.</p>
                            <p>&copy; 2024 MemoryHaze. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };
        await transporter.sendMail(mailOptions);
        return { success: true };
    } catch (error) {
        console.error('Email sending error:', error);
        return { success: false, error: error.message };
    }
};

const verifyTransporter = async () => {
    try {
        await transporter.verify();
        return { success: true };
    } catch (error) {
        console.error('Email transporter verify error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Send gift notification email to user
 * @param {Object} params - Email parameters
 * @param {string} params.to - Recipient email
 * @param {string} params.giftId - Gift ID
 * @param {string} params.encryptedUserId - Encrypted user ID
 * @param {string} params.occasion - Gift occasion
 * @returns {Promise<Object>} - Success/error object
 */
const sendGiftNotificationEmail = async ({ to, giftId, encryptedUserId, occasion }) => {
    try {
        // Get frontend URL from environment or use default
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

        // Construct the secure gift link with encrypted user ID
        const giftLink = `${frontendUrl}/gifts/${giftId}/${encodeURIComponent(encryptedUserId)}`;

        // Format occasion for display
        const formatOccasion = (occ) => {
            switch (occ) {
                case 'birthday': return 'Birthday';
                case 'anniversary': return 'Anniversary';
                case 'valentines': return "Valentine's Day";
                default: return occ;
            }
        };

        const formattedOccasion = formatOccasion(occasion);

        const mailOptions = {
            from: `"MemoryHaze" <${process.env.EMAIL_USER}>`,
            to,
            subject: `🎁 You've Received a Special Gift for ${formattedOccasion}!`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                            line-height: 1.6;
                            color: #333;
                            max-width: 600px;
                            margin: 0 auto;
                            padding: 20px;
                            background-color: #f5f5f5;
                        }
                        .container {
                            background: linear-gradient(135deg, #fff5f7 0%, #fff 50%, #fffbf0 100%);
                            border-radius: 16px;
                            padding: 40px;
                            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                        }
                        .header {
                            text-align: center;
                            margin-bottom: 30px;
                        }
                        .logo {
                            font-size: 32px;
                            font-weight: bold;
                            background: linear-gradient(135deg, #e91e63 0%, #d4af37 100%);
                            -webkit-background-clip: text;
                            -webkit-text-fill-color: transparent;
                            background-clip: text;
                        }
                        .gift-icon {
                            font-size: 64px;
                            margin: 20px 0;
                        }
                        h1 {
                            color: #333;
                            font-size: 28px;
                            margin-bottom: 20px;
                        }
                        p {
                            color: #666;
                            font-size: 16px;
                            margin-bottom: 20px;
                        }
                        .cta-button {
                            display: inline-block;
                            background: linear-gradient(135deg, #e91e63 0%, #d4af37 100%);
                            color: white;
                            text-decoration: none;
                            padding: 16px 40px;
                            border-radius: 12px;
                            font-weight: 600;
                            font-size: 18px;
                            margin: 20px 0;
                            box-shadow: 0 4px 12px rgba(233, 30, 99, 0.3);
                        }
                        .occasion-badge {
                            display: inline-block;
                            background: rgba(233, 30, 99, 0.1);
                            color: #e91e63;
                            padding: 8px 16px;
                            border-radius: 20px;
                            font-weight: 600;
                            font-size: 14px;
                            margin-bottom: 20px;
                        }
                        .footer {
                            text-align: center;
                            margin-top: 40px;
                            padding-top: 20px;
                            border-top: 1px solid #e0e0e0;
                            color: #999;
                            font-size: 14px;
                        }
                        .note {
                            background: #fff9e6;
                            border-left: 4px solid #d4af37;
                            padding: 15px;
                            margin: 20px 0;
                            border-radius: 4px;
                            font-size: 14px;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <div class="logo">MemoryHaze</div>
                            <div class="gift-icon">🎁</div>
                        </div>
                        
                        <div class="occasion-badge">
                            ✨ ${formattedOccasion} Special
                        </div>
                        
                        <h1>You've Received a Special Gift!</h1>
                        
                        <p>
                            Someone special has created a personalized memory gift just for you! 
                            This unique gift includes custom songs and a beautiful webpage designed 
                            to celebrate your special occasion.
                        </p>
                        
                        <p style="text-align: center;">
                            <a href="${giftLink}" class="cta-button">
                                🎉 Open Your Gift
                            </a>
                        </p>
                        
                        <div class="note">
                            <strong>📌 Important:</strong> This gift is exclusively for you. 
                            You'll need to log in to your MemoryHaze account to view it. 
                            If you don't have an account yet, use this email address to sign up!
                        </div>
                        
                        <p style="font-size: 14px; color: #999;">
                            The gift link is personalized and secure. It can only be viewed by you
                            when logged into your account.
                        </p>
                        
                        <div class="footer">
                            <p>
                                With love,<br>
                                <strong>MemoryHaze Team</strong>
                            </p>
                            <p>
                                Creating unforgettable moments, one gift at a time 💝
                            </p>
                        </div>
                    </div>
                </body>
                </html>
            `,
            text: `
You've Received a Special Gift for ${formattedOccasion}!

Someone special has created a personalized memory gift just for you!

Open your gift: ${giftLink}

Important: This gift is exclusively for you. You'll need to log in to your MemoryHaze account to view it.

The gift link is personalized and secure. It can only be viewed by you when logged into your account.

With love,
MemoryHaze Team
            `.trim(),
        };

        await transporter.sendMail(mailOptions);
        console.log(`Gift notification email sent to ${to}`);
        return { success: true };
    } catch (error) {
        console.error('Gift email sending error:', error);
        return { success: false, error: error.message };
    }
};

module.exports = { sendOTPEmail, sendCredentialsEmail, verifyTransporter, sendGiftNotificationEmail };
