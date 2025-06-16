const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please add an email'],
      unique: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please add a valid email',
      ],
    },
    phone: {
      type: String,
      match: [/^[0-9]{10}$/, 'Please add a valid 10-digit phone number'],
    },
    rollNumber: {
      type: String,
      sparse: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Please add a password'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    role: {
      type: String,
      enum: ['student', 'teacher', 'admin'],
      default: 'student',
    },
    branch: {
      type: String,
      enum: ['Computer Science', 'ECE', 'ME', 'CE', 'EE', 'CHE', 'BT', 'Other'],
      required: function() {
        return this.role === 'student';
      },
    },
    year: {
      type: Number,
      enum: [1, 2, 3, 4],
      required: function() {
        return this.role === 'student';
      },
    },
    semester: {
      type: Number,
      enum: [1, 2, 3, 4, 5, 6, 7, 8],
      required: function() {
        return this.role === 'student';
      },
    },
    avatar: {
      type: String,
      default: 'default-avatar.png',
    },
    googleId: {
      type: String,
      sparse: true,
    },
    universityId: {
      type: String,
      sparse: true,
    },
    fcmToken: {
      type: String,
      default: null,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    otp: {
      type: String,
      select: false,
    },
    otpExpiry: {
      type: Date,
      select: false,
    },
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpire: {
      type: Date,
      select: false,
    },
    lastActive: {
      type: Date,
      default: Date.now,
    },
    subjects: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
    }],
  },
  {
    timestamps: true,
  }
);

// Encrypt password using bcrypt
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);