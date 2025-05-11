const { OpenAI } = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { HfInference } = require('@huggingface/inference');
const { isAcademicQuery, generateContextAwarePrompt } = require('../utils/topicFilter');
require('dotenv').config();

// Initialize AI clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const gemini = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

// Local API URL for open-source model
const LOCAL_AI_URL = process.env.LOCAL_AI_URL || 'http://localhost:11434';

/**
 * Try OpenAI GPT-4
 * @param {string} prompt - Enhanced prompt
 * @returns {Promise<string>} AI response
 */
// const tryOpenAI = async (prompt) => {
//   try {
//     const completion = await openai.chat.completions.create({
//       model: 'gpt-4',
//       messages: [
//         {
//           role: 'system',
//           content: 'You are an academic assistant focused on helping students with their studies. Only answer academic queries related to syllabus, notes, or previous year questions.'
//         },
//         { role: 'user', content: prompt }
//       ],
//       max_tokens: 1000,
//       temperature: 0.7,
//     });

//     return completion.choices[0].message.content.trim();
//   } catch (error) {
//     console.error('OpenAI error:', error);
//     throw error;
//   }
// };

/**
 * Try Google Gemini Pro
 * @param {string} prompt - Enhanced prompt
 * @returns {Promise<string>} AI response
 */
const tryGemini = async (prompt) => {
  try {
    const model = gemini.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Gemini error:', error);
    throw error;
  }
};

/**
 * Try Hugging Face Inference API
 * @param {string} prompt - Enhanced prompt
 * @returns {Promise<string>} AI response
 */
const tryHuggingFace = async (prompt) => {
  try {
    const response = await hf.textGeneration({
      model: 'mistralai/Mistral-7B-Instruct-v0.3',
      inputs: prompt,
      parameters: {
        max_new_tokens: 500,
        temperature: 0.7,
      },
    });
    return response.generated_text.trim();
  } catch (error) {
    console.error('HuggingFace error:', error);
    throw error;
  }
};

/**
 * Try Local Open Source Model+
 * @param {string} prompt - Enhanced prompt
 * @returns {Promise<string>} AI response
 */
// const tryLocalModel = async (prompt) => {
//   try {
//     const response = await fetch(`${LOCAL_AI_URL}/api/generate`, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({
//         model: 'llama3',
//         prompt: prompt,
//         max_tokens: 500,
//       }),
//     });

//     const data = await response.json();
//     return data.response.trim();
//   } catch (error) {
//     console.error('Local AI error:', error);
//     throw error;
//   }
// };

/**
 * Get AI completion with fallback
 * @param {string} query - User's query
 * @param {string} context - Additional context
 * @param {string} contextType - Type of context
 * @returns {Promise<string>} AI response
 */
exports.getCompletion = async (query, context = '', contextType = 'general') => {
  // Check if query is academic-related
  if (!isAcademicQuery(query)) {
    return 'Sorry, I can only assist with syllabus, notes, or previous year questions.';
  }

  // Generate enhanced prompt
  const prompt = generateContextAwarePrompt(query, context, contextType);

  // Try each AI service in order
  const services = [
    //{ name: 'OpenAI', fn: tryOpenAI },
   // { name: 'Gemini', fn: tryGemini },
    { name: 'HuggingFace', fn: tryHuggingFace },
    //{ name: 'LocalModel', fn: tryLocalModel }
  ];

  let lastError = null;

  for (const service of services) {
    try {
      const response = await service.fn(prompt);
      console.log(`Successfully used ${service.name}`);
      return response;
    } catch (error) {
      console.error(`${service.name} failed:`, error);
      lastError = error;
      continue;
    }
  }

  // If all services fail
  console.error('All AI services failed:', lastError);
  return 'Sorry, I am currently unable to process your request. Please try again later.';
};

/**
 * Analyze syllabus content
 * @param {string} syllabusText - Syllabus content
 * @returns {Promise<Object>} Analysis results
 */
exports.analyzeSyllabus = async (syllabusText) => {
  const prompt = `Analyze this syllabus and provide:
    1. Key topics and their importance
    2. Recommended study approach
    3. Potential challenging areas
    4. Estimated time needed for each unit
    5. Suggested supplementary resources

    Syllabus:
    ${syllabusText}`;

  try {
    const analysis = await exports.getCompletion(prompt, '', 'syllabus');
    return { text: analysis };
  } catch (error) {
    console.error('Syllabus analysis error:', error);
    return {
      text: 'Sorry, I encountered an error analyzing this syllabus. Please try again later.'
    };
  }
};

/**
 * Clear doubts about specific content
 * @param {string} question - User's question
 * @param {string} contentText - Content text
 * @param {string} contentType - Content type
 * @returns {Promise<string>} AI explanation
 */
exports.clearDoubt = async (question, contentText, contentType) => {
  if (!isAcademicQuery(question)) {
    return 'Sorry, I can only help with academic-related doubts.';
  }

  try {
    return await exports.getCompletion(question, contentText, contentType);
  } catch (error) {
    console.error('Doubt clearing error:', error);
    return 'Sorry, I encountered an error processing your doubt. Please try again later.';
  }
};

/**
 * Get study recommendations
 * @param {string} branch - Student's branch
 * @param {number} year - Student's year
 * @param {number} semester - Student's semester
 * @returns {Promise<Object>} Recommendations
 */
exports.getStudyRecommendations = async (branch, year, semester) => {
  const prompt = `Generate study recommendations for a ${year}rd year ${branch} student in semester ${semester}. Include:
    1. Recommended study schedule
    2. Key subjects to focus on
    3. Preparation strategy
    4. Resource recommendations
    5. Career development tips`;

  try {
    const recommendations = await exports.getCompletion(prompt, '', 'general');
    return { text: recommendations };
  } catch (error) {
    console.error('Recommendations error:', error);
    return {
      text: 'Sorry, I encountered an error generating recommendations. Please try again later.'
    };
  }
};