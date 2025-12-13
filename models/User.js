const mongoose = require('mongoose');
const Counter = require('./Counter');

const UserSchema = new mongoose.Schema({
    userId: {
        type: String,
        unique: true,
        index: true,
    },
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
    otp: {
        type: String,
        default: null,
    },
    otpExpiry: {
        type: Date,
        default: null,
    },
    isVerified: {
        type: Boolean,
        default: false,
    },
    isAdmin: {
        type: Boolean,
        default: false,
    },
    scenarios: {
        type: [String],
        default: [],
    },
    memory: {
        type: String,
        enum: ['birthday', 'anniversary', 'valentines'],
        default: null,
    },
    plan: {
        type: String,
        enum: ['momentum', 'everlasting'],
        default: null,
    },
    photos: {
        type: [String],
        default: [],
    },
    audio: {
        type: String,
        default: null,
    },
    lyrics: {
        type: String,
        default: '',
    },
}, { timestamps: true });

UserSchema.pre('validate', async function (next) {
    try {
        if (this.userId) return next();
        if (!this.isNew) return next();

        const counter = await Counter.findOneAndUpdate(
            { name: 'user' },
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
        );

        const padded = String(counter.seq).padStart(5, '0');
        this.userId = `usr-${padded}`;
        return next();
    } catch (err) {
        return next(err);
    }
});

module.exports = mongoose.model('User', UserSchema);
