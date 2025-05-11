const asyncHandler = require('express-async-handler');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const User = require('../models/User');
const { ErrorResponse } = require('../middlewares/errorHandler');
const { formatResponse, formatPagination, cleanUserData } = require('../utils/formatData');
const { deleteFile } = require('../middlewares/upload');
const { advancedFilter } = require('../utils/filterQuery');
const { notifyUsers } = require('../services/notificationService');

// @desc    Get all chats for a user
// @route   GET /api/community/chats
// @access  Private
exports.getChats = asyncHandler(async (req, res) => {
  // Get user's chats
  const chats = await Chat.find({
    users: { $elemMatch: { $eq: req.user._id } }
  })
    .populate('users', '-__v')
    .populate('groupAdmin', '-__v')
    .populate('latestMessage')
    .populate({
      path: 'latestMessage',
      populate: {
        path: 'sender',
        select: 'name avatar'
      }
    })
    .sort('-updatedAt');
  
  // Clean sensitive information from users
  const cleanedChats = chats.map(chat => {
    const cleanedChat = { ...chat.toObject() };
    cleanedChat.users = cleanedChat.users.map(user => cleanUserData(user));
    if (cleanedChat.groupAdmin) {
      cleanedChat.groupAdmin = cleanUserData(cleanedChat.groupAdmin);
    }
    return cleanedChat;
  });
  
  res.status(200).json(formatResponse(cleanedChats));
});

// @desc    Create or access a one-on-one chat
// @route   POST /api/community/chats
// @access  Private
exports.accessChat = asyncHandler(async (req, res) => {
  const { userId } = req.body;
  
  if (!userId) {
    throw new ErrorResponse('Please provide a user ID', 400);
  }
  
  // Check if chat exists
  let chat = await Chat.findOne({
    isGroupChat: false,
    $and: [
      { users: { $elemMatch: { $eq: req.user._id } } },
      { users: { $elemMatch: { $eq: userId } } }
    ]
  })
    .populate('users', '-__v')
    .populate('latestMessage');
  
  if (chat) {
    // Populate nested message sender
    if (chat.latestMessage) {
      chat = await User.populate(chat, {
        path: 'latestMessage.sender',
        select: 'name avatar'
      });
    }
  } else {
    // Create new chat
    const chatData = {
      chatName: 'sender',
      isGroupChat: false,
      users: [req.user._id, userId]
    };
    
    const createdChat = await Chat.create(chatData);
    
    chat = await Chat.findById(createdChat._id).populate('users', '-__v');
  }
  
  // Clean user data
  const cleanedChat = { ...chat.toObject() };
  cleanedChat.users = cleanedChat.users.map(user => cleanUserData(user));
  
  res.status(200).json(formatResponse(cleanedChat));
});

// @desc    Create a group chat
// @route   POST /api/community/chats/group
// @access  Private
exports.createGroupChat = asyncHandler(async (req, res) => {
  let { 
    chatName, 
    users, 
    isPublic, 
    subject, 
    branch, 
    year, 
    semester 
  } = req.body;
  
  if (!chatName) {
    throw new ErrorResponse('Please provide a chat name', 400);
  }
  
  // If users array is provided as a string, parse it
  if (users && typeof users === 'string') {
    users = JSON.parse(users);
  }
  
  // Add current user to the group
  if (!users || !Array.isArray(users)) {
    users = [];
  }
  
  users.push(req.user._id);
  
  // Create group chat
  const groupChat = await Chat.create({
    chatName,
    isGroupChat: true,
    users,
    groupAdmin: req.user._id,
    isPublic: isPublic === 'true' || isPublic === true,
    subject,
    branch,
    year,
    semester
  });
  
  // Get full chat details
  const fullGroupChat = await Chat.findById(groupChat._id)
    .populate('users', '-__v')
    .populate('groupAdmin', '-__v');
  
  // Clean user data
  const cleanedChat = { ...fullGroupChat.toObject() };
  cleanedChat.users = cleanedChat.users.map(user => cleanUserData(user));
  if (cleanedChat.groupAdmin) {
    cleanedChat.groupAdmin = cleanUserData(cleanedChat.groupAdmin);
  }
  
  res.status(201).json(formatResponse(cleanedChat));
});

// @desc    Update a group chat
// @route   PUT /api/community/chats/group/:id
// @access  Private (Group Admin or app Admin)
exports.updateGroupChat = asyncHandler(async (req, res) => {
  const { chatName, isPublic, subject, branch, year, semester } = req.body;
  
  const chat = await Chat.findById(req.params.id);
  
  if (!chat) {
    throw new ErrorResponse('Chat not found', 404);
  }
  
  // Check if user is group admin or app admin
  if (
    chat.groupAdmin.toString() !== req.user._id.toString() && 
    req.user.role !== 'admin'
  ) {
    throw new ErrorResponse('Not authorized to update this group', 403);
  }
  
  // Update fields
  const updateFields = {};
  if (chatName) updateFields.chatName = chatName;
  if (isPublic !== undefined) updateFields.isPublic = isPublic === 'true' || isPublic === true;
  if (subject) updateFields.subject = subject;
  if (branch) updateFields.branch = branch;
  if (year) updateFields.year = parseInt(year);
  if (semester) updateFields.semester = parseInt(semester);
  
  // Update group chat
  const updatedChat = await Chat.findByIdAndUpdate(
    req.params.id,
    updateFields,
    { new: true }
  )
    .populate('users', '-__v')
    .populate('groupAdmin', '-__v');
  
  // Clean user data
  const cleanedChat = { ...updatedChat.toObject() };
  cleanedChat.users = cleanedChat.users.map(user => cleanUserData(user));
  if (cleanedChat.groupAdmin) {
    cleanedChat.groupAdmin = cleanUserData(cleanedChat.groupAdmin);
  }
  
  res.status(200).json(formatResponse(cleanedChat));
});

// @desc    Add users to a group
// @route   PUT /api/community/chats/group/:id/add
// @access  Private (Group Admin or app Admin)
exports.addToGroup = asyncHandler(async (req, res) => {
  const { users } = req.body;
  
  if (!users || !Array.isArray(users)) {
    throw new ErrorResponse('Please provide an array of user IDs', 400);
  }
  
  const chat = await Chat.findById(req.params.id);
  
  if (!chat) {
    throw new ErrorResponse('Chat not found', 404);
  }
  
  // Check if user is group admin or app admin
  if (
    chat.groupAdmin.toString() !== req.user._id.toString() && 
    req.user.role !== 'admin'
  ) {
    throw new ErrorResponse('Not authorized to add users to this group', 403);
  }
  
  // Add users to group
  const updatedChat = await Chat.findByIdAndUpdate(
    req.params.id,
    { $addToSet: { users: { $each: users } } },
    { new: true }
  )
    .populate('users', '-__v')
    .populate('groupAdmin', '-__v');
  
  // Clean user data
  const cleanedChat = { ...updatedChat.toObject() };
  cleanedChat.users = cleanedChat.users.map(user => cleanUserData(user));
  if (cleanedChat.groupAdmin) {
    cleanedChat.groupAdmin = cleanUserData(cleanedChat.groupAdmin);
  }
  
  res.status(200).json(formatResponse(cleanedChat));
});

// @desc    Remove a user from a group
// @route   PUT /api/community/chats/group/:id/remove/:userId
// @access  Private (Group Admin, app Admin, or self-removal)
exports.removeFromGroup = asyncHandler(async (req, res) => {
  const chat = await Chat.findById(req.params.id);
  
  if (!chat) {
    throw new ErrorResponse('Chat not found', 404);
  }
  
  // Check if user is authorized to remove
  const isSelfRemoval = req.params.userId === req.user._id.toString();
  const isGroupAdmin = chat.groupAdmin.toString() === req.user._id.toString();
  const isAppAdmin = req.user.role === 'admin';
  
  if (!isSelfRemoval && !isGroupAdmin && !isAppAdmin) {
    throw new ErrorResponse('Not authorized to remove users from this group', 403);
  }
  
  // Don't allow removing the group admin unless it's by an app admin
  if (
    req.params.userId === chat.groupAdmin.toString() && 
    !isAppAdmin
  ) {
    throw new ErrorResponse('Cannot remove the group admin', 403);
  }
  
  // Remove user from group
  const updatedChat = await Chat.findByIdAndUpdate(
    req.params.id,
    { $pull: { users: req.params.userId } },
    { new: true }
  )
    .populate('users', '-__v')
    .populate('groupAdmin', '-__v');
  
  // Clean user data
  const cleanedChat = { ...updatedChat.toObject() };
  cleanedChat.users = cleanedChat.users.map(user => cleanUserData(user));
  if (cleanedChat.groupAdmin) {
    cleanedChat.groupAdmin = cleanUserData(cleanedChat.groupAdmin);
  }
  
  res.status(200).json(formatResponse(cleanedChat));
});

// @desc    Get public group chats with filtering
// @route   GET /api/community/chats/public
// @access  Private
exports.getPublicGroups = asyncHandler(async (req, res) => {
  // Filter parameters
  const filter = { isPublic: true, isGroupChat: true };
  
  // Add branch filter if provided
  if (req.query.branch) {
    filter.branch = req.query.branch;
  }
  
  // Add year filter if provided
  if (req.query.year) {
    filter.year = parseInt(req.query.year);
  }
  
  // Add semester filter if provided
  if (req.query.semester) {
    filter.semester = parseInt(req.query.semester);
  }
  
  // Add subject filter if provided
  if (req.query.subject) {
    filter.subject = req.query.subject;
  }
  
  // Get filtered chats with pagination
  const { query, pagination } = advancedFilter(
    Chat,
    { ...req.query, ...filter },
    ['users', 'groupAdmin', 'subject']
  );
  
  // Execute query
  const chats = await query;
  const total = await Chat.countDocuments(filter);
  
  // Format pagination metadata
  const paginationData = formatPagination(
    total,
    pagination.page,
    pagination.limit,
    `${req.protocol}://${req.get('host')}/api/community/chats/public`,
    req.query
  );
  
  // Clean user data
  const cleanedChats = chats.map(chat => {
    const cleanedChat = { ...chat.toObject() };
    cleanedChat.users = cleanedChat.users.map(user => cleanUserData(user));
    if (cleanedChat.groupAdmin) {
      cleanedChat.groupAdmin = cleanUserData(cleanedChat.groupAdmin);
    }
    return cleanedChat;
  });
  
  res.status(200).json(formatResponse({
    count: chats.length,
    pagination: paginationData,
    data: cleanedChats
  }));
});

// @desc    Get messages for a chat
// @route   GET /api/community/messages/:chatId
// @access  Private
exports.getMessages = asyncHandler(async (req, res) => {
  const chat = await Chat.findById(req.params.chatId);
  
  if (!chat) {
    throw new ErrorResponse('Chat not found', 404);
  }
  
  // Check if user is part of the chat
  if (!chat.users.includes(req.user._id)) {
    throw new ErrorResponse('Not authorized to access this chat', 403);
  }
  
  // Get messages with pagination
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const skip = (page - 1) * limit;
  
  const messages = await Message.find({ chat: req.params.chatId })
    .populate('sender', 'name avatar')
    .sort('-createdAt')
    .skip(skip)
    .limit(limit);
  
  // Get total count
  const total = await Message.countDocuments({ chat: req.params.chatId });
  
  // Format pagination metadata
  const paginationData = formatPagination(
    total,
    page,
    limit,
    `${req.protocol}://${req.get('host')}/api/community/messages/${req.params.chatId}`,
    req.query
  );
  
  // Mark messages as read by current user
  await Message.updateMany(
    {
      chat: req.params.chatId,
      readBy: { $ne: req.user._id }
    },
    {
      $addToSet: { readBy: req.user._id }
    }
  );
  
  res.status(200).json(formatResponse({
    count: messages.length,
    pagination: paginationData,
    data: messages.reverse() // Reverse to get oldest first
  }));
});

// @desc    Send a message
// @route   POST /api/community/messages
// @access  Private
exports.sendMessage = asyncHandler(async (req, res) => {
  const { chatId, content } = req.body;
  
  if (!chatId || !content) {
    throw new ErrorResponse('Please provide chat ID and message content', 400);
  }
  
  const chat = await Chat.findById(chatId);
  
  if (!chat) {
    throw new ErrorResponse('Chat not found', 404);
  }
  
  // Check if user is part of the chat
  if (!chat.users.includes(req.user._id)) {
    throw new ErrorResponse('Not authorized to send messages to this chat', 403);
  }
  
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
  
  // Create message
  let message = await Message.create({
    sender: req.user._id,
    content,
    chat: chatId,
    readBy: [req.user._id],
    attachments
  });
  
  // Populate message
  message = await Message.findById(message._id)
    .populate('sender', 'name avatar')
    .populate('chat');
  
  // Update chat's latestMessage
  await Chat.findByIdAndUpdate(chatId, { latestMessage: message._id });
  
  // Notify other chat members
  try {
    const otherUsers = chat.users.filter(
      userId => userId.toString() !== req.user._id.toString()
    );
    
    if (otherUsers.length > 0) {
      const sender = await User.findById(req.user._id).select('name');
      
      await notifyUsers({
        title: `New message from ${sender.name}`,
        body: content.length > 50 ? content.substring(0, 50) + '...' : content,
        data: {
          type: 'message',
          chatId: chat._id
        },
        targetUsers: otherUsers
      });
    }
  } catch (error) {
    console.error('Error sending message notification:', error);
  }
  
  res.status(201).json(formatResponse(message));
});

// @desc    Delete a message
// @route   DELETE /api/community/messages/:id
// @access  Private (Sender or Admin)
exports.deleteMessage = asyncHandler(async (req, res) => {
  const message = await Message.findById(req.params.id);
  
  if (!message) {
    throw new ErrorResponse('Message not found', 404);
  }
  
  // Check if user is sender or admin
  if (
    message.sender.toString() !== req.user._id.toString() && 
    req.user.role !== 'admin'
  ) {
    throw new ErrorResponse('Not authorized to delete this message', 403);
  }
  
  // Mark message as deleted (soft delete)
  message.isDeleted = true;
  
  // If there are attachments, update content
  if (message.attachments && message.attachments.length > 0) {
    message.content = '[Attachments removed]';
    
    // Delete attachment files
    for (const attachment of message.attachments) {
      deleteFile(attachment.filePath);
    }
    
    message.attachments = [];
  } else {
    message.content = '[Message deleted]';
  }
  
  await message.save();
  
  res.status(200).json(formatResponse({ success: true }));
});

// @desc    Join a public group chat
// @route   PUT /api/community/chats/join/:id
// @access  Private
exports.joinGroup = asyncHandler(async (req, res) => {
  const chat = await Chat.findById(req.params.id);
  
  if (!chat) {
    throw new ErrorResponse('Chat not found', 404);
  }
  
  // Check if it's a public group
  if (!chat.isPublic || !chat.isGroupChat) {
    throw new ErrorResponse('This chat is not a public group', 400);
  }
  
  // Check if user is already in the group
  if (chat.users.includes(req.user._id)) {
    throw new ErrorResponse('You are already a member of this group', 400);
  }
  
  // Add user to group
  const updatedChat = await Chat.findByIdAndUpdate(
    req.params.id,
    { $addToSet: { users: req.user._id } },
    { new: true }
  )
    .populate('users', '-__v')
    .populate('groupAdmin', '-__v');
  
  // Notify group admin
  try {
    const user = await User.findById(req.user._id).select('name');
    
    await notifyUsers({
      title: `New member in ${chat.chatName}`,
      body: `${user.name} has joined the group`,
      data: {
        type: 'group',
        chatId: chat._id
      },
      targetUsers: [chat.groupAdmin]
    });
  } catch (error) {
    console.error('Error sending group join notification:', error);
  }
  
  // Clean user data
  const cleanedChat = { ...updatedChat.toObject() };
  cleanedChat.users = cleanedChat.users.map(user => cleanUserData(user));
  if (cleanedChat.groupAdmin) {
    cleanedChat.groupAdmin = cleanUserData(cleanedChat.groupAdmin);
  }
  
  res.status(200).json(formatResponse(cleanedChat));
});

// @desc    Leave a group chat
// @route   PUT /api/community/chats/leave/:id
// @access  Private
exports.leaveGroup = asyncHandler(async (req, res) => {
  const chat = await Chat.findById(req.params.id);
  
  if (!chat) {
    throw new ErrorResponse('Chat not found', 404);
  }
  
  // Check if it's a group chat
  if (!chat.isGroupChat) {
    throw new ErrorResponse('This is not a group chat', 400);
  }
  
  // Check if user is in the group
  if (!chat.users.includes(req.user._id)) {
    throw new ErrorResponse('You are not a member of this group', 400);
  }
  
  // Cannot leave if you're the group admin
  if (chat.groupAdmin.toString() === req.user._id.toString()) {
    throw new ErrorResponse('Group admin cannot leave. Transfer ownership first or delete the group', 400);
  }
  
  // Remove user from group
  await Chat.findByIdAndUpdate(
    req.params.id,
    { $pull: { users: req.user._id } }
  );
  
  res.status(200).json(formatResponse({ 
    success: true,
    message: `You have left the group "${chat.chatName}"`
  }));
});

// @desc    Get unread messages count
// @route   GET /api/community/unread
// @access  Private
exports.getUnreadCount = asyncHandler(async (req, res) => {
  // Get user's chats
  const userChats = await Chat.find({
    users: { $elemMatch: { $eq: req.user._id } }
  }).select('_id');
  
  const chatIds = userChats.map(chat => chat._id);
  
  // Get unread messages count by chat
  const unreadCounts = await Message.aggregate([
    {
      $match: {
        chat: { $in: chatIds },
        sender: { $ne: req.user._id },
        readBy: { $ne: req.user._id },
        isDeleted: { $ne: true }
      }
    },
    {
      $group: {
        _id: '$chat',
        count: { $sum: 1 }
      }
    }
  ]);
  
  // Format result
  const unreadByChat = {};
  unreadCounts.forEach(item => {
    unreadByChat[item._id] = item.count;
  });
  
  // Get total unread
  const totalUnread = unreadCounts.reduce((acc, item) => acc + item.count, 0);
  
  res.status(200).json(formatResponse({
    totalUnread,
    unreadByChat
  }));
});

// @desc    Transfer group ownership
// @route   PUT /api/community/chats/group/:id/transfer/:userId
// @access  Private (Group Admin or app Admin)
exports.transferGroupOwnership = asyncHandler(async (req, res) => {
  const chat = await Chat.findById(req.params.id);
  
  if (!chat) {
    throw new ErrorResponse('Chat not found', 404);
  }
  
  // Check if user is group admin or app admin
  if (
    chat.groupAdmin.toString() !== req.user._id.toString() && 
    req.user.role !== 'admin'
  ) {
    throw new ErrorResponse('Not authorized to transfer group ownership', 403);
  }
  
  // Check if target user exists and is in the group
  const targetUser = await User.findById(req.params.userId);
  if (!targetUser) {
    throw new ErrorResponse('Target user not found', 404);
  }
  
  if (!chat.users.includes(targetUser._id)) {
    throw new ErrorResponse('Target user is not a member of this group', 400);
  }
  
  // Transfer ownership
  const updatedChat = await Chat.findByIdAndUpdate(
    req.params.id,
    { groupAdmin: targetUser._id },
    { new: true }
  )
    .populate('users', '-__v')
    .populate('groupAdmin', '-__v');
  
  // Notify new admin
  try {
    await notifyUsers({
      title: `Group Ownership Transfer: ${chat.chatName}`,
      body: `You are now the admin of the group "${chat.chatName}"`,
      data: {
        type: 'group',
        chatId: chat._id
      },
      targetUsers: [targetUser._id]
    });
  } catch (error) {
    console.error('Error sending ownership transfer notification:', error);
  }
  
  // Clean user data
  const cleanedChat = { ...updatedChat.toObject() };
  cleanedChat.users = cleanedChat.users.map(user => cleanUserData(user));
  if (cleanedChat.groupAdmin) {
    cleanedChat.groupAdmin = cleanUserData(cleanedChat.groupAdmin);
  }
  
  res.status(200).json(formatResponse(cleanedChat));
});