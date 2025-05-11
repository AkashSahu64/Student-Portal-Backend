/**
 * Initialize Socket.io
 * @param {Object} io - Socket.io instance
 */
module.exports = (io) => {
  // User online status management
  const onlineUsers = new Map();

  // Chat namespace
  const chatNamespace = io.of('/chat');

  chatNamespace.on('connection', (socket) => {
    console.log('User connected to chat socket:', socket.id);

    // Authenticate user
    socket.on('authenticate', ({ userId }) => {
      if (!userId) {
        socket.emit('error', { message: 'User ID is required' });
        return;
      }

      // Store user info
      onlineUsers.set(socket.id, userId);
      socket.join(`user:${userId}`);

      // Broadcast user online status
      chatNamespace.emit('userOnline', userId);

      socket.emit('authenticated', { success: true });
    });

    // Join a chat room
    socket.on('joinChat', ({ chatId }) => {
      if (!chatId) {
        socket.emit('error', { message: 'Chat ID is required' });
        return;
      }

      socket.join(`chat:${chatId}`);
      console.log(`Socket ${socket.id} joined chat ${chatId}`);
    });

    // Leave a chat room
    socket.on('leaveChat', ({ chatId }) => {
      if (!chatId) {
        socket.emit('error', { message: 'Chat ID is required' });
        return;
      }

      socket.leave(`chat:${chatId}`);
      console.log(`Socket ${socket.id} left chat ${chatId}`);
    });

    // New message
    socket.on('newMessage', (message) => {
      if (!message || !message.chatId) {
        socket.emit('error', { message: 'Invalid message format' });
        return;
      }

      // Broadcast to all in the chat room
      socket.to(`chat:${message.chatId}`).emit('messageReceived', message);
    });

    // Typing status
    socket.on('typing', ({ chatId, userId }) => {
      socket.to(`chat:${chatId}`).emit('userTyping', { chatId, userId });
    });

    // Stop typing status
    socket.on('stopTyping', ({ chatId, userId }) => {
      socket.to(`chat:${chatId}`).emit('userStoppedTyping', { chatId, userId });
    });

    // Message read status
    socket.on('messageRead', ({ messageId, chatId, userId }) => {
      socket.to(`chat:${chatId}`).emit('messageReadUpdate', { messageId, userId });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      if (onlineUsers.has(socket.id)) {
        const userId = onlineUsers.get(socket.id);
        onlineUsers.delete(socket.id);

        // Broadcast user offline status
        chatNamespace.emit('userOffline', userId);
      }
      console.log('User disconnected from chat socket:', socket.id);
    });
  });

  // Notification namespace - imported from notificationService
  require('./notificationService').initSocketNotifications(io);

  return io;
};