/**
 * Migration Script: Update existing gifts with new schema fields
 * 
 * Run with: node migrateGiftsSchema.js
 * 
 * This script:
 * 1. Sets status='completed' for existing gifts (they were already created by admin)
 * 2. Sets completedAt from assignedAt or createdAt
 * 3. Syncs occasion field from memory field
 * 4. Adds default values for new required fields
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/memoryhaze';

console.log('\n=== Gift Schema Migration Script ===\n');

async function migrate() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✓ Connected to MongoDB\n');

        const Gift = mongoose.model('Gift', new mongoose.Schema({}, { strict: false }));

        // Find gifts that need migration (no status field or old schema)
        const giftsToUpdate = await Gift.find({
            $or: [
                { status: { $exists: false } },
                { status: null },
                { status: '' }
            ]
        });

        console.log(`Found ${giftsToUpdate.length} gifts to migrate\n`);

        if (giftsToUpdate.length === 0) {
            console.log('✓ All gifts already migrated!\n');
            return;
        }

        let updated = 0;
        let errors = 0;

        for (const gift of giftsToUpdate) {
            try {
                const update = {
                    status: 'completed',
                    completedAt: gift.assignedAt || gift.createdAt || new Date(),
                    accessEnabled: gift.accessEnabled !== false,
                };

                // Sync occasion from memory if not set
                if (!gift.occasion && gift.memory) {
                    update.occasion = gift.memory;
                }

                // Add default recipientName if missing
                if (!gift.recipientName) {
                    update.recipientName = 'Recipient';
                }

                // Add default occasionDate if missing
                if (!gift.occasionDate) {
                    update.occasionDate = gift.assignedAt || gift.createdAt || new Date();
                }

                // Add default songGenre if missing
                if (!gift.songGenre) {
                    update.songGenre = 'pop';
                }

                // Ensure plan has valid value
                if (!gift.plan || !['momentum', 'everlasting'].includes(gift.plan)) {
                    update.plan = 'momentum';
                }

                await Gift.updateOne(
                    { _id: gift._id },
                    { $set: update }
                );

                updated++;
                console.log(`  ✓ Migrated gift: ${gift._id}`);

            } catch (err) {
                errors++;
                console.error(`  ✗ Failed to migrate gift ${gift._id}:`, err.message);
            }
        }

        console.log(`\n--- Migration Summary ---`);
        console.log(`Total gifts found: ${giftsToUpdate.length}`);
        console.log(`Successfully migrated: ${updated}`);
        console.log(`Errors: ${errors}\n`);

        if (errors === 0) {
            console.log('✓ Migration completed successfully!\n');
        } else {
            console.log('⚠️ Migration completed with some errors.\n');
        }

    } catch (error) {
        console.error('Migration error:', error.message);
    } finally {
        await mongoose.connection.close();
        console.log('Disconnected from MongoDB\n');
    }
}

migrate();
