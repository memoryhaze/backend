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

// Map occasion to template
const getTemplateFromOccasion = (occasion) => {
    switch (occasion) {
        case 'birthday':
            return 'birthday-celebration';
        case 'anniversary':
            return 'grand-anniversary';
        case 'valentines':
            return 'minimalist-love';
        default:
            return 'birthday-celebration';
    }
};

const GiftSchema = new mongoose.Schema(
    {
        // User who submitted the request
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },

        // ===== USER-SUBMITTED FIELDS (from landing page form) =====

        // Recipient information
        recipientName: {
            type: String,
            required: true,
            trim: true,
        },

        // Occasion details
        occasion: {
            type: String,
            enum: ['birthday', 'anniversary', 'valentines'],
            required: true,
        },
        occasionDate: {
            type: Date,
            required: true,
        },

        // Template (auto-derived from occasion)
        templateId: {
            type: String,
            enum: ['minimalist-love', 'grand-anniversary', 'birthday-celebration'],
        },

        // Song customization
        scenarios: {
            type: [String],
            default: [],
            validate: {
                validator: function (v) {
                    return v.length <= 3;
                },
                message: 'Maximum 3 scenarios allowed'
            }
        },
        songGenre: {
            type: String,
            required: true,
            trim: true,
        },

        // Photos (uploaded by user)
        photos: {
            type: [String],
            default: [],
        },
        photoPublicIds: {
            type: [String],
            default: [],
        },

        // Plan selection
        plan: {
            type: String,
            enum: ['momentum', 'everlasting'],
            required: true,
        },

        // Personal message from user
        message: {
            type: String,
            default: '',
            trim: true,
        },

        // ===== ADMIN-ADDED FIELDS (during gift completion) =====

        // Audio (uploaded by admin)
        audio: {
            type: String,
            default: null,
        },
        audioPublicId: {
            type: String,
            default: null,
        },

        // Lyrics (written by admin)
        lyrics: {
            type: String,
            default: '',
        },

        // ===== STATUS & WORKFLOW FIELDS =====

        // Request status
        status: {
            type: String,
            enum: ['pending', 'verified', 'rejected', 'completed'],
            default: 'pending',
            index: true,
        },

        // Timestamps for workflow
        submittedAt: {
            type: Date,
            default: Date.now,
        },
        verifiedAt: {
            type: Date,
            default: null,
        },
        completedAt: {
            type: Date,
            default: null,
        },
        rejectedAt: {
            type: Date,
            default: null,
        },
        rejectionReason: {
            type: String,
            default: null,
        },

        // Gift access control
        expiresAt: {
            type: Date,
            default: null,
            index: true,
        },
        accessEnabled: {
            type: Boolean,
            default: false, // Changed to false - only enabled after completion
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

        // ===== LEGACY FIELD (for backwards compatibility) =====
        memory: {
            type: String,
            enum: ['birthday', 'anniversary', 'valentines', null],
            default: null,
        },
    },
    { timestamps: true }
);

// Pre-validate hook
GiftSchema.pre('validate', async function () {
    // Backwards compatibility
    if (this.plan === '') this.plan = null;
    if (this.occasion === '') this.occasion = null;

    // Auto-derive templateId from occasion
    if (this.occasion && !this.templateId) {
        this.templateId = getTemplateFromOccasion(this.occasion);
    }

    // Sync memory with occasion for backwards compatibility
    if (this.occasion && !this.memory) {
        this.memory = this.occasion;
    }

    // Compute expiresAt when gift is completed
    if (this.status === 'completed' && this.completedAt && !this.expiresAt) {
        const days = getDurationDaysForPlan(this.plan);
        if (days) {
            const d = new Date(this.completedAt);
            d.setDate(d.getDate() + days);
            this.expiresAt = d;
        }
    }

    // Derive Cloudinary public IDs from URLs if not provided
    if (Array.isArray(this.photos) && (!Array.isArray(this.photoPublicIds) || this.photoPublicIds.length === 0)) {
        this.photoPublicIds = this.photos.map(parseCloudinaryPublicIdFromUrl).filter(Boolean);
    }
    if (this.audio && !this.audioPublicId) {
        this.audioPublicId = parseCloudinaryPublicIdFromUrl(this.audio);
    }
});

// Check if gift is expired
GiftSchema.methods.isExpired = function () {
    if (!this.expiresAt) return false;
    return new Date() > new Date(this.expiresAt);
};

// Check if gift is viewable
GiftSchema.methods.isViewable = function () {
    return this.status === 'completed' &&
        this.accessEnabled &&
        !this.permanentlyDeleted &&
        !this.isExpired();
};

module.exports = mongoose.model('Gift', GiftSchema);
