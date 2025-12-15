// Script to check if gifts have proper publicIds stored
// Run with: node checkGiftPublicIds.js

require('dotenv').config();
const mongoose = require('mongoose');
const Gift = require('./models/Gift');

console.log('\n=== Checking Gift Public IDs ===\n');

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error('❌ ERROR: MONGO_URI not found in .env file\n');
    process.exit(1);
}

mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(async () => {
    console.log('✓ Connected to MongoDB\n');

    try {
        // Find recent gifts
        const gifts = await Gift.find({}).sort({ createdAt: -1 }).limit(5);

        console.log(`Found ${gifts.length} recent gifts:\n`);

        gifts.forEach((gift, index) => {
            console.log(`Gift #${index + 1}:`);
            console.log(`  ID: ${gift._id}`);
            console.log(`  Template: ${gift.templateId}`);
            console.log(`  Photos URLs: ${gift.photos?.length || 0} files`);
            console.log(`  Photo Public IDs: ${gift.photoPublicIds?.length || 0} IDs`);
            console.log(`  Audio URL: ${gift.audio ? 'Yes' : 'No'}`);
            console.log(`  Audio Public ID: ${gift.audioPublicId || 'None'}`);

            // Show details
            if (gift.photos && gift.photos.length > 0) {
                console.log(`\n  Photo URLs:`);
                gift.photos.forEach((url, i) => console.log(`    ${i + 1}. ${url.substring(0, 80)}...`));
            }

            if (gift.photoPublicIds && gift.photoPublicIds.length > 0) {
                console.log(`\n  Photo Public IDs:`);
                gift.photoPublicIds.forEach((id, i) => console.log(`    ${i + 1}. ${id}`));
            } else if (gift.photos && gift.photos.length > 0) {
                console.log(`\n  ⚠️  WARNING: Gift has photos but NO photoPublicIds!`);
                console.log(`      This means deletion won't work.`);
                console.log(`      Public IDs should be extracted automatically.`);
            }

            if (gift.audio) {
                console.log(`\n  Audio URL: ${gift.audio.substring(0, 80)}...`);
            }

            if (gift.audioPublicId) {
                console.log(`  Audio Public ID: ${gift.audioPublicId}`);
            } else if (gift.audio) {
                console.log(`\n  ⚠️  WARNING: Gift has audio but NO audioPublicId!`);
            }

            console.log('\n' + '='.repeat(70) + '\n');
        });

        // Summary
        const giftsWithPhotosButNoIds = gifts.filter(g =>
            g.photos && g.photos.length > 0 && (!g.photoPublicIds || g.photoPublicIds.length === 0)
        );

        const giftsWithAudioButNoId = gifts.filter(g =>
            g.audio && !g.audioPublicId
        );

        console.log('Summary:');
        console.log(`  Total gifts checked: ${gifts.length}`);
        console.log(`  Gifts with photos but no publicIds: ${giftsWithPhotosButNoIds.length}`);
        console.log(`  Gifts with audio but no publicId: ${giftsWithAudioButNoId.length}\n`);

        if (giftsWithPhotosButNoIds.length > 0 || giftsWithAudioButNoId.length > 0) {
            console.log('⚠️  ISSUE FOUND!');
            console.log('Some gifts are missing public IDs.');
            console.log('This happens when:');
            console.log('  1. Gifts were created before public ID extraction was added');
            console.log('  2. URL parsing failed (wrong URL format)');
            console.log('  3. Pre-validate hook failed to run\n');
            console.log('Solution: Re-create affected gifts or manually update database.\n');
        } else {
            console.log('✓ All gifts have proper public IDs!');
            console.log('Deletion should work fine.\n');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.connection.close();
        console.log('Disconnected from MongoDB\n');
    }
}).catch(err => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
});
