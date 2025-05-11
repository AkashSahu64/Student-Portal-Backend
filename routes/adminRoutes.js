const express = require('express');
const router = express.Router();
const { 
  getDashboardStats,
  getUsers,
  createUser,
  getUser,
  updateUser,
  deleteUser,
  createSubject,
  getSubjects,
  updateSubject,
  deleteSubject,
  assignTeachers,
  createAnnouncement,
  getAnnouncements,
  updateAnnouncement,
  deleteAnnouncement,
  getPendingContent,
  verifyContent
} = require('../controllers/adminController');
const { protect, authorize, isVerified } = require('../middlewares/authMiddleware');
const { uploadMultiple } = require('../middlewares/upload');

// All routes are protected and require admin role
router.use(protect);
router.use(isVerified);
router.use(authorize('admin'));

// Dashboard stats
router.get('/stats', getDashboardStats);

// User management
router.route('/users')
  .get(getUsers)
  .post(createUser);

router.route('/users/:id')
  .get(getUser)
  .put(updateUser)
  .delete(deleteUser);

// Subject management
router.route('/subjects')
  .get(getSubjects)
  .post(createSubject);

router.route('/subjects/:id')
  .put(updateSubject)
  .delete(deleteSubject);

// Assign teachers to subject
router.put('/subjects/:id/teachers', assignTeachers);

// Announcements
router.route('/announcements')
  .get(getAnnouncements)
  .post(uploadMultiple('attachments', 3), createAnnouncement);

router.route('/announcements/:id')
  .put(uploadMultiple('attachments', 3), updateAnnouncement)
  .delete(deleteAnnouncement);

// Content verification
router.get('/pending-content', getPendingContent);
router.put('/verify-content', verifyContent);

module.exports = router;