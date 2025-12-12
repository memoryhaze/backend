const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sendOTPEmail, verifyTransporter } = require('../utils/emailService');
const authMiddleware = require('../middleware/auth');

// Public: Total user count
router.get('/user-count', async (req, res) => {
    try {
        const count = await User.countDocuments();
        return res.json({ count });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json({ msg: 'Server error' });
    }
});

// Diagnostics: verify email transporter configuration
router.get('/email/verify', async (_req, res) => {
    try {
        const result = await verifyTransporter();
        if (!result.success) {
            return res.status(500).json({ ok: false, error: result.error });
        }
        return res.json({ ok: true });
    } catch (err) {
        return res.status(500).json({ ok: false, error: err.message });
    }
});

// Send OTP for signup
router.post('/send-otp', async (req, res) => {
    const { email } = req.body;

    try {
        // Check if user already exists with verified account
        let user = await User.findOne({ email });
        if (user && user.isVerified) {
            return res.status(400).json({ msg: 'User already exists. Please login.' });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Create or update user with OTP
        if (user) {
            user.otp = otp;
            user.otpExpiry = otpExpiry;
            await user.save();
        } else {
            user = new User({
                name: 'Pending', // Temporary name
                email,
                password: 'pending', // Temporary password
                otp,
                otpExpiry,
                isVerified: false
            });
            await user.save();
        }

        // Send OTP email
        const emailResult = await sendOTPEmail(email, otp);

        if (!emailResult.success) {
            return res.status(500).json({ msg: 'Failed to send OTP email. Please try again.' });
        }

        res.json({ msg: 'OTP sent successfully to your email.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Verify OTP and complete signup
router.post('/verify-signup', async (req, res) => {
    const { email, otp, name, password } = req.body;

    try {
        let user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({ msg: 'No signup request found for this email.' });
        }

        // Check if OTP matches
        if (user.otp !== otp) {
            return res.status(400).json({ msg: 'Invalid OTP. Please try again.' });
        }

        // Check if OTP is expired
        if (new Date() > user.otpExpiry) {
            return res.status(400).json({ msg: 'OTP has expired. Please request a new one.' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Update user with actual data
        user.name = name;
        user.password = hashedPassword;
        user.isVerified = true;
        user.otp = null;
        user.otpExpiry = null;
        await user.save();

        // Create JWT token
        const payload = {
            user: {
                id: user.id,
                isAdmin: user.isAdmin
            }
        };

        jwt.sign(payload, process.env.JWT_SECRET || 'secret', { expiresIn: 360000 }, (err, token) => {
            if (err) throw err;
            res.json({ token, msg: 'Account created successfully!' });
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        let user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }

        const payload = {
            user: {
                id: user.id,
                isAdmin: user.isAdmin
            }
        };

        jwt.sign(payload, process.env.JWT_SECRET || 'secret', { expiresIn: 360000 }, (err, token) => {
            if (err) throw err;
            res.json({ token });
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Get current user info
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password -otp -otpExpiry');
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

module.exports = router;

// Forgot Password: Send OTP
router.post('/forgot/send-otp', async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ msg: 'User not found' });
        }
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
        user.otp = otp;
        user.otpExpiry = otpExpiry;
        await user.save();
        const emailResult = await sendOTPEmail(email, otp);
        if (!emailResult.success) {
            return res.status(500).json({ msg: 'Failed to send OTP email. Please try again.' });
        }
        return res.json({ msg: 'OTP sent successfully' });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json({ msg: 'Server error' });
    }
});

// Forgot Password: Verify OTP
router.post('/forgot/verify', async (req, res) => {
    const { email, otp } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ msg: 'User not found' });
        }
        if (user.otp !== otp) {
            return res.status(400).json({ msg: 'Invalid OTP' });
        }
        if (new Date() > user.otpExpiry) {
            return res.status(400).json({ msg: 'OTP has expired' });
        }
        return res.json({ msg: 'OTP verified' });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json({ msg: 'Server error' });
    }
});

// Forgot Password: Reset Password
router.post('/forgot/reset', async (req, res) => {
    const { email, otp, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ msg: 'User not found' });
        }
        if (user.otp !== otp) {
            return res.status(400).json({ msg: 'Invalid OTP' });
        }
        if (new Date() > user.otpExpiry) {
            return res.status(400).json({ msg: 'OTP has expired' });
        }
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        user.password = hashedPassword;
        user.otp = null;
        user.otpExpiry = null;
        await user.save();
        return res.json({ msg: 'Password reset successful' });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json({ msg: 'Server error' });
    }
});
