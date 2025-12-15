// Test script to verify Cloudinary deletion functionality
// Run with: node testCloudinaryDeletion.js

require('dotenv').config();
const https = require('https');
const crypto = require('crypto');
const querystring = require('querystring');

console.log('\n=== Cloudinary Deletion Test ===\n');

// Check if credentials are set
const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

console.log('1. Checking Environment Variables:');
console.log(`   CLOUDINARY_CLOUD_NAME: ${cloudName ? '✓ Set' : '✗ Missing'}`);
console.log(`   CLOUDINARY_API_KEY: ${apiKey ? '✓ Set' : '✗ Missing'}`);
console.log(`   CLOUDINARY_API_SECRET: ${apiSecret ? '✓ Set (hidden)' : '✗ Missing'}\n`);

if (!cloudName || !apiKey || !apiSecret) {
    console.error('❌ ERROR: Missing Cloudinary credentials in .env file\n');
    console.log('Please add to backend/.env:');
    console.log('  CLOUDINARY_CLOUD_NAME=dzbmfavt6');
    console.log('  CLOUDINARY_API_KEY=your-api-key');
    console.log('  CLOUDINARY_API_SECRET=your-api-secret\n');
    process.exit(1);
}

// Test deletion function
const testCloudinaryDelete = (publicId, resourceType = 'image') => {
    return new Promise((resolve) => {
        const timestamp = Math.floor(Date.now() / 1000);
        const toSign = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
        const signature = crypto.createHash('sha1').update(toSign).digest('hex');

        const postData = querystring.stringify({
            public_id: publicId,
            timestamp,
            api_key: apiKey,
            signature,
        });

        const path = `/v1_1/${cloudName}/${resourceType}/destroy`;

        console.log(`2. Testing Deletion:`);
        console.log(`   Public ID: ${publicId}`);
        console.log(`   Resource Type: ${resourceType}`);
        console.log(`   API Endpoint: https://api.cloudinary.com${path}\n`);

        const req = https.request(
            {
                hostname: 'api.cloudinary.com',
                method: 'POST',
                path,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(postData),
                },
            },
            (res) => {
                let data = '';
                res.on('data', (chunk) => (data += chunk));
                res.on('end', () => {
                    console.log(`3. Response:`);
                    console.log(`   Status Code: ${res.statusCode}`);
                    try {
                        const parsed = JSON.parse(data || '{}');
                        console.log(`   Response Body:`, JSON.stringify(parsed, null, 2));

                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            console.log('\n✓ SUCCESS: Cloudinary API is working!\n');
                            if (parsed.result === 'not found') {
                                console.log('Note: File not found (which is expected if testing with a fake ID)\n');
                            }
                            resolve({ ok: true, result: parsed });
                        } else {
                            console.log('\n✗ ERROR: Cloudinary API returned an error\n');
                            resolve({ ok: false, error: parsed });
                        }
                    } catch (e) {
                        console.log(`   Raw Response: ${data}`);
                        console.log('\n✗ ERROR: Could not parse response\n');
                        resolve({ ok: false, error: data });
                    }
                });
            }
        );

        req.on('error', (err) => {
            console.log('\n✗ ERROR: Network error');
            console.log(`   ${err.message}\n`);
            resolve({ ok: false, error: err.message });
        })

            ;

        req.write(postData);
        req.end();
    });
};

// Test with a fake public ID (will return "not found" but proves credentials work)
const testPublicId = 'MemoryHaze/test/sample_photo';

console.log('Testing Cloudinary deletion with fake public ID...\n');
testCloudinaryDelete(testPublicId, 'image').then((result) => {
    if (result.ok || (result.result && result.result.result === 'not found')) {
        console.log('='.repeat(50));
        console.log('✓ Cloudinary credentials are VALID and working!');
        console.log('='.repeat(50));
        console.log('\nYour Cloudinary deletion should work.');
        console.log('If it\'s not working, the issue is likely:');
        console.log('  1. Public IDs not being extracted from URLs correctly');
        console.log('  2. Delete button not calling the API');
        console.log('  3. photoPublicIds/audioPublicId fields empty in database\n');
    } else {
        console.log('='.repeat(50));
        console.log('✗ Cloudinary credentials are INVALID');
        console.log('='.repeat(50));
        console.log('\nPlease check your .env file and verify:');
        console.log('  - CLOUDINARY_CLOUD_NAME matches your account');
        console.log('  - CLOUDINARY_API_KEY is correct');
        console.log('  - CLOUDINARY_API_SECRET is correct\n');
    }
});
