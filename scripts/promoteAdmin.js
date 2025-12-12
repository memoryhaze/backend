require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const promoteAdmin = async (email) => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/memoryhaze');
        console.log('Connected to MongoDB');

        // Find user by email
        const user = await User.findOne({ email });

        if (!user) {
            console.error(`User with email ${email} not found`);
            process.exit(1);
        }

        // Check if already admin
        if (user.isAdmin) {
            console.log(`User ${email} is already an admin`);
            process.exit(0);
        }

        // Promote to admin
        user.isAdmin = true;
        await user.save();

        console.log(`Successfully promoted ${email} to admin`);
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
};

// Get email from command line argument or environment variable
const email = process.argv[2] || process.env.INIT_ADMIN_EMAIL;

if (!email) {
    console.error('Usage: node promoteAdmin.js <email>');
    console.error('Or set INIT_ADMIN_EMAIL in .env file');
    process.exit(1);
}

promoteAdmin(email);
