const mongoose = require('mongoose');

const GiftSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        templateId: {
            type: String,
            required: true,
            enum: ['minimalist-love', 'grand-anniversary', 'birthday-celebration', 'romantic-evening'],
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
    },
    { timestamps: true }
);

module.exports = mongoose.model('Gift', GiftSchema);
