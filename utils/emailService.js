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

module.exports = { sendOTPEmail, sendCredentialsEmail, verifyTransporter };
