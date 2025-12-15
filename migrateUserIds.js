/**
 * Migration Script: Add userId to existing users who don't have one
 * Run this ONCE with: node migrateUserIds.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Counter = require('./models/Counter');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/memoryhaze';

console.log('\n=== User ID Migration Script ===\n');
console.log('Connecting to:', MONGO_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));

async function migrate() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✓ Connected to MongoDB\n');

        // Find users without userId
        const usersWithoutId = await User.find({
            $or: [
                { userId: { $exists: false } },
                { userId: null },
                { userId: '' }
            ]
        });

        console.log(`Found ${usersWithoutId.length} users without userId\n`);

        if (usersWithoutId.length === 0) {
            console.log('✓ All users already have userId assigned!\n');
            return;
        }

        // Get or create counter
        let counter = await Counter.findOne({ name: 'user' });
        if (!counter) {
            counter = await Counter.create({ name: 'user', seq: 0 });
        }

        console.log(`Current counter value: ${counter.seq}`);
        console.log('Assigning userIds...\n');

        for (const user of usersWithoutId) {
            const newCounter = await Counter.findOneAndUpdate(
                { name: 'user' },
                { $inc: { seq: 1 } },
                { new: true }
            );

            const padded = String(newCounter.seq).padStart(5, '0');
            const newUserId = `usr-${padded}`;

            await User.findByIdAndUpdate(user._id, { userId: newUserId });
            console.log(`  ✓ ${user.email} → ${newUserId}`);
        }

        console.log(`\n✓ Successfully migrated ${usersWithoutId.length} users!\n`);

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await mongoose.connection.close();
        console.log('Disconnected from MongoDB\n');
    }
}

migrate();
