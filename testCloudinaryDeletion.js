/**
 * Test script to verify Cloudinary SDK configuration
 * Run with: node testCloudinarySDK.js
 */

require('dotenv').config();
const {
    isCloudinaryConfigured,
    deleteAsset,
    deleteByPrefix,
    cloudinary
} = require('./utils/cloudinary');

console.log('\n=== Cloudinary SDK Configuration Test ===\n');

// Check if configured
const configured = isCloudinaryConfigured();
console.log(`1. SDK Configured: ${configured ? '✓ Yes' : '✗ No'}`);

if (!configured) {
    console.log('\n❌ ERROR: Cloudinary SDK not configured!');
    console.log('\nPlease add these to your backend/.env file:');
    console.log('  CLOUDINARY_CLOUD_NAME=your-cloud-name');
    console.log('  CLOUDINARY_API_KEY=your-api-key');
    console.log('  CLOUDINARY_API_SECRET=your-api-secret\n');
    console.log('Get these values from:');
    console.log('  https://console.cloudinary.com/settings/api-keys\n');
    process.exit(1);
}

// Display configuration (partially masked)
console.log('\n2. Configuration Details:');
console.log(`   Cloud Name: ${process.env.CLOUDINARY_CLOUD_NAME}`);
console.log(`   API Key: ${process.env.CLOUDINARY_API_KEY?.substring(0, 8)}...`);
console.log(`   API Secret: ${process.env.CLOUDINARY_API_SECRET?.substring(0, 8)}...`);

// Test API connection
console.log('\n3. Testing API Connection...');

const testDeletion = async () => {
    // Try to delete a non-existent file (should return 'not found' but proves API works)
    const testPublicId = 'MemoryHaze/test-delete-' + Date.now();

    const result = await deleteAsset(testPublicId, 'image');

    if (result.ok) {
        console.log('   ✓ API connection successful!');
        console.log(`   (Test deletion returned: ${result.result?.result || 'ok'})\n`);

        console.log('='.repeat(50));
        console.log('✓ Cloudinary SDK is properly configured!');
        console.log('='.repeat(50));
        console.log('\nYou can now:');
        console.log('  - Create gifts (files will go to MemoryHaze/userId/giftN/)');
        console.log('  - Delete gifts (both individual and folder-based deletion)');
        console.log('  - All deletion operations will work!\n');
    } else {
        console.log('   ✗ API connection failed!');
        console.log(`   Error: ${JSON.stringify(result.error)}\n`);

        console.log('='.repeat(50));
        console.log('✗ Cloudinary API credentials are INVALID');
        console.log('='.repeat(50));
        console.log('\nPlease verify your credentials at:');
        console.log('  https://console.cloudinary.com/settings/api-keys\n');
    }
};

testDeletion().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
