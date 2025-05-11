const express = require('express');
const router = express.Router();
const { 
  getVideos,
  getVideo,
  createVideo,
  updateVideo,
  deleteVideo,
  verifyVideo,
  likeVideo,
  addComment,
  deleteComment
} = require('../controllers/videoController');
const { protect, authorize, isVerified } = require('../middlewares/authMiddleware');
const { uploadSingle } = require('../middlewares/upload');

// All routes are protected
router.use(protect);
router.use(isVerified);

// Get all videos and create a video
router.route('/')
  .get(getVideos)
  .post(uploadSingle('file'), createVideo);

// Get, update, and delete specific video
router.route('/:id')
  .get(getVideo)
  .put(uploadSingle('file'), updateVideo)
  .delete(deleteVideo);

// Verify a video (admin, teacher only)
router.put('/:id/verify', authorize('admin', 'teacher'), verifyVideo);

// Like a video
router.put('/:id/like', likeVideo);

// Add a comment to a video
router.post('/:id/comments', addComment);

// Delete a comment
router.delete('/:id/comments/:commentId', deleteComment);

module.exports = router;