const asyncHandler = require('express-async-handler');
const Note = require('../models/Note');
const User = require('../models/User');
const { ErrorResponse } = require('../middlewares/errorHandler');
const { advancedFilter, filterEducationalResources } = require('../utils/filterQuery');
const { formatResponse, formatFileSize, formatPagination } = require('../utils/formatData');
const { deleteFile } = require('../middlewares/upload');

// @desc    Get all notes with filtering
// @route   GET /api/notes
// @access  Private
exports.getNotes = asyncHandler(async (req, res) => {
  // Filter based on user role and data
  const resourceFilter = filterEducationalResources(
    req.query,
    req.user.role,
    {
      branch: req.user.branch,
      year: req.user.year,
      semester: req.user.semester
    }
  );

  // Merge with any existing query filters
  const mergedQuery = { ...req.query, ...resourceFilter };

  // Get filtered notes with pagination
  const { query, pagination } = advancedFilter(
    Note,
    mergedQuery,
    ['subject', 'uploadedBy']
  );

  // Execute query
  const notes = await query;
  const total = await Note.countDocuments(resourceFilter);

  // Format pagination metadata
  const paginationData = formatPagination(
    total,
    pagination.page,
    pagination.limit,
    `${req.protocol}://${req.get('host')}/api/notes`,
    req.query
  );

  res.status(200).json(formatResponse({
    count: notes.length,
    pagination: paginationData,
    data: notes
  }));
});

// @desc    Get a single note
// @route   GET /api/notes/:id
// @access  Private
exports.getNote = asyncHandler(async (req, res) => {
  const note = await Note.findById(req.params.id)
    .populate('subject')
    .populate('uploadedBy');

  if (!note) {
    throw new ErrorResponse(`Note not found with id of ${req.params.id}`, 404);
  }

  // Increment views counter
  note.views += 1;
  await note.save();

  res.status(200).json(formatResponse(note));
});

// @desc    Create a new note
// @route   POST /api/notes
// @access  Private
exports.createNote = asyncHandler(async (req, res) => {
  // Add user to request body
  req.body.uploadedBy = req.user.id;

  // Check if file was uploaded
  if (!req.fileInfo) {
    throw new ErrorResponse('Please upload a file', 400);
  }

  // Extract file information
  const { 
    title, 
    description, 
    subject, 
    branch, 
    year, 
    semester 
  } = req.body;

  // Create note with file info
  const note = await Note.create({
    title,
    description,
    subject,
    branch,
    year,
    semester,
    uploadedBy: req.user.id,
    fileUrl: req.fileInfo.url,
    filePath: req.fileInfo.path,
    fileType: req.fileInfo.originalname.split('.').pop(),
    fileSize: req.fileInfo.size,
    isVerified: req.user.role === 'student' ? false : true
  });

  // Populate related fields for response
  const populatedNote = await Note.findById(note._id)
    .populate('subject')
    .populate('uploadedBy');

  res.status(201).json(formatResponse(populatedNote));
});

// @desc    Update a note
// @route   PUT /api/notes/:id
// @access  Private
exports.updateNote = asyncHandler(async (req, res) => {
  let note = await Note.findById(req.params.id);

  if (!note) {
    throw new ErrorResponse(`Note not found with id of ${req.params.id}`, 404);
  }

  // Make sure user is note owner or admin
  if (note.uploadedBy.toString() !== req.user.id && req.user.role !== 'admin') {
    throw new ErrorResponse(`User ${req.user.id} is not authorized to update this note`, 403);
  }

  // Update fields
  const { title, description, subject, branch, year, semester } = req.body;
  
  const updateFields = {};
  if (title) updateFields.title = title;
  if (description) updateFields.description = description;
  if (subject) updateFields.subject = subject;
  if (branch) updateFields.branch = branch;
  if (year) updateFields.year = year;
  if (semester) updateFields.semester = semester;

  // If there's a new file uploaded
  if (req.fileInfo) {
    // Delete old file
    deleteFile(note.filePath);
    
    // Update with new file info
    updateFields.fileUrl = req.fileInfo.url;
    updateFields.filePath = req.fileInfo.path;
    updateFields.fileType = req.fileInfo.originalname.split('.').pop();
    updateFields.fileSize = req.fileInfo.size;
  }

  // Update note
  note = await Note.findByIdAndUpdate(req.params.id, updateFields, {
    new: true,
    runValidators: true
  })
    .populate('subject')
    .populate('uploadedBy');

  res.status(200).json(formatResponse(note));
});

// @desc    Delete a note
// @route   DELETE /api/notes/:id
// @access  Private
exports.deleteNote = asyncHandler(async (req, res) => {
  const note = await Note.findById(req.params.id);

  if (!note) {
    throw new ErrorResponse(`Note not found with id of ${req.params.id}`, 404);
  }

  // Make sure user is note owner or admin
  if (note.uploadedBy.toString() !== req.user.id && req.user.role !== 'admin') {
    throw new ErrorResponse(`User ${req.user.id} is not authorized to delete this note`, 403);
  }

  // Delete file from storage
  deleteFile(note.filePath);

  // Delete note from database
  await note.deleteOne();

  res.status(200).json(formatResponse({ success: true }));
});

// @desc    Verify a note (admin/teacher only)
// @route   PUT /api/notes/:id/verify
// @access  Private (Admin, Teacher)
exports.verifyNote = asyncHandler(async (req, res) => {
  const note = await Note.findById(req.params.id);

  if (!note) {
    throw new ErrorResponse(`Note not found with id of ${req.params.id}`, 404);
  }

  // Update verification status
  note.isVerified = true;
  await note.save();

  res.status(200).json(formatResponse({ 
    success: true,
    message: 'Note verified successfully' 
  }));
});

// @desc    Add a rating to a note
// @route   POST /api/notes/:id/ratings
// @access  Private
exports.addRating = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body;
  
  // Validate rating
  if (!rating || rating < 1 || rating > 5) {
    throw new ErrorResponse('Please provide a valid rating between 1 and 5', 400);
  }

  const note = await Note.findById(req.params.id);

  if (!note) {
    throw new ErrorResponse(`Note not found with id of ${req.params.id}`, 404);
  }

  // Check if user already rated
  const alreadyRated = note.ratings.find(
    r => r.user.toString() === req.user.id
  );

  if (alreadyRated) {
    // Update existing rating
    alreadyRated.rating = rating;
    if (comment) alreadyRated.comment = comment;
    alreadyRated.createdAt = Date.now();
  } else {
    // Add new rating
    note.ratings.push({
      rating,
      comment,
      user: req.user.id
    });
  }

  // Calculate average rating
  note.averageRating = 
    note.ratings.reduce((acc, item) => acc + item.rating, 0) / 
    note.ratings.length;

  await note.save();

  res.status(200).json(formatResponse({ 
    success: true,
    averageRating: note.averageRating,
    totalRatings: note.ratings.length
  }));
});

// @desc    Download a note (increment download counter)
// @route   GET /api/notes/:id/download
// @access  Private
exports.downloadNote = asyncHandler(async (req, res) => {
  const note = await Note.findById(req.params.id);

  if (!note) {
    throw new ErrorResponse(`Note not found with id of ${req.params.id}`, 404);
  }

  // Increment download counter
  note.downloads += 1;
  await note.save();

  // Redirect to file URL for download
  res.redirect(note.fileUrl);
});

// @desc    Increment view count of a note
// @route   PUT /api/notes/:id/views
// @access  Private
exports.incrementNoteViews = asyncHandler(async (req, res) => {
  const note = await Note.findById(req.params.id);

  if (!note) {
    throw new ErrorResponse(`Note not found with id of ${req.params.id}`, 404);
  }

  note.views += 1;
  await note.save();

  res.status(200).json(formatResponse({
    success: true,
    message: 'View count incremented',
    data: {
      views: note.views
    }
  }));
});