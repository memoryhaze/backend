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
const {
    deleteGiftAssets,
    deleteGiftFolder,
    deleteByPrefix,
    getFolderFromPublicId,
    isCloudinaryConfigured
} = require('../utils/cloudinary');

const getDurationDaysForPlan = (plan) => {
    if (plan === 'momentum') return 7;
    if (plan === 'everlasting') return 14;
    return null;
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

        // Check if Cloudinary is configured
        if (!isCloudinaryConfigured()) {
            console.warn('⚠️ Cloudinary not configured - skipping file deletion');
        }

        // Get asset IDs
        const photoIds = Array.isArray(gift.photoPublicIds) ? gift.photoPublicIds : [];
        const audioId = gift.audioPublicId;

        console.log('🗑️ Starting permanent gift deletion:', {
            giftId,
            photoIds,
            audioId
        });

        let cloudinaryResults = { ok: true, photos: [], audio: null };

        // Try to delete using the SDK
        if (isCloudinaryConfigured()) {
            // Method 1: Delete by individual public IDs
            cloudinaryResults = await deleteGiftAssets(photoIds, audioId);

            // Method 2: Also try folder-based deletion as backup
            // This ensures all files in the gift folder are removed
            if (photoIds.length > 0) {
                const folderPath = getFolderFromPublicId(photoIds[0]);
                if (folderPath) {
                    console.log(`📁 Also deleting entire folder: ${folderPath}`);
                    await deleteGiftFolder(folderPath);
                }
            }
        }

        // Create tombstone record
        const tombstone = {
            permanentlyDeleted: true,
            deletedAt: new Date(),
            accessEnabled: false,
            photos: [],
            photoPublicIds: [],
            audio: null,
            audioPublicId: null,
        };

        console.log('✓ Admin permanent delete completed:', {
            giftId,
            photoIdsCount: photoIds.length,
            hasAudio: !!audioId,
            cloudinarySuccess: cloudinaryResults.ok,
        });

        const updatedGift = await Gift.findByIdAndUpdate(giftId, { $set: tombstone }, { new: true });
        return res.json({ ok: true, giftId, gift: updatedGift, cloudinary: cloudinaryResults });
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

// ===== GIFT REQUEST MANAGEMENT ENDPOINTS =====

// GET /api/admin/requests - Get all gift requests with filtering and pagination
router.get('/requests', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { status = 'all', page = 1, limit = 10, search = '' } = req.query;

        // Build query
        const query = { permanentlyDeleted: { $ne: true } };

        if (status !== 'all') {
            query.status = status;
        }

        // Calculate pagination
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        // Get total count
        const total = await Gift.countDocuments(query);

        // Get requests with user info
        const requests = await Gift.find(query)
            .populate('user', 'email userId')
            .sort({ submittedAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .select('user recipientName occasion occasionDate songGenre scenarios photos plan message status submittedAt verifiedAt completedAt');

        // Format response
        const formattedRequests = requests.map(req => ({
            _id: req._id,
            user: req.user ? {
                _id: req.user._id,
                email: req.user.email,
                userId: req.user.userId,
            } : null,
            recipientName: req.recipientName,
            occasion: req.occasion,
            occasionDate: req.occasionDate,
            songGenre: req.songGenre,
            scenarios: req.scenarios,
            photos: req.photos,
            plan: req.plan,
            message: req.message,
            status: req.status,
            submittedAt: req.submittedAt,
            verifiedAt: req.verifiedAt,
            completedAt: req.completedAt,
        }));

        res.json({
            requests: formattedRequests,
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum),
        });
    } catch (err) {
        console.error('Admin GET /requests error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/admin/requests/stats - Get request counts by status
router.get('/requests/stats', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const stats = await Gift.aggregate([
            { $match: { permanentlyDeleted: { $ne: true } } },
            { $group: { _id: '$status', count: { $sum: 1 } } },
        ]);

        const counts = {
            pending: 0,
            verified: 0,
            completed: 0,
            rejected: 0,
            total: 0,
        };

        stats.forEach(s => {
            if (s._id && counts.hasOwnProperty(s._id)) {
                counts[s._id] = s.count;
            }
            counts.total += s.count;
        });

        res.json(counts);
    } catch (err) {
        console.error('Admin GET /requests/stats error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/admin/requests/:requestId - Get single request details
router.get('/requests/:requestId', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { requestId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(requestId)) {
            return res.status(400).json({ error: 'Invalid request ID' });
        }

        const request = await Gift.findById(requestId)
            .populate('user', 'email userId name');

        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }

        res.json({ request });
    } catch (err) {
        console.error('Admin GET /requests/:requestId error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PATCH /api/admin/requests/:requestId/verify - Verify a pending request
router.patch('/requests/:requestId/verify', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { requestId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(requestId)) {
            return res.status(400).json({ error: 'Invalid request ID' });
        }

        const request = await Gift.findById(requestId);
        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }

        if (request.status !== 'pending') {
            return res.status(400).json({
                error: `Cannot verify request with status '${request.status}'`
            });
        }

        request.status = 'verified';
        request.verifiedAt = new Date();
        await request.save();

        console.log('Request verified:', requestId);

        res.json({
            success: true,
            message: 'Request verified successfully',
            request: {
                _id: request._id,
                status: request.status,
                verifiedAt: request.verifiedAt,
            }
        });
    } catch (err) {
        console.error('Admin PATCH /requests/:requestId/verify error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PATCH /api/admin/requests/:requestId/reject - Reject a request and delete Cloudinary files
router.patch('/requests/:requestId/reject', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { requestId } = req.params;
        const { reason } = req.body || {};

        if (!mongoose.Types.ObjectId.isValid(requestId)) {
            return res.status(400).json({ error: 'Invalid request ID' });
        }

        const request = await Gift.findById(requestId);
        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }

        if (request.status === 'completed') {
            return res.status(400).json({
                error: 'Cannot reject a completed gift'
            });
        }

        // Delete Cloudinary files
        let cloudinaryResults = { ok: true };
        if (isCloudinaryConfigured()) {
            const photoIds = Array.isArray(request.photoPublicIds) ? request.photoPublicIds : [];
            const audioId = request.audioPublicId;

            cloudinaryResults = await deleteGiftAssets(photoIds, audioId);

            // Also try folder deletion
            if (photoIds.length > 0) {
                const folderPath = getFolderFromPublicId(photoIds[0]);
                if (folderPath) {
                    await deleteGiftFolder(folderPath);
                }
            }
        }

        request.status = 'rejected';
        request.rejectedAt = new Date();
        request.rejectionReason = reason || 'Request was rejected by admin';
        request.photos = [];
        request.photoPublicIds = [];
        request.audio = null;
        request.audioPublicId = null;
        await request.save();

        console.log('Request rejected:', requestId, 'Files deleted:', cloudinaryResults.ok);

        res.json({
            success: true,
            message: 'Request rejected and files deleted',
            cloudinary: cloudinaryResults,
        });
    } catch (err) {
        console.error('Admin PATCH /requests/:requestId/reject error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PATCH /api/admin/requests/:requestId/complete - Complete a verified request (add audio + lyrics)
router.patch('/requests/:requestId/complete', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { requestId } = req.params;
        const { audio, audioPublicId, lyrics } = req.body || {};

        if (!mongoose.Types.ObjectId.isValid(requestId)) {
            return res.status(400).json({ error: 'Invalid request ID' });
        }

        const request = await Gift.findById(requestId).populate('user', 'email');
        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }

        if (request.status !== 'verified') {
            return res.status(400).json({
                error: `Can only complete verified requests. Current status: '${request.status}'`
            });
        }

        if (!audio) {
            return res.status(400).json({ error: 'Audio file is required to complete the gift' });
        }

        if (!lyrics || lyrics.trim() === '') {
            return res.status(400).json({ error: 'Lyrics are required to complete the gift' });
        }

        // Update request to completed
        request.status = 'completed';
        request.completedAt = new Date();
        request.audio = audio;
        request.audioPublicId = audioPublicId || null;
        request.lyrics = lyrics.trim();
        request.accessEnabled = true;

        // Calculate expiration based on plan
        const days = getDurationDaysForPlan(request.plan);
        if (days) {
            const expiresAt = new Date(request.completedAt);
            expiresAt.setDate(expiresAt.getDate() + days);
            request.expiresAt = expiresAt;
        }

        await request.save();

        console.log('Request completed:', {
            requestId,
            userId: request.user._id,
            expiresAt: request.expiresAt,
        });

        // Send notification email
        try {
            const encryptedUserId = encryptUserId(request.user._id.toString());
            await sendGiftNotificationEmail({
                to: request.user.email,
                giftId: request._id.toString(),
                encryptedUserId,
                occasion: request.occasion || 'special',
                recipientName: request.recipientName,
            });
            console.log(`Gift notification email sent to ${request.user.email}`);
        } catch (emailError) {
            console.error('Failed to send gift notification email:', emailError.message);
            // Don't fail the request if email fails
        }

        res.json({
            success: true,
            message: 'Gift created successfully! User has been notified.',
            gift: {
                _id: request._id,
                status: request.status,
                completedAt: request.completedAt,
                expiresAt: request.expiresAt,
            }
        });
    } catch (err) {
        console.error('Admin PATCH /requests/:requestId/complete error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;

