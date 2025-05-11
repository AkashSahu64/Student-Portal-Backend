const academicKeywords = [
  'syllabus', 'notes', 'pyq', 'exam', 'question', 'study', 'topic', 'subject',
  'chapter', 'lecture', 'assignment', 'homework', 'quiz', 'test', 'course',
  'semester', 'year', 'branch', 'department', 'faculty', 'professor', 'teacher',
  'student', 'class', 'grade', 'mark', 'score', 'assessment', 'evaluation',
  'curriculum', 'module', 'unit', 'practical', 'theory', 'lab', 'tutorial',
  'reference', 'book', 'material', 'resource', 'learning', 'education',
  'data structure', 'algorithm', 'computer science', 'programming', 'memory management',
  'stack', 'queue', 'linked list', 'tree', 'graph', 'sorting', 'searching'
];

/**
 * Check if a query is academic-related
 * @param {string} query - The user's query
 * @returns {boolean} - True if academic-related, false otherwise
 */
exports.isAcademicQuery = (query) => {
  const normalizedQuery = query.toLowerCase();
  return academicKeywords.some(keyword => normalizedQuery.includes(keyword));
};

/**
 * Get the academic context type from the query
 * @param {string} query - The user's query
 * @returns {string} - Context type ('syllabus', 'notes', 'pyq', or 'general')
 */
exports.getQueryContext = (query) => {
  const normalizedQuery = query.toLowerCase();
  
  if (normalizedQuery.includes('syllabus')) return 'syllabus';
  if (normalizedQuery.includes('notes')) return 'notes';
  if (normalizedQuery.includes('pyq') || normalizedQuery.includes('previous year')) return 'pyq';
  
  return 'general';
};

/**
 * Generate a context-aware prompt based on the query type
 * @param {string} query - The user's query
 * @param {string} context - Additional context (e.g., syllabus content)
 * @param {string} contextType - Type of context ('syllabus', 'notes', 'pyq')
 * @returns {string} - Enhanced prompt for the AI
 */
exports.generateContextAwarePrompt = (query, context, contextType) => {
  let prompt = `As an academic assistant, help with the following query: ${query}\n\n`;
  
  if (context) {
    prompt += `Context (${contextType}):\n${context}\n\n`;
  }
  
  switch (contextType) {
    case 'syllabus':
      prompt += 'Focus on curriculum structure, topic importance, and study planning.';
      break;
    case 'notes':
      prompt += 'Focus on concept explanation, examples, and key points.';
      break;
    case 'pyq':
      prompt += 'Focus on solution approach, important concepts, and exam patterns.';
      break;
    default:
      prompt += 'Provide academic-focused guidance.';
  }
  
  return prompt;
};