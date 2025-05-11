const mongoose = require('mongoose');

const SubjectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a subject name'],
      trim: true,
      maxlength: [50, 'Name cannot be more than 50 characters'],
    },
    code: {
      type: String,
      required: [true, 'Please add a subject code'],
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Please add a description'],
      maxlength: [500, 'Description cannot be more than 500 characters'],
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
    credits: {
      type: Number,
      required: [true, 'Please add credits'],
      min: [1, 'Credits must be at least 1'],
      max: [10, 'Credits cannot be more than 10'],
    },
    teachers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    syllabus: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Syllabus',
    },
    isElective: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual populate for notes
SubjectSchema.virtual('notes', {
  ref: 'Note',
  localField: '_id',
  foreignField: 'subject',
  justOne: false,
});

// Virtual populate for videos
SubjectSchema.virtual('videos', {
  ref: 'Video',
  localField: '_id',
  foreignField: 'subject',
  justOne: false,
});

// Virtual populate for PYQs
SubjectSchema.virtual('pyqs', {
  ref: 'PYQ',
  localField: '_id',
  foreignField: 'subject',
  justOne: false,
});

module.exports = mongoose.model('Subject', SubjectSchema);