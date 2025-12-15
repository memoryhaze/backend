const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Gift = require('../models/Gift');
const authMiddleware = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const bcrypt = require('bcryptjs');
const { sendCredentialsEmail, sendGiftNotificationEmail } = require('../utils/emailService');
const { encryptUserId } = require('../utils/encryption');
const crypto = require('crypto');
const https = require('https');
const querystring = require('querystring');

const getDurationDaysForPlan = (plan) => {
    if (plan === 'momentum') return 7;
    if (plan === 'everlasting') return 14;
    return null;
};

const cloudinaryDestroy = ({ publicId, resourceType }) => {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
        return Promise.resolve({ ok: false, error: 'Cloudinary not configured' });
    }
    if (!publicId) {
        return Promise.resolve({ ok: true });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const toSign = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash('sha1').update(toSign).digest('hex');

    const postData = querystring.stringify({
        public_id: publicId,
        timestamp,
        api_key: apiKey,
        signature,
    });

    const path = `/v1_1/${cloudName}/${resourceType}/destroy`;

    return new Promise((resolve) => {
        const req = https.request(
            {
                hostname: 'api.cloudinary.com',
                method: 'POST',
                path,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(postData),
                },
            },
            (res) => {
                let data = '';
                res.on('data', (chunk) => (data += chunk));
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data || '{}');
                        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                            return resolve({ ok: true, result: parsed });
                        }
                        return resolve({ ok: false, error: parsed?.error || parsed || data });
                    } catch {
                        return resolve({ ok: false, error: data });
                    }
                });
            }
        );
        req.on('error', (err) => resolve({ ok: false, error: err?.message || err }));
        req.write(postData);
        req.end();
    });
};

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
            .select('userId email createdAt')
            .skip(skip)
            .limit(limitNum)
            .sort({ createdAt: -1 });

        // Return minimal user info suitable for this project
        const slimUsers = users.map(user => ({
            _id: user._id,
            userId: user.userId,
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
            message = '',
        } = req.body || {};

        console.log('Creating gift with data:', {
            userId,
            templateId,
            scenarios,
            memory,
            plan,
            photosCount: Array.isArray(photos) ? photos.length : 0,
            hasAudio: !!audio,
            lyricsLength: typeof lyrics === 'string' ? lyrics.length : 0,
            messageLength: typeof message === 'string' ? message.length : 0,
        });

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
            assignedAt: new Date(),
            photos: Array.isArray(photos) ? photos : [],
            audio,
            lyrics: typeof lyrics === 'string' ? lyrics : '',
            message: typeof message === 'string' ? message : '',
        });


        await gift.save();
        console.log('Gift created successfully:', gift._id);

        // Send gift notification email (fire-and-forget, don't block on email error)
        try {
            const encryptedUserId = encryptUserId(user._id.toString());
            await sendGiftNotificationEmail({
                to: user.email,
                giftId: gift._id.toString(),
                encryptedUserId,
                occasion: memory || 'special',
            });
            console.log(`Gift notification email sent to ${user.email}`);
        } catch (emailError) {
            console.error('Failed to send gift notification email:', emailError.message);
            // Don't fail the request if email fails
        }

        return res.status(201).json({ gift });
    } catch (err) {
        console.error('Admin POST /gifts error:', err);
        console.error('Error name:', err.name);
        console.error('Error message:', err.message);
        if (err.errors) {
            console.error('Validation errors:', err.errors);
        }

        // Return more detailed error in development
        if (err.name === 'ValidationError') {
            const errors = Object.keys(err.errors).map(key => ({
                field: key,
                message: err.errors[key].message
            }));
            return res.status(400).json({
                error: 'Validation failed',
                details: errors,
                message: err.message
            });
        }

        return res.status(500).json({
            error: 'Server error',
            message: err.message,
            name: err.name,
            stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
        });
    }
});

// GET /api/admin/users/:userId/gifts - List gifts for a user (admin only)
router.get('/users/:userId/gifts', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId).select('_id');
        if (!user) return res.status(404).json({ error: 'User not found' });

        const gifts = await Gift.find({ user: userId }).sort({ createdAt: -1 });
        return res.json({ gifts });
    } catch (err) {
        console.error('Admin GET /users/:userId/gifts error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
});

// PATCH /api/admin/gifts/:giftId/access - Toggle gift access (admin only)
// Body: { accessEnabled: boolean, resetExpiry?: boolean }
router.patch('/gifts/:giftId/access', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { giftId } = req.params;
        const { accessEnabled, resetExpiry = false } = req.body || {};

        if (!mongoose.Types.ObjectId.isValid(giftId)) {
            return res.status(400).json({ error: 'Invalid giftId' });
        }
        if (typeof accessEnabled !== 'boolean') {
            return res.status(400).json({ error: 'accessEnabled must be boolean' });
        }

        const gift = await Gift.findById(giftId).select('plan expiresAt permanentlyDeleted');
        if (!gift) return res.status(404).json({ error: 'Gift not found' });

        if (gift.permanentlyDeleted) {
            return res.status(400).json({ error: 'Cannot change access for a permanently deleted gift' });
        }

        const update = { accessEnabled };
        if (accessEnabled) {
            const days = getDurationDaysForPlan(gift.plan);
            const isExpired = gift.expiresAt && new Date(gift.expiresAt) <= new Date();

            if (days && (resetExpiry || isExpired)) {
                const assignedAt = new Date();
                const expiresAt = new Date(assignedAt);
                expiresAt.setDate(expiresAt.getDate() + days);
                update.assignedAt = assignedAt;
                update.expiresAt = expiresAt;
            } else if (days && isExpired && !resetExpiry) {
                return res.status(400).json({ error: 'Gift is expired; set resetExpiry=true to re-grant access' });
            }
        }

        console.log('Admin toggle gift access:', {
            giftId,
            accessEnabled,
            resetExpiry,
            update,
        });

        const updatedGift = await Gift.findByIdAndUpdate(giftId, { $set: update }, { new: true });
        return res.json({ gift: updatedGift });
    } catch (err) {
        console.error('Admin PATCH /gifts/:giftId/access error:', err);
        if (err && (err.name === 'CastError' || err.name === 'ValidationError')) {
            return res.status(400).json({ error: err.message || 'Invalid request' });
        }
        return res.status(500).json({
            error: err?.message || 'Server error',
            name: err?.name,
            // only for local debugging
            stack: process.env.NODE_ENV === 'production' ? undefined : err?.stack,
        });
    }
});

// DELETE /api/admin/gifts/:giftId/permanent - Permanently delete gift assets + tombstone record (admin only)
router.delete('/gifts/:giftId/permanent', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { giftId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(giftId)) {
            return res.status(400).json({ error: 'Invalid giftId' });
        }
        const gift = await Gift.findById(giftId);
        if (!gift) return res.status(404).json({ error: 'Gift not found' });

        // Delete Cloudinary assets (best-effort)
        const photoIds = Array.isArray(gift.photoPublicIds) ? gift.photoPublicIds : [];
        const audioId = gift.audioPublicId;

        const results = [];

        // Delete photos
        for (const pid of photoIds) {
            const result = await cloudinaryDestroy({ publicId: pid, resourceType: 'image' });
            results.push({ type: 'photo', publicId: pid, ...result });
            if (result.ok) {
                console.log(`✓ Deleted photo from Cloudinary: ${pid}`);
            } else {
                console.error(`✗ Failed to delete photo: ${pid}`, result.error);
            }
        }

        // Delete audio
        if (audioId) {
            const result = await cloudinaryDestroy({ publicId: audioId, resourceType: 'video' });
            results.push({ type: 'audio', publicId: audioId, ...result });
            if (result.ok) {
                console.log(`✓ Deleted audio from Cloudinary: ${audioId}`);
            } else {
                console.error(`✗ Failed to delete audio: ${audioId}`, result.error);
            }
        }

        const tombstone = {
            permanentlyDeleted: true,
            deletedAt: new Date(),
            accessEnabled: false,
            photos: [],
            photoPublicIds: [],
            audio: null,
            audioPublicId: null,
        };

        console.log('Admin permanent delete gift:', {
            giftId,
            photoIdsCount: photoIds.length,
            hasAudio: !!audioId,
            cloudinaryResults: results,
        });

        const updatedGift = await Gift.findByIdAndUpdate(giftId, { $set: tombstone }, { new: true });
        return res.json({ ok: true, giftId, gift: updatedGift, cloudinary: results });
    } catch (err) {
        console.error('Admin DELETE /gifts/:giftId/permanent error:', err);
        if (err && (err.name === 'CastError' || err.name === 'ValidationError')) {
            return res.status(400).json({ error: err.message || 'Invalid request' });
        }
        return res.status(500).json({
            error: err?.message || 'Server error',
            name: err?.name,
            stack: process.env.NODE_ENV === 'production' ? undefined : err?.stack,
        });
    }
});

module.exports = router;
