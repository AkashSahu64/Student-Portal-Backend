const moment = require('moment');

/**
 * Format date with moment
 * @param {Date} date - Date to format
 * @param {String} format - Format string
 */
const formatDate = (date, format = 'YYYY-MM-DD HH:mm:ss') => {
  return moment(date).format(format);
};

/**
 * Format file size in human-readable format
 * @param {Number} bytes - File size in bytes
 */
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Format response data for API
 * @param {Object|Array} data - Data to format
 * @param {Boolean} success - Success status
 * @param {String} message - Response message
 */
const formatResponse = (data, success = true, message = '') => {
  return {
    success,
    message: message || (success ? 'Request successful' : 'Request failed'),
    data
  };
};

/**
 * Clean user object for response
 * @param {Object} user - User object
 */
const cleanUserData = (user) => {
  if (!user) return null;
  
  // Convert to plain object if it's a mongoose document
  const userData = user.toObject ? user.toObject() : { ...user };
  
  // Remove sensitive fields
  delete userData.password;
  delete userData.resetPasswordToken;
  delete userData.resetPasswordExpire;
  delete userData.otp;
  delete userData.otpExpiry;
  
  // Format dates
  if (userData.createdAt) {
    userData.createdAt = formatDate(userData.createdAt);
  }
  if (userData.updatedAt) {
    userData.updatedAt = formatDate(userData.updatedAt);
  }
  if (userData.lastActive) {
    userData.lastActive = formatDate(userData.lastActive);
  }
  
  return userData;
};

/**
 * Format pagination metadata
 * @param {Number} total - Total count of items
 * @param {Number} page - Current page number
 * @param {Number} limit - Items per page
 * @param {String} baseUrl - Base URL for next/prev links
 * @param {Object} query - Query parameters
 */
const formatPagination = (total, page, limit, baseUrl, query = {}) => {
  const totalPages = Math.ceil(total / limit);
  
  // Create query string for links
  const queryString = Object.entries(query)
    .filter(([key]) => !['page', 'limit'].includes(key))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  
  // Build URL for links
  const buildUrl = (pageNum) => {
    let url = `${baseUrl}?page=${pageNum}&limit=${limit}`;
    if (queryString) {
      url += `&${queryString}`;
    }
    return url;
  };
  
  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
    nextPage: page < totalPages ? buildUrl(page + 1) : null,
    prevPage: page > 1 ? buildUrl(page - 1) : null,
  };
};

module.exports = {
  formatDate,
  formatFileSize,
  formatResponse,
  cleanUserData,
  formatPagination
};