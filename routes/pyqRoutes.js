const express = require('express');
const router = express.Router();
const { 
  getPYQs,
  getPYQ,
  createPYQ,
  updatePYQ,
  deletePYQ,
  addSolution,
  verifyPYQ,
  downloadPYQ,
  downloadSolution
} = require('../controllers/pyqController');
const { protect, authorize, isVerified } = require('../middlewares/authMiddleware');
const { uploadSingle } = require('../middlewares/upload');

// Custom middleware for handling question and solution files
const handlePYQFiles = (req, res, next) => {
  // First handle the question file
  uploadSingle('file')(req, res, (err) => {
    if (err) return next(err);
    
    // Store question file info
    const questionFileInfo = req.fileInfo;
    
    // Then handle the solution file if present
    if (req.body.hasSolution === 'true') {
      uploadSingle('solutionFile')(req, res, (err) => {
        if (err) return next(err);
        
        // Restore question file info and add solution file info
        req.fileInfo = questionFileInfo;
        req.solutionFileInfo = req.fileInfo;
        
        next();
      });
    } else {
      next();
    }
  });
};

// All routes are protected
router.use(protect);
router.use(isVerified);

// Get all PYQs and create a PYQ
router.route('/')
  .get(getPYQs)
  .post(handlePYQFiles, createPYQ);

// Get, update, and delete specific PYQ
router.route('/:id')
  .get(getPYQ)
  .put(handlePYQFiles, updatePYQ)
  .delete(deletePYQ);

// Add solution to a PYQ (admin, teacher only)
router.put('/:id/solution', authorize('admin', 'teacher'), uploadSingle('file'), addSolution);

// Verify a PYQ (admin, teacher only)
router.put('/:id/verify', authorize('admin', 'teacher'), verifyPYQ);

// Download a PYQ
router.get('/:id/download', downloadPYQ);

// Download a PYQ solution
router.get('/:id/solution/download', downloadSolution);

module.exports = router;