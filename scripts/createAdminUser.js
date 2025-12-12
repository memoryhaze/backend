require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

const createAdminUser = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/memoryhaze');
        console.log('Connected to MongoDB');

        const email = 'admin@memoryhaze.com';
        const password = 'admin123';

        // Check if user exists
        let user = await User.findOne({ email });

        if (user) {
            console.log('User already exists, updating...');
        } else {
            console.log('Creating new admin user...');
            user = new User({
                name: 'Admin',
                email: email,
                password: 'temp',
                isVerified: true
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);
        user.isAdmin = true;
        user.isVerified = true;

        await user.save();

        console.log('\n✅ Admin user created/updated successfully!');
        console.log('Email:', email);
        console.log('Password:', password);
        console.log('isAdmin:', user.isAdmin);
        console.log('\nUse these credentials to login and access /admin');

        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
};

createAdminUser();
