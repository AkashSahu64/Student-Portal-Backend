const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User'); // adjust the path if your model is elsewhere

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB');

    const adminEmail = "aakashsahu6444@gmail.com";

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: adminEmail });
    if (existingAdmin) {
      console.log('⚠️ Admin already exists');
      process.exit(0);
    }

    // Create new admin
    const newAdmin = new User({
      name: "Akash Sahu",
      email: adminEmail,
      password: "admin123",  // Plain password; will be hashed automatically
      role: "admin",
      isVerified: true
    });

    await newAdmin.save();
    console.log('✅ Admin user created successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

createAdmin();
