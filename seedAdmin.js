const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const dotenv = require('dotenv');

dotenv.config();

const seedAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/memoryhaze');
        console.log('MongoDB connected');

        const adminEmail = 'team.memoryhaze@gmail.com';
        const existingAdmin = await User.findOne({ email: adminEmail });

        if (existingAdmin) {
            console.log('Admin user already exists');
        } else {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('admin123', salt); // Default password

            const admin = new User({
                name: 'Admin',
                email: adminEmail,
                password: hashedPassword,
                // role: 'admin' // If role field is added later
            });

            await admin.save();
            console.log('Admin user created successfully');
            console.log('Email: team.memoryhaze@gmail.com');
            console.log('Password: admin123');
        }

        mongoose.disconnect();
    } catch (error) {
        console.error('Error seeding admin:', error);
        process.exit(1);
    }
};

seedAdmin();
