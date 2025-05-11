// Advanced filter, sorting, pagination, and field limiting

/**
 * Build filter object for Mongoose queries
 * @param {Object} reqQuery - Express req.query
 */
const buildFilterObject = (reqQuery) => {
  // Copy request query
  const queryObj = { ...reqQuery };

  // Fields to exclude from filtering
  const excludedFields = ['select', 'sort', 'page', 'limit', 'populate'];
  excludedFields.forEach(field => delete queryObj[field]);

  // Advanced filtering for lt, lte, gt, gte, in
  let queryStr = JSON.stringify(queryObj);
  queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);

  return JSON.parse(queryStr);
};

/**
 * Create an advanced filtered query with sorting, limiting, and pagination
 * @param {Object} model - Mongoose model to query
 * @param {Object} reqQuery - Express req.query
 * @param {Array} populateFields - Array of fields to populate
 */
const advancedFilter = (model, reqQuery, populateFields = []) => {
  // Build filter object
  const filterObj = buildFilterObject(reqQuery);

  // Create base query
  let query = model.find(filterObj);

  // Select specific fields
  if (reqQuery.select) {
    const fields = reqQuery.select.split(',').join(' ');
    query = query.select(fields);
  }

  // Sort
  if (reqQuery.sort) {
    const sortBy = reqQuery.sort.split(',').join(' ');
    query = query.sort(sortBy);
  } else {
    // Default sorting by createdAt descending
    query = query.sort('-createdAt');
  }

  // Pagination
  const page = parseInt(reqQuery.page, 10) || 1;
  const limit = parseInt(reqQuery.limit, 10) || 25;
  const skip = (page - 1) * limit;

  query = query.skip(skip).limit(limit);

  // Populate related fields
  if (populateFields.length > 0) {
    populateFields.forEach((field) => {
      query = query.populate(field);
    });
  } else if (reqQuery.populate) {
    const fieldsToPopulate = reqQuery.populate.split(',');
    fieldsToPopulate.forEach((field) => {
      query = query.populate(field);
    });
  }

  return {
    query,
    pagination: {
      page,
      limit,
      skip
    }
  };
};

/**
 * Filter resources by branch, year, semester, subject
 * @param {Object} query - Express req.query
 * @param {String} userRole - User role
 * @param {Object} userData - User data containing branch, year, semester
 */
const filterEducationalResources = (query, userRole, userData) => {
  const filter = {};

  // Add branch filter
  if (query.branch) {
    filter.branch = query.branch;
  } else if (userRole === 'student' && userData.branch) {
    filter.branch = userData.branch;
  }

  // Add year filter
  if (query.year) {
    filter.year = parseInt(query.year);
  } else if (userRole === 'student' && userData.year) {
    filter.year = userData.year;
  }

  // Add semester filter
  if (query.semester) {
    filter.semester = parseInt(query.semester);
  } else if (userRole === 'student' && userData.semester) {
    filter.semester = userData.semester;
  }

  // Add subject filter
  if (query.subject) {
    filter.subject = query.subject;
  }

  return filter;
};

module.exports = {
  advancedFilter,
  filterEducationalResources
};