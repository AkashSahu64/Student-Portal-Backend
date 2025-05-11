const { admin, sendNotification, sendMultipleNotifications } = require('../config/firebase');
const User = require('../models/User');

/**
 * Send notification to specified users or a target audience
 * @param {Object} notification - Notification details
 * @param {String} notification.title - Notification title
 * @param {String} notification.body - Notification body
 * @param {Object} notification.data - Additional data
 * @param {Array} notification.targetUsers - Array of user IDs to send to (optional)
 * @param {Object} notification.targetAudience - Target audience filters (optional)
 * @returns {Promise<Object>} Notification result
 */
exports.notifyUsers = async ({ title, body, data = {}, targetUsers, targetAudience }) => {
  try {
    let tokens = [];

    // If specific users are targeted
    if (targetUsers && targetUsers.length > 0) {
      const users = await User.find({
        _id: { $in: targetUsers },
        fcmToken: { $ne: null }
      }).select('fcmToken');

      tokens = users.map(user => user.fcmToken).filter(Boolean);
    }
    // If targeting by audience
    else if (targetAudience) {
      const filter = {};

      // Branch filter
      if (targetAudience.branch && targetAudience.branch !== 'All') {
        filter.branch = targetAudience.branch;
      }

      // Year filter
      if (targetAudience.year && targetAudience.year !== 'All') {
        filter.year = parseInt(targetAudience.year);
      }

      // Semester filter
      if (targetAudience.semester && targetAudience.semester !== 'All') {
        filter.semester = parseInt(targetAudience.semester);
      }

      // Role filter
      if (targetAudience.role && targetAudience.role !== 'All') {
        filter.role = targetAudience.role;
      }

      // Only get users with FCM tokens
      filter.fcmToken = { $ne: null };

      const users = await User.find(filter).select('fcmToken');
      tokens = users.map(user => user.fcmToken).filter(Boolean);
    }

    // Send notifications if there are tokens
    if (tokens.length === 0) {
      return { success: true, message: 'No valid notification tokens found', count: 0 };
    }

    let result;
    if (tokens.length === 1) {
      // Send to single device
      result = await sendNotification(tokens[0], title, body, data);
    } else {
      // Send to multiple devices
      result = await sendMultipleNotifications(tokens, title, body, data);
    }

    return {
      success: result.success,
      tokensCount: tokens.length,
      sentCount: result.successCount || 1,
      failedCount: result.failureCount || 0,
    };
  } catch (error) {
    console.error('Notification service error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Track notification view/open
 * @param {String} userId - User ID
 * @param {String} notificationId - Notification ID
 * @returns {Promise<Boolean>} Success status
 */
exports.trackNotificationView = async (userId, notificationId) => {
  try {
    // In a real implementation, you'd track this in a notifications collection
    // For this example, we'll just return success
    return true;
  } catch (error) {
    console.error('Notification tracking error:', error);
    return false;
  }
};

/**
 * Get recent notifications for a user
 * @param {String} userId - User ID
 * @param {Number} limit - Maximum number of notifications to return
 * @returns {Promise<Array>} Recent notifications
 */
exports.getUserNotifications = async (userId, limit = 10) => {
  try {
    // In a real implementation, you'd fetch from a notifications collection
    // For this example, we'll return mock data
    return Array(limit).fill(0).map((_, i) => ({
      id: `notification${i}`,
      title: `Notification ${i + 1}`,
      body: `This is notification ${i + 1} for user ${userId}`,
      createdAt: new Date(Date.now() - i * 3600000).toISOString(),
      read: i > 2, // First 3 are unread
    }));
  } catch (error) {
    console.error('Get user notifications error:', error);
    return [];
  }
};

/**
 * Initialize Socket.io for real-time notifications
 * @param {Object} io - Socket.io instance
 */
exports.initSocketNotifications = (io) => {
  const notificationsNamespace = io.of('/notifications');

  notificationsNamespace.on('connection', (socket) => {
    // Authenticate user and join their private room
    socket.on('authenticate', async (token) => {
      try {
        // Verify token and get user ID
        // This is a placeholder - in a real app, use your token verification logic
        const userId = 'user123'; // This would come from token verification

        // Join user's private room
        socket.join(`user:${userId}`);
        socket.emit('authenticated', { success: true });
      } catch (error) {
        socket.emit('authenticated', { success: false, error: error.message });
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      // Clean up if needed
    });
  });

  return notificationsNamespace;
};