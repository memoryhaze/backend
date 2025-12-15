const crypto = require('crypto');

// Encryption algorithm
const ALGORITHM = 'aes-256-cbc';

/**
 * Get encryption key from environment variable
 * Falls back to a default key for development (not recommended for production)
 */
const getEncryptionKey = () => {
    const key = process.env.ENCRYPTION_SECRET;
    if (!key) {
        console.warn('WARNING: ENCRYPTION_SECRET not set in environment. Using fallback (NOT FOR PRODUCTION!)');
        // Fallback key for development only
        return crypto.scryptSync('fallback-secret-key-do-not-use-in-production', 'salt', 32);
    }
    // Derive a 32-byte key from the secret
    return crypto.scryptSync(key, 'salt', 32);
};

/**
 * Encrypt a user ID
 * @param {string} userId - The user ID to encrypt
 * @returns {string} - The encrypted user ID in format: iv:encryptedData
 */
const encryptUserId = (userId) => {
    try {
        const key = getEncryptionKey();
        const iv = crypto.randomBytes(16); // Initialization vector
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

        let encrypted = cipher.update(userId.toString(), 'utf8', 'hex');
        encrypted += cipher.final('hex');

        // Return IV and encrypted data combined
        return `${iv.toString('hex')}:${encrypted}`;
    } catch (error) {
        console.error('Encryption error:', error);
        throw new Error('Failed to encrypt user ID');
    }
};

/**
 * Decrypt an encrypted user ID
 * @param {string} encryptedData - The encrypted data in format: iv:encryptedData
 * @returns {string} - The decrypted user ID
 */
const decryptUserId = (encryptedData) => {
    try {
        const key = getEncryptionKey();
        const parts = encryptedData.split(':');

        if (parts.length !== 2) {
            throw new Error('Invalid encrypted data format');
        }

        const iv = Buffer.from(parts[0], 'hex');
        const encryptedText = parts[1];

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        console.error('Decryption error:', error);
        throw new Error('Failed to decrypt user ID');
    }
};

module.exports = {
    encryptUserId,
    decryptUserId,
};
