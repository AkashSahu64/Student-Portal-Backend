const mongoose = require('mongoose');

const SyllabusSchema = new mongoose.Schema(
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
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: [true, 'Please add a subject'],
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    totalMarks: {
      type: Number,
      required: [true, 'Please add total marks'],
    },
    passingMarks: {
      type: Number,
      required: [true, 'Please add passing marks'],
    },
    units: [
      {
        title: {
          type: String,
          required: [true, 'Please add a unit title'],
        },
        description: {
          type: String,
          required: [true, 'Please add a unit description'],
        },
        topics: [
          {
            title: {
              type: String,
              required: [true, 'Please add a topic title'],
            },
            description: {
              type: String,
            },
          },
        ],
      },
    ],
    examPattern: {
      type: String,
      required: [true, 'Please add exam pattern'],
    },
    referenceBooks: [
      {
        title: {
          type: String,
          required: [true, 'Please add a book title'],
        },
        author: {
          type: String,
          required: [true, 'Please add author name'],
        },
        link: {
          type: String,
        },
      },
    ],
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

module.exports = mongoose.model('Syllabus', SyllabusSchema);