const mongoose = require('mongoose');

const PYQSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please add a title'],
      trim: true,
      maxlength: [100, 'Title cannot be more than 100 characters'],
    },
    description: {
      type: String,
      required: [true, 'Please add a description'],
      maxlength: [500, 'Description cannot be more than 500 characters'],
    },
    fileUrl: {
      type: String,
      required: [true, 'Please upload a file'],
    },
    filePath: {
      type: String,
      required: [true, 'File path is required'],
    },
    fileType: {
      type: String,
      enum: ['pdf', 'doc', 'docx'],
      required: [true, 'Please specify file type'],
    },
    fileSize: {
      type: Number,
      required: [true, 'File size is required'],
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: [true, 'Please add a subject'],
    },
    branch: {
      type: String,
      enum: ['CSE', 'ECE', 'ME', 'CE', 'EE', 'CHE', 'BT', 'Other'],
      required: [true, 'Please add a branch'],
    },
    year: {
      type: Number,
      enum: [1, 2, 3, 4],
      required: [true, 'Please add a year'],
    },
    semester: {
      type: Number,
      enum: [1, 2, 3, 4, 5, 6, 7, 8],
      required: [true, 'Please add a semester'],
    },
    examType: {
      type: String,
      enum: ['Mid-Term', 'End-Term', 'Quiz', 'Assignment'],
      required: [true, 'Please specify exam type'],
    },
    examYear: {
      type: Number,
      required: [true, 'Please specify exam year'],
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isVerified: {
      type: Boolean,
      default: function() {
        // Auto-verify if uploaded by teacher or admin
        return this.uploadedBy.role === 'teacher' || this.uploadedBy.role === 'admin';
      }
    },
    hasSolution: {
      type: Boolean,
      default: false,
    },
    solutionFileUrl: {
      type: String,
    },
    solutionFilePath: {
      type: String,
    },
    difficulty: {
      type: String,
      enum: ['Easy', 'Medium', 'Hard'],
      default: 'Medium',
    },
    totalMarks: {
      type: Number,
    },
    duration: {
      type: Number, // in minutes
    },
    views: {
      type: Number,
      default: 0,
    },
    downloads: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('PYQ', PYQSchema);