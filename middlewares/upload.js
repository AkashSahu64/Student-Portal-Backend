const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { ErrorResponse } = require('./errorHandler');

// Create upload directory if it doesn't exist
const createUploadDirectory = (directory) => {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
};

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Determine the upload directory based on file type
    let uploadDir = 'uploads/';
    
    if (req.originalUrl.includes('/notes')) {
      uploadDir += 'notes/';
    } else if (req.originalUrl.includes('/syllabus')) {
      uploadDir += 'syllabus/';
    } else if (req.originalUrl.includes('/videos')) {
      uploadDir += 'videos/';
    } else if (req.originalUrl.includes('/pyq')) {
      uploadDir += 'pyqs/';
    } else {
      uploadDir += 'misc/';
    }

    // Create directory if it doesn't exist
    createUploadDirectory(uploadDir);
    
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Create unique file name: uuid + original extension
    const uniqueFilename = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueFilename);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  // Define allowed file types based on route
  let allowedTypes = [];
  
  if (req.originalUrl.includes('/notes')) {
    allowedTypes = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.txt'];
  } else if (req.originalUrl.includes('/syllabus')) {
    allowedTypes = ['.pdf', '.doc', '.docx'];
  } else if (req.originalUrl.includes('/videos')) {
    allowedTypes = ['.mp4', '.mov', '.avi', '.wmv'];
  } else if (req.originalUrl.includes('/pyq')) {
    allowedTypes = ['.pdf', '.doc', '.docx'];
  } else {
    allowedTypes = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.gif'];
  }
  
  // Check if file extension is allowed
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedTypes.includes(ext)) {
    return cb(null, true);
  }
  
  // Reject file if extension is not allowed
  cb(new ErrorResponse(`File type ${ext} is not supported. Allowed types: ${allowedTypes.join(', ')}`, 400), false);
};

// Size limits based on file type
const getSizeLimit = (req) => {
  if (req.originalUrl.includes('/videos')) {
    return 200 * 1024 * 1024; // 200MB
  } else if (req.originalUrl.includes('/notes') || req.originalUrl.includes('/syllabus') || req.originalUrl.includes('/pyq')) {
    return 20 * 1024 * 1024; // 20MB
  } else {
    return 5 * 1024 * 1024; // 5MB
  }
};

// Initialize upload middleware
const initUpload = (req, res, next) => {
  const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
      fileSize: getSizeLimit(req)
    }
  });
  
  return upload;
};

// Single file upload middleware
exports.uploadSingle = (fieldName) => {
  return (req, res, next) => {
    const upload = initUpload(req).single(fieldName);
    
    upload(req, res, function (err) {
      if (err instanceof multer.MulterError) {
        // Multer error (e.g., file size exceeded)
        return next(new ErrorResponse(`Upload error: ${err.message}`, 400));
      } else if (err) {
        // Other error
        return next(err);
      }
      
      // File uploaded successfully
      if (req.file) {
        // Add file information to request
        req.fileInfo = {
          filename: req.file.filename,
          originalname: req.file.originalname,
          path: req.file.path,
          size: req.file.size,
          mimetype: req.file.mimetype,
          url: `${req.protocol}://${req.get('host')}/${req.file.path.replace(/\\/g, '/')}`
        };
      }
      
      next();
    });
  };
};

// Multiple files upload middleware
exports.uploadMultiple = (fieldName, maxCount) => {
  return (req, res, next) => {
    const upload = initUpload(req).array(fieldName, maxCount || 5);
    
    upload(req, res, function (err) {
      if (err instanceof multer.MulterError) {
        // Multer error
        return next(new ErrorResponse(`Upload error: ${err.message}`, 400));
      } else if (err) {
        // Other error
        return next(err);
      }
      
      // Files uploaded successfully
      if (req.files && req.files.length > 0) {
        // Add files information to request
        req.filesInfo = req.files.map(file => ({
          filename: file.filename,
          originalname: file.originalname,
          path: file.path,
          size: file.size,
          mimetype: file.mimetype,
          url: `${req.protocol}://${req.get('host')}/${file.path.replace(/\\/g, '/')}`
        }));
      }
      
      next();
    });
  };
};

// Delete file
exports.deleteFile = (filePath) => {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
};