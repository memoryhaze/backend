const mongoose = require('mongoose');

const getDurationDaysForPlan = (plan) => {
    if (plan === 'momentum') return 7;
    if (plan === 'everlasting') return 14;
    return null;
};

const parseCloudinaryPublicIdFromUrl = (url) => {
    if (!url || typeof url !== 'string') return null;
    try {
        const marker = '/upload/';
        const idx = url.indexOf(marker);
        if (idx === -1) return null;
        let rest = url.slice(idx + marker.length);
        // strip optional version segment: v123456/
        rest = rest.replace(/^v\d+\//, '');
        // remove querystring
        rest = rest.split('?')[0];
        // remove file extension
        rest = rest.replace(/\.[a-zA-Z0-9]+$/, '');
        return rest || null;
    } catch {
        return null;
    }
};

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
            enum: ['minimalist-love', 'grand-anniversary', 'birthday-celebration'],
        },
        scenarios: {
            type: [String],
            default: [],
        },
        memory: {
            type: String,
            enum: ['birthday', 'anniversary', 'valentines', null],
            default: null,
        },
        plan: {
            type: String,
            enum: ['momentum', 'everlasting', null],
            default: null,
        },
        assignedAt: {
            type: Date,
            default: Date.now,
        },
        expiresAt: {
            type: Date,
            default: null,
            index: true,
        },
        accessEnabled: {
            type: Boolean,
            default: true,
            index: true,
        },
        permanentlyDeleted: {
            type: Boolean,
            default: false,
            index: true,
        },
        deletedAt: {
            type: Date,
            default: null,
        },
        photos: {
            type: [String],
            default: [],
        },
        photoPublicIds: {
            type: [String],
            default: [],
        },
        audio: {
            type: String,
            default: null,
        },
        audioPublicId: {
            type: String,
            default: null,
        },
        lyrics: {
            type: String,
            default: '',
        },
        message: {
            type: String,
            default: '',
        },
    },
    { timestamps: true }
);

GiftSchema.pre('validate', async function () {
    // Backwards compatibility: older records may have empty strings
    if (this.plan === '') this.plan = null;
    if (this.memory === '') this.memory = null;

    // Compute expiresAt from assignedAt + plan duration
    const days = getDurationDaysForPlan(this.plan);
    if (days && this.assignedAt && !this.expiresAt) {
        const d = new Date(this.assignedAt);
        d.setDate(d.getDate() + days);
        this.expiresAt = d;
    }

    // Derive Cloudinary public IDs from URLs if not provided
    if (Array.isArray(this.photos) && (!Array.isArray(this.photoPublicIds) || this.photoPublicIds.length === 0)) {
        this.photoPublicIds = this.photos.map(parseCloudinaryPublicIdFromUrl).filter(Boolean);
    }
    if (this.audio && !this.audioPublicId) {
        this.audioPublicId = parseCloudinaryPublicIdFromUrl(this.audio);
    }
    // No need to call next() with async function - Mongoose 9.x handles this automatically
});

GiftSchema.methods.isExpired = function () {
    if (!this.expiresAt) return false;
    return new Date() > new Date(this.expiresAt);
};

module.exports = mongoose.model('Gift', GiftSchema);
