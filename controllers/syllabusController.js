const asyncHandler = require('express-async-handler');
const Syllabus = require('../models/Syllabus');
const { ErrorResponse } = require('../middlewares/errorHandler');
const { advancedFilter, filterEducationalResources } = require('../utils/filterQuery');
const { formatResponse, formatPagination } = require('../utils/formatData');
const { deleteFile } = require('../middlewares/upload');

// @desc    Get all syllabi with filtering
// @route   GET /api/syllabus
// @access  Private
exports.getSyllabi = asyncHandler(async (req, res) => {
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

  // Get filtered syllabi with pagination
  const { query, pagination } = advancedFilter(
    Syllabus,
    mergedQuery,
    ['subject', 'uploadedBy']
  );

  // Execute query
  const syllabi = await query;
  const total = await Syllabus.countDocuments(resourceFilter);

  // Format pagination metadata
  const paginationData = formatPagination(
    total,
    pagination.page,
    pagination.limit,
    `${req.protocol}://${req.get('host')}/api/syllabus`,
    req.query
  );

  res.status(200).json(formatResponse({
    count: syllabi.length,
    pagination: paginationData,
    data: syllabi
  }));
});

// @desc    Get a single syllabus
// @route   GET /api/syllabus/:id
// @access  Private
exports.getSyllabus = asyncHandler(async (req, res) => {
  const syllabus = await Syllabus.findById(req.params.id)
    .populate('subject')
    .populate('uploadedBy');

  if (!syllabus) {
    throw new ErrorResponse(`Syllabus not found with id of ${req.params.id}`, 404);
  }

  // Increment views counter
  syllabus.views += 1;
  await syllabus.save();

  res.status(200).json(formatResponse(syllabus));
});

// @desc    Create a new syllabus
// @route   POST /api/syllabus
// @access  Private (Admin, Teacher)
exports.createSyllabus = asyncHandler(async (req, res) => {
  // Add user to request body
  req.body.uploadedBy = req.user.id;

  // Check if file was uploaded
  if (!req.fileInfo) {
    throw new ErrorResponse('Please upload a file', 400);
  }

  // Extract syllabus data
  const { 
    title,
    description,
    branch,
    year,
    semester,
    subject,
    totalMarks,
    passingMarks,
    examPattern,
    units,
    referenceBooks
  } = req.body;

  // Create syllabus with file info
  const syllabus = await Syllabus.create({
    title,
    description,
    branch,
    year,
    semester,
    subject,
    totalMarks,
    passingMarks,
    examPattern,
    units: units ? JSON.parse(units) : [],
    referenceBooks: referenceBooks ? JSON.parse(referenceBooks) : [],
    uploadedBy: req.user.id,
    fileUrl: req.fileInfo.url,
    filePath: req.fileInfo.path,
    fileType: req.fileInfo.originalname.split('.').pop(),
    fileSize: req.fileInfo.size
  });

  // Populate related fields for response
  const populatedSyllabus = await Syllabus.findById(syllabus._id)
    .populate('subject')
    .populate('uploadedBy');

  res.status(201).json(formatResponse(populatedSyllabus));
});

// @desc    Update a syllabus
// @route   PUT /api/syllabus/:id
// @access  Private (Admin, Teacher)
exports.updateSyllabus = asyncHandler(async (req, res) => {
  let syllabus = await Syllabus.findById(req.params.id);

  if (!syllabus) {
    throw new ErrorResponse(`Syllabus not found with id of ${req.params.id}`, 404);
  }

  // Make sure user is syllabus owner or admin
  if (syllabus.uploadedBy.toString() !== req.user.id && req.user.role !== 'admin') {
    throw new ErrorResponse(`User ${req.user.id} is not authorized to update this syllabus`, 403);
  }

  // Update fields
  const updateFields = {};
  const { 
    title,
    description,
    branch,
    year,
    semester,
    subject,
    totalMarks,
    passingMarks,
    examPattern,
    units,
    referenceBooks,
    isActive
  } = req.body;

  if (title) updateFields.title = title;
  if (description) updateFields.description = description;
  if (branch) updateFields.branch = branch;
  if (year) updateFields.year = year;
  if (semester) updateFields.semester = semester;
  if (subject) updateFields.subject = subject;
  if (totalMarks) updateFields.totalMarks = totalMarks;
  if (passingMarks) updateFields.passingMarks = passingMarks;
  if (examPattern) updateFields.examPattern = examPattern;
  if (units) updateFields.units = JSON.parse(units);
  if (referenceBooks) updateFields.referenceBooks = JSON.parse(referenceBooks);
  if (isActive !== undefined) updateFields.isActive = isActive;

  // If there's a new file uploaded
  if (req.fileInfo) {
    // Delete old file
    deleteFile(syllabus.filePath);
    
    // Update with new file info
    updateFields.fileUrl = req.fileInfo.url;
    updateFields.filePath = req.fileInfo.path;
    updateFields.fileType = req.fileInfo.originalname.split('.').pop();
    updateFields.fileSize = req.fileInfo.size;
  }

  // Update syllabus
  syllabus = await Syllabus.findByIdAndUpdate(req.params.id, updateFields, {
    new: true,
    runValidators: true
  })
    .populate('subject')
    .populate('uploadedBy');

  res.status(200).json(formatResponse(syllabus));
});

// @desc    Delete a syllabus
// @route   DELETE /api/syllabus/:id
// @access  Private (Admin, Teacher)
exports.deleteSyllabus = asyncHandler(async (req, res) => {
  const syllabus = await Syllabus.findById(req.params.id);

  if (!syllabus) {
    throw new ErrorResponse(`Syllabus not found with id of ${req.params.id}`, 404);
  }

  // Make sure user is syllabus owner or admin
  if (syllabus.uploadedBy.toString() !== req.user.id && req.user.role !== 'admin') {
    throw new ErrorResponse(`User ${req.user.id} is not authorized to delete this syllabus`, 403);
  }

  // Delete file from storage
  deleteFile(syllabus.filePath);

  // Delete syllabus from database
  await syllabus.deleteOne();

  res.status(200).json(formatResponse({ success: true }));
});

// @desc    Download a syllabus (increment download counter)
// @route   GET /api/syllabus/:id/download
// @access  Private
exports.downloadSyllabus = asyncHandler(async (req, res) => {
  const syllabus = await Syllabus.findById(req.params.id);

  if (!syllabus) {
    throw new ErrorResponse(`Syllabus not found with id of ${req.params.id}`, 404);
  }

  // Increment download counter
  syllabus.downloads += 1;
  await syllabus.save();

  // Redirect to file URL for download
  res.redirect(syllabus.fileUrl);
});