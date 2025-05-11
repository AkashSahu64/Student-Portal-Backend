const asyncHandler = require('express-async-handler');
const PYQ = require('../models/PYQ');
const { ErrorResponse } = require('../middlewares/errorHandler');
const { advancedFilter, filterEducationalResources } = require('../utils/filterQuery');
const { formatResponse, formatPagination } = require('../utils/formatData');
const { deleteFile } = require('../middlewares/upload');

// @desc    Get all previous year questions (PYQs) with filtering
// @route   GET /api/pyq
// @access  Private
exports.getPYQs = asyncHandler(async (req, res) => {
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

  // Add exam type filter if provided
  if (req.query.examType) {
    resourceFilter.examType = req.query.examType;
  }

  // Add exam year filter if provided
  if (req.query.examYear) {
    resourceFilter.examYear = req.query.examYear;
  }

  // Add difficulty filter if provided
  if (req.query.difficulty) {
    resourceFilter.difficulty = req.query.difficulty;
  }

  // Add solution filter if provided
  if (req.query.hasSolution) {
    resourceFilter.hasSolution = req.query.hasSolution === 'true';
  }

  // Merge with any existing query filters
  const mergedQuery = { ...req.query, ...resourceFilter };

  // Get filtered PYQs with pagination
  const { query, pagination } = advancedFilter(
    PYQ,
    mergedQuery,
    ['subject', 'uploadedBy']
  );

  // Execute query
  const pyqs = await query;
  const total = await PYQ.countDocuments(resourceFilter);

  // Format pagination metadata
  const paginationData = formatPagination(
    total,
    pagination.page,
    pagination.limit,
    `${req.protocol}://${req.get('host')}/api/pyq`,
    req.query
  );

  res.status(200).json(formatResponse({
    count: pyqs.length,
    pagination: paginationData,
    data: pyqs
  }));
});

// @desc    Get a single PYQ
// @route   GET /api/pyq/:id
// @access  Private
exports.getPYQ = asyncHandler(async (req, res) => {
  const pyq = await PYQ.findById(req.params.id)
    .populate('subject')
    .populate('uploadedBy');

  if (!pyq) {
    throw new ErrorResponse(`PYQ not found with id of ${req.params.id}`, 404);
  }

  // Increment views counter
  pyq.views += 1;
  await pyq.save();

  res.status(200).json(formatResponse(pyq));
});

// @desc    Create a new PYQ
// @route   POST /api/pyq
// @access  Private
exports.createPYQ = asyncHandler(async (req, res) => {
  // Add user to request body
  req.body.uploadedBy = req.user.id;

  // Check if question file was uploaded
  if (!req.fileInfo) {
    throw new ErrorResponse('Please upload a question file', 400);
  }

  // Extract PYQ data
  const { 
    title,
    description,
    subject,
    branch,
    year,
    semester,
    examType,
    examYear,
    difficulty,
    totalMarks,
    duration
  } = req.body;

  // Create PYQ with file info
  const pyq = await PYQ.create({
    title,
    description,
    subject,
    branch,
    year,
    semester,
    examType,
    examYear,
    difficulty: difficulty || 'Medium',
    totalMarks: totalMarks || 0,
    duration: duration || 0,
    uploadedBy: req.user.id,
    fileUrl: req.fileInfo.url,
    filePath: req.fileInfo.path,
    fileType: req.fileInfo.originalname.split('.').pop(),
    fileSize: req.fileInfo.size,
    isVerified: req.user.role === 'student' ? false : true,
    hasSolution: false // Default until solution is uploaded
  });

  // Check if solution file was uploaded
  if (req.solutionFileInfo) {
    pyq.hasSolution = true;
    pyq.solutionFileUrl = req.solutionFileInfo.url;
    pyq.solutionFilePath = req.solutionFileInfo.path;
    await pyq.save();
  }

  // Populate related fields for response
  const populatedPYQ = await PYQ.findById(pyq._id)
    .populate('subject')
    .populate('uploadedBy');

  res.status(201).json(formatResponse(populatedPYQ));
});

// @desc    Update a PYQ
// @route   PUT /api/pyq/:id
// @access  Private
exports.updatePYQ = asyncHandler(async (req, res) => {
  let pyq = await PYQ.findById(req.params.id);

  if (!pyq) {
    throw new ErrorResponse(`PYQ not found with id of ${req.params.id}`, 404);
  }

  // Make sure user is PYQ owner or admin
  if (pyq.uploadedBy.toString() !== req.user.id && req.user.role !== 'admin') {
    throw new ErrorResponse(`User ${req.user.id} is not authorized to update this PYQ`, 403);
  }

  // Update fields
  const updateFields = {};
  const { 
    title,
    description,
    subject,
    branch,
    year,
    semester,
    examType,
    examYear,
    difficulty,
    totalMarks,
    duration
  } = req.body;

  if (title) updateFields.title = title;
  if (description) updateFields.description = description;
  if (subject) updateFields.subject = subject;
  if (branch) updateFields.branch = branch;
  if (year) updateFields.year = parseInt(year);
  if (semester) updateFields.semester = parseInt(semester);
  if (examType) updateFields.examType = examType;
  if (examYear) updateFields.examYear = parseInt(examYear);
  if (difficulty) updateFields.difficulty = difficulty;
  if (totalMarks) updateFields.totalMarks = parseInt(totalMarks);
  if (duration) updateFields.duration = parseInt(duration);

  // If there's a new question file uploaded
  if (req.fileInfo) {
    // Delete old file
    deleteFile(pyq.filePath);
    
    // Update with new file info
    updateFields.fileUrl = req.fileInfo.url;
    updateFields.filePath = req.fileInfo.path;
    updateFields.fileType = req.fileInfo.originalname.split('.').pop();
    updateFields.fileSize = req.fileInfo.size;
  }

  // If there's a new solution file uploaded
  if (req.solutionFileInfo) {
    // Delete old solution file if exists
    if (pyq.solutionFilePath) {
      deleteFile(pyq.solutionFilePath);
    }
    
    // Update with new solution file info
    updateFields.hasSolution = true;
    updateFields.solutionFileUrl = req.solutionFileInfo.url;
    updateFields.solutionFilePath = req.solutionFileInfo.path;
  }

  // Update PYQ
  pyq = await PYQ.findByIdAndUpdate(req.params.id, updateFields, {
    new: true,
    runValidators: true
  })
    .populate('subject')
    .populate('uploadedBy');

  res.status(200).json(formatResponse(pyq));
});

// @desc    Delete a PYQ
// @route   DELETE /api/pyq/:id
// @access  Private
exports.deletePYQ = asyncHandler(async (req, res) => {
  const pyq = await PYQ.findById(req.params.id);

  if (!pyq) {
    throw new ErrorResponse(`PYQ not found with id of ${req.params.id}`, 404);
  }

  // Make sure user is PYQ owner or admin
  if (pyq.uploadedBy.toString() !== req.user.id && req.user.role !== 'admin') {
    throw new ErrorResponse(`User ${req.user.id} is not authorized to delete this PYQ`, 403);
  }

  // Delete files from storage
  deleteFile(pyq.filePath);
  if (pyq.hasSolution && pyq.solutionFilePath) {
    deleteFile(pyq.solutionFilePath);
  }

  // Delete PYQ from database
  await pyq.deleteOne();

  res.status(200).json(formatResponse({ success: true }));
});

// @desc    Add solution to a PYQ
// @route   PUT /api/pyq/:id/solution
// @access  Private (Admin, Teacher)
exports.addSolution = asyncHandler(async (req, res) => {
  const pyq = await PYQ.findById(req.params.id);

  if (!pyq) {
    throw new ErrorResponse(`PYQ not found with id of ${req.params.id}`, 404);
  }

  // Check if solution file was uploaded
  if (!req.fileInfo) {
    throw new ErrorResponse('Please upload a solution file', 400);
  }

  // Delete old solution file if exists
  if (pyq.hasSolution && pyq.solutionFilePath) {
    deleteFile(pyq.solutionFilePath);
  }

  // Update with new solution file info
  pyq.hasSolution = true;
  pyq.solutionFileUrl = req.fileInfo.url;
  pyq.solutionFilePath = req.fileInfo.path;
  await pyq.save();

  res.status(200).json(formatResponse({ 
    success: true,
    message: 'Solution added successfully',
    data: pyq
  }));
});

// @desc    Verify a PYQ (admin/teacher only)
// @route   PUT /api/pyq/:id/verify
// @access  Private (Admin, Teacher)
exports.verifyPYQ = asyncHandler(async (req, res) => {
  const pyq = await PYQ.findById(req.params.id);

  if (!pyq) {
    throw new ErrorResponse(`PYQ not found with id of ${req.params.id}`, 404);
  }

  // Update verification status
  pyq.isVerified = true;
  await pyq.save();

  res.status(200).json(formatResponse({ 
    success: true,
    message: 'PYQ verified successfully' 
  }));
});

// @desc    Download a PYQ (increment download counter)
// @route   GET /api/pyq/:id/download
// @access  Private
exports.downloadPYQ = asyncHandler(async (req, res) => {
  const pyq = await PYQ.findById(req.params.id);

  if (!pyq) {
    throw new ErrorResponse(`PYQ not found with id of ${req.params.id}`, 404);
  }

  // Increment download counter
  pyq.downloads += 1;
  await pyq.save();

  // Redirect to file URL for download
  res.redirect(pyq.fileUrl);
});

// @desc    Download a PYQ solution
// @route   GET /api/pyq/:id/solution/download
// @access  Private
exports.downloadSolution = asyncHandler(async (req, res) => {
  const pyq = await PYQ.findById(req.params.id);

  if (!pyq) {
    throw new ErrorResponse(`PYQ not found with id of ${req.params.id}`, 404);
  }

  if (!pyq.hasSolution || !pyq.solutionFileUrl) {
    throw new ErrorResponse(`No solution available for this PYQ`, 404);
  }

  // Redirect to solution file URL for download
  res.redirect(pyq.solutionFileUrl);
});