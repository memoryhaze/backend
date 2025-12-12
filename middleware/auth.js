const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to verify JWT token and load user
const authMiddleware = async (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');

        // Load full user from database
        const user = await User.findById(decoded.user.id).select('-password -otp -otpExpiry');

        if (!user) {
            return res.status(401).json({ msg: 'User not found' });
        }

        req.user = user;
        next();
    } catch (err) {
        res.status(401).json({ msg: 'Token is not valid' });
    }
};

module.exports = authMiddleware;
