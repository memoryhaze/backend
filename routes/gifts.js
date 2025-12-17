const express = require('express');
const router = express.Router();
const Gift = require('../models/Gift');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const { decryptUserId } = require('../utils/encryption');

const autoExpireGiftsForUser = async (userId) => {
    const now = new Date();
    // Flip accessEnabled off for gifts that have passed expiresAt.
    await Gift.updateMany(
        {
            user: userId,
            permanentlyDeleted: { $ne: true },
            accessEnabled: true,
            expiresAt: { $ne: null, $lte: now },
        },
        { $set: { accessEnabled: false } }
    );
};

// POST /api/gifts/request - User submits a gift request
router.post('/request', authMiddleware, async (req, res) => {
    try {
        const {
            recipientName,
            occasion,
            occasionDate,
            scenarios,
            songGenre,
            photos,
            photoPublicIds,
            plan,
            message,
        } = req.body;

        // Validation
        if (!recipientName || !occasion || !occasionDate || !songGenre || !plan) {
            return res.status(400).json({
                error: 'Missing required fields',
                details: 'recipientName, occasion, occasionDate, songGenre, and plan are required'
            });
        }

        if (!photos || !Array.isArray(photos) || photos.length === 0) {
            return res.status(400).json({
                error: 'At least one photo is required'
            });
        }

        if (photos.length > 4) {
            return res.status(400).json({
                error: 'Maximum 4 photos allowed'
            });
        }

        if (!scenarios || !Array.isArray(scenarios) || scenarios.length < 3) {
            return res.status(400).json({
                error: 'All 3 scenarios are required'
            });
        }

        // Validate each scenario has at least 150 characters
        for (let i = 0; i < scenarios.length; i++) {
            if (!scenarios[i] || scenarios[i].trim().length < 150) {
                return res.status(400).json({
                    error: `Scenario ${i + 1} must be at least 150 characters long`
                });
            }
        }

        // Validate occasion date is in the future
        const dateObj = new Date(occasionDate);
        if (isNaN(dateObj.getTime())) {
            return res.status(400).json({ error: 'Invalid occasion date' });
        }

        // Create gift request
        const gift = new Gift({
            user: req.user._id,
            recipientName: recipientName.trim(),
            occasion,
            occasionDate: dateObj,
            scenarios: scenarios.slice(0, 3), // Max 3 scenarios
            songGenre: songGenre.trim(),
            photos,
            photoPublicIds: photoPublicIds || [],
            plan,
            message: message?.trim() || '',
            status: 'pending',
            submittedAt: new Date(),
        });

        await gift.save();

        console.log('Gift request created:', {
            giftId: gift._id,
            userId: req.user._id,
            recipientName: gift.recipientName,
            occasion: gift.occasion,
            status: gift.status,
        });

        return res.status(201).json({
            success: true,
            message: 'Gift request submitted successfully! We will review your order and notify you once it\'s ready.',
            gift: {
                _id: gift._id,
                recipientName: gift.recipientName,
                occasion: gift.occasion,
                occasionDate: gift.occasionDate,
                status: gift.status,
                submittedAt: gift.submittedAt,
            }
        });

    } catch (err) {
        console.error('POST /api/gifts/request error:', err);

        if (err.name === 'ValidationError') {
            const details = Object.values(err.errors).map(e => ({
                field: e.path,
                message: e.message
            }));
            return res.status(400).json({ error: 'Validation failed', details });
        }

        return res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/gifts - list gifts for the current user
router.get('/', authMiddleware, async (req, res) => {
    try {
        await autoExpireGiftsForUser(req.user._id);
        const gifts = await Gift.find({ user: req.user._id })
            .sort({ createdAt: -1 })
            .select('templateId recipientName occasion occasionDate plan status submittedAt completedAt expiresAt accessEnabled permanentlyDeleted deletedAt');

        return res.json({ gifts });
    } catch (err) {
        console.error('GET /api/gifts error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/gifts/:id/:encryptedUserId - Secure gift access with encrypted user ID validation
// This endpoint is used when users click the email link to view their gift
router.get('/:id/:encryptedUserId', authMiddleware, async (req, res) => {
    try {
        const { id: giftId, encryptedUserId } = req.params;

        // Step 1: Decrypt the user ID from the URL
        let intendedUserId;
        try {
            intendedUserId = decryptUserId(decodeURIComponent(encryptedUserId));
        } catch (decryptError) {
            console.error('Decryption error:', decryptError.message);
            return res.status(400).json({
                error: 'Invalid gift link',
                message: 'The link you used appears to be corrupted or invalid. Please request a new gift link.'
            });
        }

        // Step 2: Verify the logged-in user matches the intended recipient
        if (String(req.user._id) !== String(intendedUserId)) {
            return res.status(403).json({
                error: 'Access denied',
                message: 'This gift is not intended for you. It can only be viewed by the recipient it was created for.',
                intendedForDifferentUser: true
            });
        }

        // Step 3: Auto-expire gifts if needed
        await autoExpireGiftsForUser(req.user._id);

        // Step 4: Fetch the gift
        const gift = await Gift.findById(giftId);
        if (!gift) {
            return res.status(404).json({
                error: 'Gift not found',
                message: 'This gift could not be found. It may have been removed.'
            });
        }

        // Step 5: Verify ownership again (extra security)
        if (String(gift.user) !== String(req.user._id)) {
            return res.status(403).json({
                error: 'Access denied',
                message: 'This gift does not belong to you.'
            });
        }

        // Step 6: Check if gift is permanently deleted
        if (gift.permanentlyDeleted) {
            return res.status(403).json({
                error: 'Gift permanently deleted',
                message: 'This gift has been permanently deleted and is no longer available.'
            });
        }

        // Step 7: Check if gift access is enabled
        if (!gift.accessEnabled) {
            return res.status(403).json({
                error: 'Gift access disabled',
                message: 'Access to this gift has been disabled.'
            });
        }

        // Step 8: Check if gift has expired
        if (gift.expiresAt && new Date() > new Date(gift.expiresAt)) {
            gift.accessEnabled = false;
            await gift.save();
            return res.status(403).json({
                error: 'Gift access expired',
                message: 'This gift has expired and is no longer accessible.'
            });
        }

        // All validations passed - return the gift!
        return res.json({ gift, validated: true });
    } catch (err) {
        console.error('GET /api/gifts/:id/:encryptedUserId error:', err);
        return res.status(500).json({
            error: 'Server error',
            message: 'An unexpected error occurred while accessing the gift.'
        });
    }
});

// GET /api/gifts/:id - get one gift (must belong to current user)
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        await autoExpireGiftsForUser(req.user._id);
        const gift = await Gift.findById(req.params.id);
        if (!gift) {
            return res.status(404).json({ error: 'Gift not found' });
        }
        if (String(gift.user) !== String(req.user._id)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (gift.permanentlyDeleted) {
            return res.status(403).json({ error: 'Gift permanently deleted' });
        }
        if (!gift.accessEnabled) {
            return res.status(403).json({ error: 'Gift access expired' });
        }
        if (gift.expiresAt && new Date() > new Date(gift.expiresAt)) {
            // Defensive: if expiresAt has passed but access wasn't flipped yet.
            gift.accessEnabled = false;
            await gift.save();
            return res.status(403).json({ error: 'Gift access expired' });
        }
        return res.json({ gift });
    } catch (err) {
        console.error('GET /api/gifts/:id error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
