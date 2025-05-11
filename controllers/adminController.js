const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Note = require('../models/Note');
const Syllabus = require('../models/Syllabus');
const Video = require('../models/Video');
const PYQ = require('../models/PYQ');
const Subject = require('../models/Subject');
const Announcement = require('../models/Announcement');
const { ErrorResponse } = require('../middlewares/errorHandler');
const { advancedFilter } = require('../utils/filterQuery');
const { formatResponse, formatPagination, cleanUserData } = require('../utils/formatData');
const { notifyUsers } = require('../services/notificationService');

// @desc    Get admin dashboard stats
// @route   GET /api/admin/stats
// @access  Private (Admin only)
exports.getDashboardStats = asyncHandler(async (req, res) => {
  // Get counts
  const userCount = await User.countDocuments();
  const studentCount = await User.countDocuments({ role: 'student' });
  const teacherCount = await User.countDocuments({ role: 'teacher' });
  const noteCount = await Note.countDocuments();
  const syllabusCount = await Syllabus.countDocuments();
  const videoCount = await Video.countDocuments();
  const pyqCount = await PYQ.countDocuments();
  const subjectCount = await Subject.countDocuments();
  const verifiedContent = await Note.countDocuments({ isVerified: true }) +
    await Video.countDocuments({ isVerified: true }) +
    await PYQ.countDocuments({ isVerified: true });
  const pendingContent = await Note.countDocuments({ isVerified: false }) +
    await Video.countDocuments({ isVerified: false }) +
    await PYQ.countDocuments({ isVerified: false });

  // Get recent users
  const recentUsers = await User.find()
    .sort('-createdAt')
    .limit(5)
    .select('name email role branch year createdAt');

  // Get popular content
  const popularNotes = await Note.find()
    .sort('-views')
    .limit(5)
    .populate('subject')
    .select('title subject views downloads averageRating');

  const popularVideos = await Video.find()
    .sort('-views')
    .limit(5)
    .populate('subject')
    .select('title subject views likes');

  res.status(200).json(formatResponse({
    counts: {
      users: userCount,
      students: studentCount,
      teachers: teacherCount,
      notes: noteCount,
      syllabi: syllabusCount,
      videos: videoCount,
      pyqs: pyqCount,
      subjects: subjectCount,
      verifiedContent,
      pendingContent
    },
    recentUsers: recentUsers.map(user => cleanUserData(user)),
    popularContent: {
      notes: popularNotes,
      videos: popularVideos
    }
  }));
});

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private (Admin only)
exports.getUsers = asyncHandler(async (req, res) => {
  const { query, pagination } = advancedFilter(User, req.query);

  // Execute query
  const users = await query;
  const total = await User.countDocuments();

  // Format pagination metadata
  const paginationData = formatPagination(
    total,
    pagination.page,
    pagination.limit,
    `${req.protocol}://${req.get('host')}/api/admin/users`,
    req.query
  );

  res.status(200).json(formatResponse({
    count: users.length,
    pagination: paginationData,
    data: users.map(user => cleanUserData(user))
  }));
});

// @desc    Create a user (admin, teacher)
// @route   POST /api/admin/users
// @access  Private (Admin only)
exports.createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, branch, phone } = req.body;

  // Check if email already exists
  const userExists = await User.findOne({ email });
  if (userExists) {
    throw new ErrorResponse('Email already registered', 400);
  }

  // Create user
  const user = await User.create({
    name,
    email,
    password,
    role,
    branch,
    phone,
    isVerified: true // Auto-verify users created by admin
  });

  res.status(201).json(formatResponse(cleanUserData(user)));
});

// @desc    Get a single user
// @route   GET /api/admin/users/:id
// @access  Private (Admin only)
exports.getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).populate('subjects');

  if (!user) {
    throw new ErrorResponse(`User not found with id of ${req.params.id}`, 404);
  }

  res.status(200).json(formatResponse(cleanUserData(user)));
});

// @desc    Update a user
// @route   PUT /api/admin/users/:id
// @access  Private (Admin only)
exports.updateUser = asyncHandler(async (req, res) => {
  const { name, email, role, branch, year, semester, phone, isVerified } = req.body;

  // Build update object
  const updateFields = {};
  if (name) updateFields.name = name;
  if (email) updateFields.email = email;
  if (role) updateFields.role = role;
  if (branch) updateFields.branch = branch;
  if (year) updateFields.year = year;
  if (semester) updateFields.semester = semester;
  if (phone) updateFields.phone = phone;
  if (isVerified !== undefined) updateFields.isVerified = isVerified;

  // Update password if provided
  if (req.body.password) {
    const salt = await bcrypt.genSalt(10);
    updateFields.password = await bcrypt.hash(req.body.password, salt);
  }

  const user = await User.findByIdAndUpdate(req.params.id, updateFields, {
    new: true,
    runValidators: true
  }).populate('subjects');

  if (!user) {
    throw new ErrorResponse(`User not found with id of ${req.params.id}`, 404);
  }

  res.status(200).json(formatResponse(cleanUserData(user)));
});

// @desc    Delete a user
// @route   DELETE /api/admin/users/:id
// @access  Private (Admin only)
exports.deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    throw new ErrorResponse(`User not found with id of ${req.params.id}`, 404);
  }

  // Prevent deleting the last admin
  if (user.role === 'admin') {
    const adminCount = await User.countDocuments({ role: 'admin' });
    if (adminCount <= 1) {
      throw new ErrorResponse('Cannot delete the last admin user', 400);
    }
  }

  await user.deleteOne();

  res.status(200).json(formatResponse({ success: true }));
});

// @desc    Create a subject
// @route   POST /api/admin/subjects
// @access  Private (Admin only)
exports.createSubject = asyncHandler(async (req, res) => {
  const { name, code, description, branch, year, semester, credits, isElective } = req.body;

  // Check if subject code already exists
  const subjectExists = await Subject.findOne({ code });
  if (subjectExists) {
    throw new ErrorResponse('Subject code already exists', 400);
  }

  // Create subject
  const subject = await Subject.create({
    name,
    code,
    description,
    branch,
    year,
    semester,
    credits,
    isElective: isElective || false
  });

  res.status(201).json(formatResponse(subject));
});

// @desc    Get all subjects
// @route   GET /api/admin/subjects
// @access  Private (Admin only)
exports.getSubjects = asyncHandler(async (req, res) => {
  const { query, pagination } = advancedFilter(
    Subject,
    req.query,
    ['teachers', 'syllabus']
  );

  // Execute query
  const subjects = await query;
  const total = await Subject.countDocuments();

  // Format pagination metadata
  const paginationData = formatPagination(
    total,
    pagination.page,
    pagination.limit,
    `${req.protocol}://${req.get('host')}/api/admin/subjects`,
    req.query
  );

  res.status(200).json(formatResponse({
    count: subjects.length,
    pagination: paginationData,
    data: subjects
  }));
});

// @desc    Update a subject
// @route   PUT /api/admin/subjects/:id
// @access  Private (Admin only)
exports.updateSubject = asyncHandler(async (req, res) => {
  const {
    name,
    description,
    branch,
    year,
    semester,
    credits,
    teachers,
    syllabus,
    isElective,
    isActive
  } = req.body;

  // Build update object
  const updateFields = {};
  if (name) updateFields.name = name;
  if (description) updateFields.description = description;
  if (branch) updateFields.branch = branch;
  if (year) updateFields.year = year;
  if (semester) updateFields.semester = semester;
  if (credits) updateFields.credits = credits;
  if (teachers) updateFields.teachers = teachers;
  if (syllabus) updateFields.syllabus = syllabus;
  if (isElective !== undefined) updateFields.isElective = isElective;
  if (isActive !== undefined) updateFields.isActive = isActive;

  const subject = await Subject.findByIdAndUpdate(req.params.id, updateFields, {
    new: true,
    runValidators: true
  }).populate(['teachers', 'syllabus']);

  if (!subject) {
    throw new ErrorResponse(`Subject not found with id of ${req.params.id}`, 404);
  }

  res.status(200).json(formatResponse(subject));
});

// @desc    Delete a subject
// @route   DELETE /api/admin/subjects/:id
// @access  Private (Admin only)
exports.deleteSubject = asyncHandler(async (req, res) => {
  const subject = await Subject.findById(req.params.id);

  if (!subject) {
    throw new ErrorResponse(`Subject not found with id of ${req.params.id}`, 404);
  }

  // Check if subject is in use
  const notesCount = await Note.countDocuments({ subject: req.params.id });
  const syllabusCount = await Syllabus.countDocuments({ subject: req.params.id });
  const videosCount = await Video.countDocuments({ subject: req.params.id });
  const pyqsCount = await PYQ.countDocuments({ subject: req.params.id });

  if (notesCount > 0 || syllabusCount > 0 || videosCount > 0 || pyqsCount > 0) {
    throw new ErrorResponse(
      `Cannot delete subject with associated content. Found ${notesCount} notes, ${syllabusCount} syllabi, ${videosCount} videos, and ${pyqsCount} PYQs.`,
      400
    );
  }

  await subject.deleteOne();

  res.status(200).json(formatResponse({ success: true }));
});

// @desc    Assign teachers to subject
// @route   PUT /api/admin/subjects/:id/teachers
// @access  Private (Admin only)
exports.assignTeachers = asyncHandler(async (req, res) => {
  const { teacherIds } = req.body;

  if (!teacherIds || !Array.isArray(teacherIds)) {
    throw new ErrorResponse('Please provide an array of teacher IDs', 400);
  }

  const subject = await Subject.findById(req.params.id);

  if (!subject) {
    throw new ErrorResponse(`Subject not found with id of ${req.params.id}`, 404);
  }

  // Verify all teachers exist and have teacher role
  const teachers = await User.find({
    _id: { $in: teacherIds },
    role: 'teacher'
  });

  if (teachers.length !== teacherIds.length) {
    throw new ErrorResponse('One or more teacher IDs are invalid or not teachers', 400);
  }

  // Update subject with teachers
  subject.teachers = teacherIds;
  await subject.save();

  // Add subject to teachers' subjects
  for (const teacherId of teacherIds) {
    await User.findByIdAndUpdate(teacherId, {
      $addToSet: { subjects: subject._id }
    });
  }

  // Get updated subject with populated teachers
  const updatedSubject = await Subject.findById(req.params.id).populate('teachers');

  res.status(200).json(formatResponse(updatedSubject));
});

// @desc    Create an announcement
// @route   POST /api/admin/announcements
// @access  Private (Admin, Teacher)
exports.createAnnouncement = asyncHandler(async (req, res) => {
  // Add user to request body
  req.body.postedBy = req.user.id;

  const {
    title,
    content,
    priority,
    targetAudience,
    expiresAt,
    tags
  } = req.body;

  // Process attachments if any
  let attachments = [];
  if (req.filesInfo && req.filesInfo.length > 0) {
    attachments = req.filesInfo.map(file => ({
      fileUrl: file.url,
      filePath: file.path,
      fileType: file.originalname.split('.').pop(),
      fileName: file.originalname,
      fileSize: file.size
    }));
  }

  // Create announcement
  const announcement = await Announcement.create({
    title,
    content,
    postedBy: req.user.id,
    attachments,
    priority: priority || 'Medium',
    targetAudience: targetAudience ? JSON.parse(targetAudience) : { branch: 'All', year: 'All', semester: 'All', role: 'All' },
    expiresAt: expiresAt || null,
    tags: tags ? tags.split(',').map(tag => tag.trim()) : []
  });

  // Populate posted by field
  const populatedAnnouncement = await Announcement.findById(announcement._id).populate('postedBy');

  // Send notifications to target users
  try {
    await notifyUsers({
      title: `New Announcement: ${title}`,
      body: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
      data: {
        type: 'announcement',
        id: announcement._id
      },
      targetAudience: announcement.targetAudience
    });
  } catch (error) {
    console.error('Error sending announcement notifications:', error);
  }

  res.status(201).json(formatResponse(populatedAnnouncement));
});

// @desc    Get all announcements
// @route   GET /api/admin/announcements
// @access  Private (Admin, Teacher)
exports.getAnnouncements = asyncHandler(async (req, res) => {
  const { query, pagination } = advancedFilter(
    Announcement,
    req.query,
    ['postedBy']
  );

  // Execute query
  const announcements = await query;
  const total = await Announcement.countDocuments({ isActive: true });

  // Format pagination metadata
  const paginationData = formatPagination(
    total,
    pagination.page,
    pagination.limit,
    `${req.protocol}://${req.get('host')}/api/admin/announcements`,
    req.query
  );

  res.status(200).json(formatResponse({
    count: announcements.length,
    pagination: paginationData,
    data: announcements
  }));
});

// @desc    Update an announcement
// @route   PUT /api/admin/announcements/:id
// @access  Private (Admin, Owner)
exports.updateAnnouncement = asyncHandler(async (req, res) => {
  let announcement = await Announcement.findById(req.params.id);

  if (!announcement) {
    throw new ErrorResponse(`Announcement not found with id of ${req.params.id}`, 404);
  }

  // Check if user is owner or admin
  if (announcement.postedBy.toString() !== req.user.id && req.user.role !== 'admin') {
    throw new ErrorResponse('Not authorized to update this announcement', 403);
  }

  // Update fields
  const {
    title,
    content,
    priority,
    targetAudience,
    expiresAt,
    isActive,
    tags
  } = req.body;

  const updateFields = {};
  if (title) updateFields.title = title;
  if (content) updateFields.content = content;
  if (priority) updateFields.priority = priority;
  if (targetAudience) updateFields.targetAudience = JSON.parse(targetAudience);
  if (expiresAt) updateFields.expiresAt = expiresAt;
  if (isActive !== undefined) updateFields.isActive = isActive;
  if (tags) updateFields.tags = tags.split(',').map(tag => tag.trim());

  // Process attachments if any
  if (req.filesInfo && req.filesInfo.length > 0) {
    const newAttachments = req.filesInfo.map(file => ({
      fileUrl: file.url,
      filePath: file.path,
      fileType: file.originalname.split('.').pop(),
      fileName: file.originalname,
      fileSize: file.size
    }));

    updateFields.attachments = [...announcement.attachments, ...newAttachments];
  }

  // Update announcement
  announcement = await Announcement.findByIdAndUpdate(req.params.id, updateFields, {
    new: true,
    runValidators: true
  }).populate('postedBy');

  res.status(200).json(formatResponse(announcement));
});

// @desc    Delete an announcement
// @route   DELETE /api/admin/announcements/:id
// @access  Private (Admin, Owner)
exports.deleteAnnouncement = asyncHandler(async (req, res) => {
  const announcement = await Announcement.findById(req.params.id);

  if (!announcement) {
    throw new ErrorResponse(`Announcement not found with id of ${req.params.id}`, 404);
  }

  // Check if user is owner or admin
  if (announcement.postedBy.toString() !== req.user.id && req.user.role !== 'admin') {
    throw new ErrorResponse('Not authorized to delete this announcement', 403);
  }

  await announcement.deleteOne();

  res.status(200).json(formatResponse({ success: true }));
});

// @desc    Get pending content for verification
// @route   GET /api/admin/pending-content
// @access  Private (Admin, Teacher)
exports.getPendingContent = asyncHandler(async (req, res) => {
  // Get pending notes
  const notes = await Note.find({ isVerified: false })
    .populate('subject')
    .populate('uploadedBy')
    .sort('-createdAt');

  // Get pending videos
  const videos = await Video.find({ isVerified: false })
    .populate('subject')
    .populate('uploadedBy')
    .sort('-createdAt');

  // Get pending PYQs
  const pyqs = await PYQ.find({ isVerified: false })
    .populate('subject')
    .populate('uploadedBy')
    .sort('-createdAt');

  res.status(200).json(formatResponse({
    total: notes.length + videos.length + pyqs.length,
    notes,
    videos,
    pyqs
  }));
});

// @desc    Verify content (notes, videos, pyqs)
// @route   PUT /api/admin/verify-content
// @access  Private (Admin, Teacher)
exports.verifyContent = asyncHandler(async (req, res) => {
  const { contentType, contentId } = req.body;

  if (!contentType || !contentId) {
    throw new ErrorResponse('Please provide content type and ID', 400);
  }

  let content;
  let contentModel;
  let contentTitle;

  // Find the appropriate content based on type
  switch (contentType) {
    case 'note':
      contentModel = Note;
      content = await Note.findById(contentId);
      contentTitle = content ? content.title : '';
      break;
    case 'video':
      contentModel = Video;
      content = await Video.findById(contentId);
      contentTitle = content ? content.title : '';
      break;
    case 'pyq':
      contentModel = PYQ;
      content = await PYQ.findById(contentId);
      contentTitle = content ? content.title : '';
      break;
    default:
      throw new ErrorResponse('Invalid content type', 400);
  }

  if (!content) {
    throw new ErrorResponse(`${contentType} not found with id ${contentId}`, 404);
  }

  // Update verification status
  content.isVerified = true;
  await content.save();

  // Send notification to the content uploader
  try {
    if (content.uploadedBy) {
      await notifyUsers({
        title: `Your ${contentType} has been verified`,
        body: `${contentTitle} has been verified and is now available to all users.`,
        data: {
          type: contentType,
          id: content._id
        },
        targetUsers: [content.uploadedBy]
      });
    }
  } catch (error) {
    console.error('Error sending verification notification:', error);
  }

  res.status(200).json(formatResponse({
    success: true,
    message: `${contentType} verified successfully`
  }));
});