const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');

// Protect routes
exports.protect = asyncHandler(async (req, res, next) => {
  let token;

  // Check for token in headers
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    // Set token from Bearer token in header
    token = req.headers.authorization.split(' ')[1];
  } 
  // Check for token in cookies
  else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  // Make sure token exists
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route',
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from the token
    req.user = await User.findById(decoded.id);

    // Update last active
    await User.findByIdAndUpdate(decoded.id, { lastActive: Date.now() });

    // Check if user exists
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
      });
    }

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route',
    });
  }
});

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.role} is not authorized to access this route`,
      });
    }
    next();
  };
};

// Check if user is verified
exports.isVerified = asyncHandler(async (req, res, next) => {
  if (!req.user.isVerified) {
    return res.status(403).json({
      success: false,
      message: 'Please verify your account to access this route',
    });
  }
  next();
});

// Check if user belongs to specific branch
exports.checkBranch = (branch) => {
  return (req, res, next) => {
    if (req.user.role === 'admin') {
      // Admin can access all branches
      return next();
    }
    
    if (req.user.branch !== branch) {
      return res.status(403).json({
        success: false,
        message: `User from ${req.user.branch} branch is not authorized to access ${branch} resources`,
      });
    }
    next();
  };
};

// Check if user belongs to specific year
exports.checkYear = (year) => {
  return (req, res, next) => {
    if (req.user.role === 'admin' || req.user.role === 'teacher') {
      // Admin and teachers can access all years
      return next();
    }
    
    if (req.user.year !== year) {
      return res.status(403).json({
        success: false,
        message: `User from year ${req.user.year} is not authorized to access year ${year} resources`,
      });
    }
    next();
  };
};

// Check if user belongs to specific semester
exports.checkSemester = (semester) => {
  return (req, res, next) => {
    if (req.user.role === 'admin' || req.user.role === 'teacher') {
      // Admin and teachers can access all semesters
      return next();
    }
    
    if (req.user.semester !== semester) {
      return res.status(403).json({
        success: false,
        message: `User from semester ${req.user.semester} is not authorized to access semester ${semester} resources`,
      });
    }
    next();
  };
};