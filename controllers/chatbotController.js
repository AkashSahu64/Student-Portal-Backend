const asyncHandler = require('express-async-handler');
const aiService = require('../services/aiService.js');
const { ErrorResponse } = require('../middlewares/errorHandler');
const { formatResponse } = require('../utils/formatData');
const Note = require('../models/Note');
const Syllabus = require('../models/Syllabus');
const PYQ = require('../models/PYQ');

// @desc    Query the AI assistant
// @route   POST /api/chatbot/ask
// @access  Private
exports.queryAssistant = asyncHandler(async (req, res) => {
  const { query, context, contextType, pageContext } = req.body;

  if (!query) {
    throw new ErrorResponse('Please provide a query', 400);
  }

  // Process context based on type and page context
  let contextContent = '';
  let effectiveContextType = contextType || pageContext || 'general';

  if (context && effectiveContextType) {
    switch (effectiveContextType) {
      case 'note':
        const note = await Note.findById(context).populate('subject');
        if (note) {
          contextContent = `This query is related to a note titled "${note.title}" for the subject "${note.subject.name}" (${note.subject.code}).`;
        }
        break;
      case 'syllabus':
        const syllabus = await Syllabus.findById(context).populate('subject');
        if (syllabus) {
          contextContent = `This query is related to the syllabus for "${syllabus.subject.name}" (${syllabus.subject.code}).`;
          
          if (syllabus.units && syllabus.units.length > 0) {
            contextContent += ' The syllabus includes units: ';
            syllabus.units.forEach((unit, index) => {
              contextContent += `Unit ${index + 1}: ${unit.title}; `;
            });
          }
        }
        break;
      case 'pyq':
        const pyq = await PYQ.findById(context).populate('subject');
        if (pyq) {
          contextContent = `This query is related to a previous year question paper for "${pyq.subject.name}" (${pyq.subject.code}) from the ${pyq.examYear} ${pyq.examType} exam.`;
        }
        break;
      default:
        break;
    }
  }

  try {
    // Get AI response
    const aiResponse = await aiService.getCompletion(
      query,
      contextContent,
      effectiveContextType
    );
    
    res.status(200).json(formatResponse({
      query,
      response: aiResponse,
      context: effectiveContextType
    }));
  } catch (error) {
    console.error('AI service error:', error);
    throw new ErrorResponse('Error processing your request', 500);
  }
});

// @desc    Analyze syllabus page by page
// @route   POST /api/chatbot/analyze-syllabus/:id
// @access  Private
exports.analyzeSyllabus = asyncHandler(async (req, res) => {
  const syllabus = await Syllabus.findById(req.params.id).populate('subject');

  if (!syllabus) {
    throw new ErrorResponse(`Syllabus not found with id of ${req.params.id}`, 404);
  }

  try {
    let syllabusText = `Syllabus Analysis for ${syllabus.subject.name} (${syllabus.subject.code}):\n\n`;
    
    if (syllabus.units && syllabus.units.length > 0) {
      syllabusText += 'Units:\n';
      syllabus.units.forEach((unit, index) => {
        syllabusText += `Unit ${index + 1}: ${unit.title}\n`;
        syllabusText += `Description: ${unit.description}\n`;
        
        if (unit.topics && unit.topics.length > 0) {
          syllabusText += 'Topics:\n';
          unit.topics.forEach((topic, tIndex) => {
            syllabusText += `  ${tIndex + 1}. ${topic.title}\n`;
            if (topic.description) {
              syllabusText += `     ${topic.description}\n`;
            }
          });
        }
        syllabusText += '\n';
      });
    }
    
    syllabusText += `Exam Pattern: ${syllabus.examPattern}\n\n`;
    
    if (syllabus.referenceBooks && syllabus.referenceBooks.length > 0) {
      syllabusText += 'Reference Books:\n';
      syllabus.referenceBooks.forEach((book, index) => {
        syllabusText += `${index + 1}. "${book.title}" by ${book.author}\n`;
      });
    }

    const analysis = await aiService.analyzeSyllabus(syllabusText);
    
    res.status(200).json(formatResponse({
      subject: syllabus.subject.name,
      syllabus: syllabus.title,
      analysis
    }));
  } catch (error) {
    console.error('Syllabus analysis error:', error);
    throw new ErrorResponse('Error analyzing syllabus', 500);
  }
});

// @desc    Clear doubts about specific content
// @route   POST /api/chatbot/clear-doubt
// @access  Private
exports.clearDoubt = asyncHandler(async (req, res) => {
  const { question, contentType, contentId } = req.body;

  if (!question) {
    throw new ErrorResponse('Please provide a question', 400);
  }

  if (!contentType || !contentId) {
    throw new ErrorResponse('Please provide content type and ID', 400);
  }

  let content = null;
  let contentText = '';

  switch (contentType) {
    case 'note':
      content = await Note.findById(contentId).populate('subject');
      if (content) {
        contentText = `Note: ${content.title} for ${content.subject.name}`;
      }
      break;
    case 'syllabus':
      content = await Syllabus.findById(contentId).populate('subject');
      if (content) {
        contentText = `Syllabus for ${content.subject.name} (${content.subject.code})`;
        
        if (content.units && content.units.length > 0) {
          contentText += '\nUnits:\n';
          content.units.forEach((unit, index) => {
            contentText += `Unit ${index + 1}: ${unit.title} - ${unit.description}\n`;
          });
        }
      }
      break;
    case 'pyq':
      content = await PYQ.findById(contentId).populate('subject');
      if (content) {
        contentText = `Previous Year Question from ${content.examYear} ${content.examType} exam for ${content.subject.name}`;
      }
      break;
    default:
      throw new ErrorResponse('Invalid content type', 400);
  }

  if (!content) {
    throw new ErrorResponse(`${contentType} not found with id ${contentId}`, 404);
  }

  try {
    const response = await aiService.clearDoubt(question, contentText, contentType);
    
    res.status(200).json(formatResponse({
      question,
      contentType,
      contentTitle: content.title,
      response
    }));
  } catch (error) {
    console.error('Doubt clearing error:', error);
    throw new ErrorResponse('Error processing your doubt', 500);
  }
});

// @desc    Get personalized study recommendations
// @route   GET /api/chatbot/study-recommendations
// @access  Private
exports.getStudyRecommendations = asyncHandler(async (req, res) => {
  const { branch, year, semester } = req.user;
  
  if (req.user.role !== 'student') {
    throw new ErrorResponse('This feature is only available for students', 403);
  }

  try {
    const recommendations = await aiService.getStudyRecommendations(branch, year, semester);
    
    res.status(200).json(formatResponse({
      studentInfo: {
        branch,
        year,
        semester
      },
      recommendations
    }));
  } catch (error) {
    console.error('Recommendations error:', error);
    throw new ErrorResponse('Error generating recommendations', 500);
  }
});