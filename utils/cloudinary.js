/**
 * Cloudinary SDK Utility Module
 * Handles all Cloudinary operations using the official Node.js SDK
 */

const cloudinary = require('cloudinary').v2;

// Configure Cloudinary with environment variables
const configureCloudinary = () => {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
        console.warn('⚠️ Cloudinary not configured - missing environment variables');
        return false;
    }

    cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true
    });

    return true;
};

// Initialize on module load
const isConfigured = configureCloudinary();

/**
 * Delete a single asset by public ID
 * @param {string} publicId - The public ID of the asset
 * @param {string} resourceType - 'image' | 'video' | 'raw' (default: 'image')
 * @returns {Promise<Object>} - Result object with ok status
 */
const deleteAsset = async (publicId, resourceType = 'image') => {
    if (!isConfigured) {
        return { ok: false, error: 'Cloudinary not configured' };
    }

    if (!publicId) {
        return { ok: true, message: 'No public ID provided' };
    }

    try {
        const result = await cloudinary.uploader.destroy(publicId, {
            resource_type: resourceType,
            invalidate: true // Invalidate CDN cache
        });

        if (result.result === 'ok' || result.result === 'not found') {
            console.log(`✓ Deleted ${resourceType}: ${publicId}`);
            return { ok: true, result };
        } else {
            console.error(`✗ Failed to delete ${resourceType}: ${publicId}`, result);
            return { ok: false, error: result };
        }
    } catch (error) {
        console.error(`✗ Error deleting ${resourceType}: ${publicId}`, error.message);
        return { ok: false, error: error.message };
    }
};

/**
 * Delete multiple assets by public IDs
 * @param {string[]} publicIds - Array of public IDs
 * @param {string} resourceType - 'image' | 'video' | 'raw' (default: 'image')
 * @returns {Promise<Object>} - Result object
 */
const deleteAssets = async (publicIds, resourceType = 'image') => {
    if (!isConfigured) {
        return { ok: false, error: 'Cloudinary not configured' };
    }

    if (!publicIds || publicIds.length === 0) {
        return { ok: true, message: 'No public IDs provided' };
    }

    try {
        const result = await cloudinary.api.delete_resources(publicIds, {
            resource_type: resourceType,
            invalidate: true
        });

        console.log(`✓ Bulk deleted ${publicIds.length} ${resourceType}(s)`);
        return { ok: true, result };
    } catch (error) {
        console.error(`✗ Error bulk deleting ${resourceType}s:`, error.message);
        return { ok: false, error: error.message };
    }
};

/**
 * Delete all assets with a given prefix (folder-based deletion)
 * This is perfect for deleting entire gift folders like "MemoryHaze/usr-00001/gift1/"
 * @param {string} prefix - The prefix/folder path
 * @param {string} resourceType - 'image' | 'video' | 'raw' (default: 'image')
 * @returns {Promise<Object>} - Result object
 */
const deleteByPrefix = async (prefix, resourceType = 'image') => {
    if (!isConfigured) {
        return { ok: false, error: 'Cloudinary not configured' };
    }

    if (!prefix) {
        return { ok: false, error: 'No prefix provided' };
    }

    try {
        const result = await cloudinary.api.delete_resources_by_prefix(prefix, {
            resource_type: resourceType,
            invalidate: true
        });

        console.log(`✓ Deleted all ${resourceType}s with prefix: ${prefix}`);
        return { ok: true, result };
    } catch (error) {
        console.error(`✗ Error deleting by prefix ${prefix}:`, error.message);
        return { ok: false, error: error.message };
    }
};

/**
 * Delete an entire gift folder (both images and audio)
 * This uses prefix-based deletion to remove all files in a gift folder
 * @param {string} folderPath - The folder path like "MemoryHaze/usr-00001/gift1"
 * @returns {Promise<Object>} - Combined result for images and audio
 */
const deleteGiftFolder = async (folderPath) => {
    if (!isConfigured) {
        return { ok: false, error: 'Cloudinary not configured' };
    }

    if (!folderPath) {
        return { ok: false, error: 'No folder path provided' };
    }

    console.log(`🗑️ Deleting gift folder: ${folderPath}`);

    const results = {
        images: null,
        videos: null,
        ok: true
    };

    try {
        // Delete all images in the folder
        results.images = await deleteByPrefix(folderPath, 'image');

        // Delete all videos/audio in the folder (audio is stored as 'video' type)
        results.videos = await deleteByPrefix(folderPath, 'video');

        // Check if any deletion failed
        if (!results.images.ok && results.images.error !== 'Cloudinary not configured') {
            results.ok = false;
        }
        if (!results.videos.ok && results.videos.error !== 'Cloudinary not configured') {
            results.ok = false;
        }

        if (results.ok) {
            console.log(`✓ Successfully deleted gift folder: ${folderPath}`);
        }

        return results;
    } catch (error) {
        console.error(`✗ Error deleting gift folder ${folderPath}:`, error.message);
        return { ok: false, error: error.message };
    }
};

/**
 * Delete specific gift assets by their public IDs
 * @param {string[]} photoPublicIds - Array of photo public IDs
 * @param {string|null} audioPublicId - Audio public ID (optional)
 * @returns {Promise<Object>} - Combined results
 */
const deleteGiftAssets = async (photoPublicIds = [], audioPublicId = null) => {
    if (!isConfigured) {
        return { ok: false, error: 'Cloudinary not configured' };
    }

    const results = {
        photos: [],
        audio: null,
        ok: true
    };

    // Delete photos
    for (const photoId of photoPublicIds) {
        const result = await deleteAsset(photoId, 'image');
        results.photos.push({ publicId: photoId, ...result });
        if (!result.ok) {
            results.ok = false;
        }
    }

    // Delete audio (audio files are stored as 'video' resource type)
    if (audioPublicId) {
        results.audio = await deleteAsset(audioPublicId, 'video');
        if (!results.audio.ok) {
            results.ok = false;
        }
    }

    return results;
};

/**
 * Get folder path from a public ID
 * @param {string} publicId - e.g., "MemoryHaze/usr-00001/gift1/photo_1"
 * @returns {string} - e.g., "MemoryHaze/usr-00001/gift1"
 */
const getFolderFromPublicId = (publicId) => {
    if (!publicId) return null;
    const parts = publicId.split('/');
    if (parts.length >= 3) {
        return parts.slice(0, -1).join('/');
    }
    return null;
};

/**
 * Check if Cloudinary is properly configured
 * @returns {boolean}
 */
const isCloudinaryConfigured = () => isConfigured;

module.exports = {
    cloudinary,
    deleteAsset,
    deleteAssets,
    deleteByPrefix,
    deleteGiftFolder,
    deleteGiftAssets,
    getFolderFromPublicId,
    isCloudinaryConfigured
};
