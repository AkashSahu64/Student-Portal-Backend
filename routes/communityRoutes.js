const express = require('express');
const router = express.Router();
const { 
  getChats,
  accessChat,
  createGroupChat,
  updateGroupChat,
  addToGroup,
  removeFromGroup,
  getPublicGroups,
  getMessages,
  sendMessage,
  deleteMessage,
  joinGroup,
  leaveGroup,
  getUnreadCount,
  transferGroupOwnership
} = require('../controllers/communityController');
const { protect, isVerified } = require('../middlewares/authMiddleware');
const { uploadMultiple } = require('../middlewares/upload');

// All routes are protected
router.use(protect);
router.use(isVerified);

// Chat routes
router.route('/chats')
  .get(getChats)
  .post(accessChat);

// Group chat routes
router.route('/chats/group')
  .post(createGroupChat);

router.route('/chats/group/:id')
  .put(updateGroupChat);

// Add users to group
router.put('/chats/group/:id/add', addToGroup);

// Remove user from group
router.put('/chats/group/:id/remove/:userId', removeFromGroup);

// Transfer group ownership
router.put('/chats/group/:id/transfer/:userId', transferGroupOwnership);

// Get public groups
router.get('/chats/public', getPublicGroups);

// Join a public group
router.put('/chats/join/:id', joinGroup);

// Leave a group
router.put('/chats/leave/:id', leaveGroup);

// Message routes
router.route('/messages')
  .post(uploadMultiple('attachments', 3), sendMessage);

// Get messages for a chat
router.get('/messages/:chatId', getMessages);

// Delete a message
router.delete('/messages/:id', deleteMessage);

// Get unread messages count
router.get('/unread', getUnreadCount);

module.exports = router;