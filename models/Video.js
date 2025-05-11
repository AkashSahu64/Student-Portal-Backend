const mongoose = require('mongoose');

const VideoSchema = new mongoose.Schema(
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
      maxlength: [1000, 'Description cannot be more than 1000 characters'],
    },
    videoUrl: {
      type: String,
      required: [true, 'Please provide a video URL'],
    },
    thumbnailUrl: {
      type: String,
      default: 'default-thumbnail.jpg',
    },
    isYoutubeVideo: {
      type: Boolean,
      default: false,
    },
    youtubeId: {
      type: String,
    },
    duration: {
      type: Number, // in seconds
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
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
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
    views: {
      type: Number,
      default: 0,
    },
    likes: {
      type: Number,
      default: 0,
    },
    usersLiked: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    comments: [
      {
        text: {
          type: String,
          required: [true, 'Please add a comment'],
          maxlength: [500, 'Comment cannot be more than 500 characters'],
        },
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Auto-populate youtube ID if it's a YouTube video
VideoSchema.pre('save', function(next) {
  if (this.isYoutubeVideo && this.videoUrl) {
    // Extract YouTube video ID from URL
    const youtubeRegex = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = this.videoUrl.match(youtubeRegex);
    
    if (match && match[1]) {
      this.youtubeId = match[1];
    }
  }
  next();
});

module.exports = mongoose.model('Video', VideoSchema);