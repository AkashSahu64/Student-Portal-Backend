const express = require('express');
const router = express.Router();
const { 
  getSyllabi,
  getSyllabus,
  createSyllabus,
  updateSyllabus,
  deleteSyllabus,
  downloadSyllabus
} = require('../controllers/syllabusController');
const { protect, authorize, isVerified } = require('../middlewares/authMiddleware');
const { uploadSingle } = require('../middlewares/upload');

// All routes are protected
router.use(protect);
router.use(isVerified);

// Get all syllabi
router.get('/', getSyllabi);

// Create a syllabus (admin, teacher only)
router.post('/', authorize('admin', 'teacher'), uploadSingle('file'), createSyllabus);

// Get, update, and delete specific syllabus
router.route('/:id')
  .get(getSyllabus)
  .put(authorize('admin', 'teacher'), uploadSingle('file'), updateSyllabus)
  .delete(authorize('admin', 'teacher'), deleteSyllabus);

// Download a syllabus
router.get('/:id/download', downloadSyllabus);

module.exports = router;