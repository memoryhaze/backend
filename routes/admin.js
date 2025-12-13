const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Gift = require('../models/Gift');
const authMiddleware = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const bcrypt = require('bcryptjs');
const { sendCredentialsEmail } = require('../utils/emailService');

// GET /api/admin/users - Get all users with search and pagination
router.get('/users', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { search = '', page = 1, limit = 10 } = req.query;

        // Build query for verified users with passwords
        const query = {
            isVerified: true,
            password: { $exists: true, $ne: null }
        };

        // Add email search if provided
        if (search) {
            query.email = { $regex: search, $options: 'i' };
        }

        // Calculate pagination
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        // Get total count
        const total = await User.countDocuments(query);

        // Get users with pagination (only necessary fields)
        const users = await User.find(query)
            .select('email createdAt')
            .skip(skip)
            .limit(limitNum)
            .sort({ createdAt: -1 });

        // Return minimal user info suitable for this project
        const slimUsers = users.map(user => ({
            _id: user._id,
            email: user.email,
            createdAt: user.createdAt
        }));

        res.json({
            users: slimUsers,
            total,
            page: pageNum,
            limit: limitNum
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/admin/users - Create a new user (admin only)
router.post('/users', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { email, password } = req.body || {};
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const existing = await User.findOne({ email });
        if (existing) {
            return res.status(400).json({ error: 'User with this email already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Derive a simple name from email local part
        const name = email.split('@')[0] || 'User';

        const user = new User({
            name,
            email,
            password: hashedPassword,
            isVerified: true,
            isAdmin: false,
        });
        await user.save();

        // Fire-and-forget email sending (do not block success on email failure)
        try {
            await sendCredentialsEmail(email, password);
        } catch (e) {
            console.warn('Failed to send credentials email:', e?.message || e);
        }

        return res.status(201).json({
            user: {
                _id: user._id,
                email: user.email,
                createdAt: user.createdAt,
            }
        });
    } catch (err) {
        console.error('Admin POST /users error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/admin/gifts - Create a gift for a user (admin only)
router.post('/gifts', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const {
            userId,
            templateId,
            scenarios = [],
            memory = null,
            plan = null,
            photos = [],
            audio = null,
            lyrics = '',
        } = req.body || {};

        if (!userId || !templateId) {
            return res.status(400).json({ error: 'userId and templateId are required' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const gift = new Gift({
            user: user._id,
            templateId,
            scenarios: Array.isArray(scenarios) ? scenarios : [],
            memory,
            plan,
            photos: Array.isArray(photos) ? photos : [],
            audio,
            lyrics: typeof lyrics === 'string' ? lyrics : '',
        });

        await gift.save();
        return res.status(201).json({ gift });
    } catch (err) {
        console.error('Admin POST /gifts error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
