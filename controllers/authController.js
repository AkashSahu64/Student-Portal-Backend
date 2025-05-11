const asyncHandler = require('express-async-handler');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const { ErrorResponse } = require('../middlewares/errorHandler');
const { sendTokenResponse } = require('../utils/token');
const { formatResponse, cleanUserData } = require('../utils/formatData');
const { admin } = require('../config/firebase');

// Initialize Google OAuth client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
exports.register = asyncHandler(async (req, res) => {
  const { name, email, phone, password, role, branch, year, semester, rollNumber } = req.body;

  // Check if email already exists
  const userExists = await User.findOne({ email });
  if (userExists) {
    throw new ErrorResponse('Email already registered', 400);
  }

  // Check role - Only students can register directly
  if (role && role !== 'student') {
    throw new ErrorResponse('Only students can register directly', 400);
  }

  // Create new user
  const user = await User.create({
    name,
    email,
    phone,
    password,
    role: 'student', // Force role to be student for direct registrations
    branch,
    year,
    semester,
    rollNumber,
    isVerified: false // Default to unverified
  });

  // Generate OTP for verification
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  // Hash OTP
  const salt = await bcrypt.genSalt(10);
  const hashedOTP = await bcrypt.hash(otp, salt);

  // Save OTP to user
  user.otp = hashedOTP;
  user.otpExpiry = otpExpiry;
  await user.save();

  // TODO: Send OTP via email or SMS
  console.log(`OTP for ${email}: ${otp}`);

  // Send token response
  sendTokenResponse(user, 201, res);
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Validate email & password
  if (!email || !password) {
    throw new ErrorResponse('Please provide email and password', 400);
  }

  // Check for user
  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    throw new ErrorResponse('Invalid credentials', 401);
  }

  // Check if password matches
  const isMatch = await user.matchPassword(password);
  if (!isMatch) {
    throw new ErrorResponse('Invalid credentials', 401);
  }

  // Update FCM token if provided
  if (req.body.fcmToken) {
    user.fcmToken = req.body.fcmToken;
    await user.save();
  }

  // Send token response
  sendTokenResponse(user, 200, res);
});

// @desc    Login or register with Google
// @route   POST /api/auth/google
// @access  Public
exports.googleAuth = asyncHandler(async (req, res) => {
  const { idToken, role, branch, year, semester } = req.body;

  // Verify Google ID token
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID
  });

  const payload = ticket.getPayload();
  const { email, name, picture, sub: googleId } = payload;

  // Find user by email or Google ID
  let user = await User.findOne({
    $or: [{ email }, { googleId }]
  });

  // If user does not exist, create new user
  if (!user) {
    // Check for required student information
    if (role === 'student' && (!branch || !year || !semester)) {
      return res.status(400).json(formatResponse(
        { email, name, googleId },
        false,
        'Additional information required to complete registration'
      ));
    }

    // Create new user
    user = await User.create({
      name,
      email,
      password: crypto.randomBytes(20).toString('hex'),
      role: 'student', // Default role for Google auth
      branch,
      year,
      semester,
      googleId,
      avatar: picture || 'default-avatar.png',
      isVerified: true // Google accounts are pre-verified
    });
  } else {
    // Update Google ID if missing
    if (!user.googleId) {
      user.googleId = googleId;
      await user.save();
    }
    
    // Update additional info if missing
    if (user.role === 'student' && (!user.branch || !user.year || !user.semester)) {
      user.branch = branch || user.branch;
      user.year = year || user.year;
      user.semester = semester || user.semester;
      await user.save();
    }
  }

  // Update FCM token if provided
  if (req.body.fcmToken) {
    user.fcmToken = req.body.fcmToken;
    await user.save();
  }

  // Send token response
  sendTokenResponse(user, 200, res);
});

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Private
exports.verifyOTP = asyncHandler(async (req, res) => {
  const { otp } = req.body;
  
  // Get user
  const user = await User.findById(req.user.id).select('+otp +otpExpiry');
  
  // Check if OTP exists and not expired
  if (!user.otp || !user.otpExpiry || user.otpExpiry < new Date()) {
    throw new ErrorResponse('OTP expired or invalid', 400);
  }
  
  // Verify OTP
  const isMatch = await bcrypt.compare(otp, user.otp);
  if (!isMatch) {
    throw new ErrorResponse('Invalid OTP', 400);
  }
  
  // Mark user as verified
  user.isVerified = true;
  user.otp = undefined;
  user.otpExpiry = undefined;
  await user.save();
  
  // Send success response
  res.status(200).json(formatResponse({
    message: 'Account verified successfully'
  }));
});

// @desc    Resend OTP
// @route   POST /api/auth/resend-otp
// @access  Private
exports.resendOTP = asyncHandler(async (req, res) => {
  // Get user
  const user = await User.findById(req.user.id);
  
  // Generate new OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  
  // Hash OTP
  const salt = await bcrypt.genSalt(10);
  const hashedOTP = await bcrypt.hash(otp, salt);
  
  // Save OTP to user
  user.otp = hashedOTP;
  user.otpExpiry = otpExpiry;
  await user.save();
  
  // TODO: Send OTP via email or SMS
  console.log(`New OTP for ${user.email}: ${otp}`);
  
  // Send success response
  res.status(200).json(formatResponse({
    message: 'OTP sent successfully'
  }));
});

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  
  // Find user by email
  const user = await User.findOne({ email });
  if (!user) {
    throw new ErrorResponse('No user found with that email', 404);
  }
  
  // Generate reset token
  const resetToken = crypto.randomBytes(20).toString('hex');
  
  // Hash token and set to resetPasswordToken field
  user.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  // Set expire (10 minutes)
  user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
  
  await user.save();
  
  // Create reset URL
  const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
  
  // TODO: Send email with reset URL
  console.log(`Reset URL for ${email}: ${resetUrl}`);
  
  // Send success response
  res.status(200).json(formatResponse({
    message: 'Password reset link sent to your email'
  }));
});

// @desc    Reset password
// @route   PUT /api/auth/reset-password/:resetToken
// @access  Public
exports.resetPassword = asyncHandler(async (req, res) => {
  const { password } = req.body;
  
  // Get hashed token
  const resetPasswordToken = crypto
    .createHash('sha256')
    .update(req.params.resetToken)
    .digest('hex');
  
  // Find user by reset token and check expiry
  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() }
  });
  
  if (!user) {
    throw new ErrorResponse('Invalid or expired token', 400);
  }
  
  // Set new password
  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();
  
  // Send success response
  res.status(200).json(formatResponse({
    message: 'Password reset successful'
  }));
});

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).populate('subjects');
  
  res.status(200).json(formatResponse(cleanUserData(user)));
});

// @desc    Update user details
// @route   PUT /api/auth/update-details
// @access  Private
exports.updateDetails = asyncHandler(async (req, res) => {
  const { name, phone, branch, year, semester } = req.body;
  
  // Build update object
  const updateFields = {};
  if (name) updateFields.name = name;
  if (phone) updateFields.phone = phone;
  
  // Student-specific fields
  if (req.user.role === 'student') {
    if (branch) updateFields.branch = branch;
    if (year) updateFields.year = year;
    if (semester) updateFields.semester = semester;
  }
  
  // Update user
  const user = await User.findByIdAndUpdate(req.user.id, updateFields, {
    new: true,
    runValidators: true
  }).populate('subjects');
  
  res.status(200).json(formatResponse(cleanUserData(user)));
});

// @desc    Update password
// @route   PUT /api/auth/update-password
// @access  Private
exports.updatePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  
  // Get user with password
  const user = await User.findById(req.user.id).select('+password');
  
  // Check current password
  const isMatch = await user.matchPassword(currentPassword);
  if (!isMatch) {
    throw new ErrorResponse('Current password is incorrect', 401);
  }
  
  // Set new password
  user.password = newPassword;
  await user.save();
  
  // Send token response
  sendTokenResponse(user, 200, res);
});

// @desc    Update FCM token for notifications
// @route   PUT /api/auth/update-fcm-token
// @access  Private
exports.updateFCMToken = asyncHandler(async (req, res) => {
  const { fcmToken } = req.body;
  
  // Update user
  const user = await User.findByIdAndUpdate(req.user.id, { fcmToken }, {
    new: true
  });
  
  res.status(200).json(formatResponse({
    message: 'FCM token updated successfully'
  }));
});

// @desc    Logout user / clear cookie
// @route   GET /api/auth/logout
// @access  Private
exports.logout = asyncHandler(async (req, res) => {
  // Remove FCM token on logout
  await User.findByIdAndUpdate(req.user.id, { fcmToken: null });
  
  // Clear cookie
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });
  
  res.status(200).json(formatResponse({
    message: 'Logged out successfully'
  }));
});