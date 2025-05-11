const express = require('express');
const router = express.Router();
const { 
  queryAssistant,
  analyzeSyllabus,
  clearDoubt,
  getStudyRecommendations
} = require('../controllers/chatbotController');
const { protect, isVerified } = require('../middlewares/authMiddleware');

// All routes are protected
router.use(protect);
router.use(isVerified);

// Query the AI assistant
router.post('/ask', queryAssistant);

// Analyze syllabus page by page
router.post('/analyze-syllabus/:id', analyzeSyllabus);

// Clear doubts about specific content
router.post('/clear-doubt', clearDoubt);

// Get personalized study recommendations
router.get('/study-recommendations', getStudyRecommendations);

module.exports = router;