const express = require('express');
const router = express.Router();
const { 
  register, 
  login, 
  googleAuth,
  verifyOTP,
  resendOTP,
  forgotPassword,
  resetPassword,
  getMe,
  updateDetails,
  updatePassword,
  updateFCMToken,
  logout
} = require('../controllers/authController');
const { protect, isVerified } = require('../middlewares/authMiddleware');

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/google', googleAuth);
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:resetToken', resetPassword);

// Protected routes
router.post('/verify-otp', protect, verifyOTP);
router.post('/resend-otp', protect, resendOTP);
router.get('/me', protect, getMe);
router.put('/update-details', protect, isVerified, updateDetails);
router.put('/update-password', protect, isVerified, updatePassword);
router.put('/update-fcm-token', protect, updateFCMToken);
router.get('/logout', protect, logout);

module.exports = router;