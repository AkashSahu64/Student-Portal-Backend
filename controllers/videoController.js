const asyncHandler = require('express-async-handler');
const Video = require('../models/Video');
const { ErrorResponse } = require('../middlewares/errorHandler');
const { advancedFilter, filterEducationalResources } = require('../utils/filterQuery');
const { formatResponse, formatPagination } = require('../utils/formatData');
const { deleteFile } = require('../middlewares/upload');
const youtubeService = require('../services/youtubeService');

// @desc    Get all videos with filtering
// @route   GET /api/videos
// @access  Private
exports.getVideos = asyncHandler(async (req, res) => {
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

  // Get filtered videos with pagination
  const { query, pagination } = advancedFilter(
    Video,
    mergedQuery,
    ['subject', 'uploadedBy']
  );

  // Execute query
  const videos = await query;
  const total = await Video.countDocuments(resourceFilter);

  // Format pagination metadata
  const paginationData = formatPagination(
    total,
    pagination.page,
    pagination.limit,
    `${req.protocol}://${req.get('host')}/api/videos`,
    req.query
  );

  res.status(200).json(formatResponse({
    count: videos.length,
    pagination: paginationData,
    data: videos
  }));
});

// @desc    Get a single video
// @route   GET /api/videos/:id
// @access  Private
exports.getVideo = asyncHandler(async (req, res) => {
  const video = await Video.findById(req.params.id)
    .populate('subject')
    .populate('uploadedBy')
    .populate({
      path: 'comments.user',
      select: 'name avatar role'
    });

  if (!video) {
    throw new ErrorResponse(`Video not found with id of ${req.params.id}`, 404);
  }

  // Increment views counter
  video.views += 1;
  await video.save();

  res.status(200).json(formatResponse(video));
});

// @desc    Create a new video (upload or YouTube link)
// @route   POST /api/videos
// @access  Private
exports.createVideo = asyncHandler(async (req, res) => {
  // Add user to request body
  req.body.uploadedBy = req.user.id;

  // Extract video data
  const { 
    title,
    description,
    subject,
    branch,
    year,
    semester,
    tags,
    youtubeUrl
  } = req.body;

  let videoData = {
    title,
    description,
    subject,
    branch,
    year,
    semester,
    tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
    uploadedBy: req.user.id,
    isVerified: req.user.role === 'student' ? false : true
  };

  // Check if it's a YouTube video or file upload
  if (youtubeUrl) {
    // It's a YouTube video
    videoData.isYoutubeVideo = true;
    videoData.videoUrl = youtubeUrl;
    
    // Get YouTube video info (thumbnail, duration)
    try {
      const videoInfo = await youtubeService.getVideoInfo(youtubeUrl);
      if (videoInfo) {
        videoData.thumbnailUrl = videoInfo.thumbnailUrl;
        videoData.duration = videoInfo.duration;
      }
    } catch (error) {
      console.error('Error fetching YouTube info:', error);
    }
  } else if (req.fileInfo) {
    // It's a file upload
    videoData.isYoutubeVideo = false;
    videoData.videoUrl = req.fileInfo.url;
    videoData.filePath = req.fileInfo.path;
    videoData.thumbnailUrl = 'default-thumbnail.jpg'; // Default thumbnail
    
    // TODO: Generate thumbnail from video file
  } else {
    throw new ErrorResponse('Please provide either a YouTube URL or upload a video file', 400);
  }

  // Create video
  const video = await Video.create(videoData);

  // Populate related fields for response
  const populatedVideo = await Video.findById(video._id)
    .populate('subject')
    .populate('uploadedBy');

  res.status(201).json(formatResponse(populatedVideo));
});

// @desc    Update a video
// @route   PUT /api/videos/:id
// @access  Private
exports.updateVideo = asyncHandler(async (req, res) => {
  let video = await Video.findById(req.params.id);

  if (!video) {
    throw new ErrorResponse(`Video not found with id of ${req.params.id}`, 404);
  }

  // Make sure user is video owner or admin
  if (video.uploadedBy.toString() !== req.user.id && req.user.role !== 'admin') {
    throw new ErrorResponse(`User ${req.user.id} is not authorized to update this video`, 403);
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
    tags,
    youtubeUrl
  } = req.body;

  if (title) updateFields.title = title;
  if (description) updateFields.description = description;
  if (subject) updateFields.subject = subject;
  if (branch) updateFields.branch = branch;
  if (year) updateFields.year = year;
  if (semester) updateFields.semester = semester;
  if (tags) updateFields.tags = tags.split(',').map(tag => tag.trim());

  // Handle YouTube URL update
  if (youtubeUrl && youtubeUrl !== video.videoUrl) {
    updateFields.isYoutubeVideo = true;
    updateFields.videoUrl = youtubeUrl;
    
    // Get updated YouTube video info
    try {
      const videoInfo = await youtubeService.getVideoInfo(youtubeUrl);
      if (videoInfo) {
        updateFields.thumbnailUrl = videoInfo.thumbnailUrl;
        updateFields.duration = videoInfo.duration;
      }
    } catch (error) {
      console.error('Error fetching YouTube info:', error);
    }
  }
  // Handle file upload update
  else if (req.fileInfo && !video.isYoutubeVideo) {
    // Delete old file if it exists and it's not a YouTube video
    if (video.filePath) {
      deleteFile(video.filePath);
    }
    
    updateFields.videoUrl = req.fileInfo.url;
    updateFields.filePath = req.fileInfo.path;
    
    // TODO: Generate new thumbnail
  }

  // Update video
  video = await Video.findByIdAndUpdate(req.params.id, updateFields, {
    new: true,
    runValidators: true
  })
    .populate('subject')
    .populate('uploadedBy');

  res.status(200).json(formatResponse(video));
});

// @desc    Delete a video
// @route   DELETE /api/videos/:id
// @access  Private
exports.deleteVideo = asyncHandler(async (req, res) => {
  const video = await Video.findById(req.params.id);

  if (!video) {
    throw new ErrorResponse(`Video not found with id of ${req.params.id}`, 404);
  }

  // Make sure user is video owner or admin
  if (video.uploadedBy.toString() !== req.user.id && req.user.role !== 'admin') {
    throw new ErrorResponse(`User ${req.user.id} is not authorized to delete this video`, 403);
  }

  // Delete file from storage if it's not a YouTube video
  if (!video.isYoutubeVideo && video.filePath) {
    deleteFile(video.filePath);
  }

  // Delete video from database
  await video.deleteOne();

  res.status(200).json(formatResponse({ success: true }));
});

// @desc    Verify a video (admin/teacher only)
// @route   PUT /api/videos/:id/verify
// @access  Private (Admin, Teacher)
exports.verifyVideo = asyncHandler(async (req, res) => {
  const video = await Video.findById(req.params.id);

  if (!video) {
    throw new ErrorResponse(`Video not found with id of ${req.params.id}`, 404);
  }

  // Update verification status
  video.isVerified = true;
  await video.save();

  res.status(200).json(formatResponse({ 
    success: true,
    message: 'Video verified successfully' 
  }));
});

// @desc    Like a video
// @route   PUT /api/videos/:id/like
// @access  Private
exports.likeVideo = asyncHandler(async (req, res) => {
  const video = await Video.findById(req.params.id);

  if (!video) {
    throw new ErrorResponse(`Video not found with id of ${req.params.id}`, 404);
  }

  // Check if user already liked the video
  const alreadyLiked = video.usersLiked.includes(req.user.id);

  if (alreadyLiked) {
    // Remove like
    video.likes = Math.max(0, video.likes - 1);
    video.usersLiked = video.usersLiked.filter(
      userId => userId.toString() !== req.user.id
    );
  } else {
    // Add like
    video.likes += 1;
    video.usersLiked.push(req.user.id);
  }

  await video.save();

  res.status(200).json(formatResponse({ 
    success: true,
    likes: video.likes,
    liked: !alreadyLiked
  }));
});

// @desc    Add a comment to a video
// @route   POST /api/videos/:id/comments
// @access  Private
exports.addComment = asyncHandler(async (req, res) => {
  const { text } = req.body;
  
  if (!text) {
    throw new ErrorResponse('Please provide comment text', 400);
  }

  const video = await Video.findById(req.params.id);

  if (!video) {
    throw new ErrorResponse(`Video not found with id of ${req.params.id}`, 404);
  }

  // Add comment
  video.comments.push({
    text,
    user: req.user.id
  });

  await video.save();

  // Get populated video with comment user info
  const updatedVideo = await Video.findById(req.params.id)
    .populate({
      path: 'comments.user',
      select: 'name avatar role'
    });

  res.status(200).json(formatResponse({
    success: true,
    comments: updatedVideo.comments
  }));
});

// @desc    Delete a comment from a video
// @route   DELETE /api/videos/:id/comments/:commentId
// @access  Private
exports.deleteComment = asyncHandler(async (req, res) => {
  const video = await Video.findById(req.params.id);

  if (!video) {
    throw new ErrorResponse(`Video not found with id of ${req.params.id}`, 404);
  }

  // Find comment
  const comment = video.comments.id(req.params.commentId);

  if (!comment) {
    throw new ErrorResponse(`Comment not found with id of ${req.params.commentId}`, 404);
  }

  // Check if user is comment owner or admin
  if (comment.user.toString() !== req.user.id && req.user.role !== 'admin') {
    throw new ErrorResponse(`User ${req.user.id} is not authorized to delete this comment`, 403);
  }

  // Remove comment
  comment.deleteOne();
  await video.save();

  res.status(200).json(formatResponse({ 
    success: true,
    message: 'Comment deleted successfully'
  }));
});