const mongoose = require('mongoose');

const AnnouncementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please add a title'],
      trim: true,
      maxlength: [100, 'Title cannot be more than 100 characters'],
    },
    content: {
      type: String,
      required: [true, 'Please add content'],
      maxlength: [2000, 'Content cannot be more than 2000 characters'],
    },
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    attachments: [
      {
        fileUrl: {
          type: String,
        },
        filePath: {
          type: String,
        },
        fileType: {
          type: String,
        },
        fileName: {
          type: String,
        },
        fileSize: {
          type: Number,
        },
      },
    ],
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Urgent'],
      default: 'Medium',
    },
    targetAudience: {
      branch: {
        type: String,
        enum: ['All', 'CSE', 'ECE', 'ME', 'CE', 'EE', 'CHE', 'BT', 'Other'],
        default: 'All',
      },
      year: {
        type: String,
        enum: ['All', '1', '2', '3', '4'],
        default: 'All',
      },
      semester: {
        type: String,
        enum: ['All', '1', '2', '3', '4', '5', '6', '7', '8'],
        default: 'All',
      },
      role: {
        type: String,
        enum: ['All', 'student', 'teacher', 'admin'],
        default: 'All',
      },
    },
    expiresAt: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    views: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        viewedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Set announcement as inactive if expired
AnnouncementSchema.pre('find', function() {
  this.where({
    $or: [
      { expiresAt: { $gt: new Date() } },
      { expiresAt: null },
    ],
    isActive: true,
  });
});

module.exports = mongoose.model('Announcement', AnnouncementSchema);