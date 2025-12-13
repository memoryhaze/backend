const express = require('express');
const router = express.Router();
const Gift = require('../models/Gift');
const authMiddleware = require('../middleware/auth');

// GET /api/gifts - list gifts for the current user
router.get('/', authMiddleware, async (req, res) => {
    try {
        const gifts = await Gift.find({ user: req.user._id })
            .sort({ createdAt: -1 })
            .select('templateId createdAt memory plan');

        return res.json({ gifts });
    } catch (err) {
        console.error('GET /api/gifts error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/gifts/:id - get one gift (must belong to current user)
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const gift = await Gift.findById(req.params.id);
        if (!gift) {
            return res.status(404).json({ error: 'Gift not found' });
        }
        if (String(gift.user) !== String(req.user._id)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        return res.json({ gift });
    } catch (err) {
        console.error('GET /api/gifts/:id error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
