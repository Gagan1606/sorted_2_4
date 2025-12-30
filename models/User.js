const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3
  },
  password: {
    type: String,
    required: true,
    minlength: 8
  },
  phoneNumber: {
    type: String,
    required: true,
    unique: true
  },
  profilePhoto: {
    data: Buffer,
    contentType: String
  },
  faceEmbedding: {
    type: [Number],  // Array of floats from face recognition
    required: true
  },
  groups: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  // Add to User schema in models/User.js:
securityQuestion: {
    type: String,
    required: true
  },
  securityAnswer: {
    type: String,
    required: true
  },
  feedback: {
    mostExcitedFeature: String,
    howHeard: String,
    submittedAt: Date
}
});


// Index for faster face matching queries
userSchema.index({ username: 1 }, { unique: true });
userSchema.index({ phoneNumber: 1 }, { unique: true });


module.exports = mongoose.model('User', userSchema);
