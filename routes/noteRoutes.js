const express = require('express');
const router = express.Router();
const { 
  getNotes,
  getNote,
  createNote,
  updateNote,
  deleteNote,
  verifyNote,
  addRating,
  downloadNote,
  incrementNoteViews
} = require('../controllers/notesController');
const { protect, authorize, isVerified } = require('../middlewares/authMiddleware');
const { uploadSingle } = require('../middlewares/upload');

// All routes are protected
router.use(protect);
router.use(isVerified);

// Get all notes and create a note
router.route('/')
  .get(getNotes)
  .post(uploadSingle('file'), createNote);

// Get, update, and delete specific note
router.route('/:id')
  .get(getNote)
  .put(uploadSingle('file'), updateNote)
  .delete(deleteNote);

// Verify a note (admin, teacher only)
router.put('/:id/verify', authorize('admin', 'teacher'), verifyNote);

// Add a rating to a note
router.post('/:id/ratings', addRating);

// Download a note
router.get('/:id/download', downloadNote);

// Increment views
router.put('/:id/views', incrementNoteViews);

module.exports = router;