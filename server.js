console.log('SERVER BOOTED');
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const mongoose = require('mongoose');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const bcrypt = require('bcrypt');
require('dotenv').config();
const rateLimit = require('express-rate-limit');
const MongoStore = require('connect-mongo').default;

const User = require('./models/User');
const Group = require('./models/Group');
const Photo = require('./models/Photo');
const SharedPhoto = require('./models/SharedPhoto');
const GroupRequest = require('./models/GroupRequest');

const app = express();
app.set('trust proxy', 1);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  });
}
app.use((req, res, next) => {
  const host = req.get('host');

  if (host.includes('sorted24-production.up.railway.app')) {  // Only triggers on Railway
    return res.redirect(301, 'https://sorted.click' + req.originalUrl);
  }

  next();  // All other platforms continue normally
});
// Face API Configuration
const FACE_API_URL = process.env.FACE_API_URL || 'https://YOUR-SPACE.hf.space';

// ============================================
// MIDDLEWARE
// ============================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// app.use(cors({
//   origin: process.env.FRONTEND_URL || 'http://localhost:3000',
//   credentials: true
// }));
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL
    : 'http://localhost:3000',
  credentials: true
}));


// app.use(session({
//   secret: process.env.SESSION_SECRET,
//   resave: false,
//   saveUninitialized: false,
//   cookie: {
//     secure: process.env.NODE_ENV === 'production', // HTTPS only in production
//     httpOnly: true, // Prevent XSS
//     maxAge: 24 * 60 * 60 * 1000, // 24 hours
//     sameSite: 'strict' // CSRF protection
//   },
//   name: 'sessionId' // Don't use default 'connect.sid'
// }));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    collectionName: 'sessions',
    ttl: 24 * 60 * 60
  }),
  cookie: {
    secure: true,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'none' // IMPORTANT: Change for cross-domain
  },
  name: 'sessionId',
  proxy: true
}));

// Serve static files
app.use(express.static('public'));
const helmet = require('helmet');
app.use(helmet());
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  message: { success: false, error: 'Too many requests, please try again later' }
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // 5 attempts per 15 minutes
  skipSuccessfulRequests: true,
  message: { success: false, error: 'Too many login attempts, please try again later' }
});
app.use('/api/', apiLimiter);
app.use('/api/login', authLimiter);
app.use('/api/signup', authLimiter);

const validator = require('validator');

// Add validation helper:
function validateSignupInput(username, phoneNumber, password) {
  const errors = [];

  // Username validation
  if (!validator.isAlphanumeric(username, 'en-US', { ignore: '_-' })) {
    errors.push('Username can only contain letters, numbers, hyphens, and underscores');
  }

  if (username.length < 3 || username.length > 20) {
    errors.push('Username must be 3-20 characters');
  }

  // Phone validation
  if (!validator.isMobilePhone(phoneNumber, 'any')) {
    errors.push('Invalid phone number');
  }

  // Password validation
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }

  if (!validator.isStrongPassword(password, {
    minLength: 8,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 0
  })) {
    errors.push('Password must contain uppercase, lowercase, and number');
  }

  return errors;
}


// ============================================
// DATABASE CONNECTION
// ============================================

// ============================================
// DATABASE CONNECTION
// ============================================

// console.log('Attempting to connect to MongoDB...');
// console.log('MONGO_URI exists:', !!process.env.MONGO_URI);
// console.log('MONGO_URI preview:', process.env.MONGO_URI ? process.env.MONGO_URI.substring(0, 20) + '...' : 'undefined');

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected successfully');
    // console.log('Database name:', mongoose.connection.db.databaseName);
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    console.error('Full error:', err);
  });

// Monitor connection events
mongoose.connection.on('connected', () => {
  console.log('🔗 Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('⚠️ Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('❌ Mongoose disconnected from MongoDB');
});

// Keep Face API warm
if (process.env.NODE_ENV === 'production') {
  setInterval(async () => {
    try {
      await fetch(`${FACE_API_URL}/health`);
      console.log('🔥 Face API keepalive ping sent');
    } catch (err) {
      console.log('⚠️ Face API keepalive failed:', err.message);
    }
  }, 5 * 60 * 1000); // Every 5 minutes
}

// const MONGO_URI = 'mongodb+srv://Gagan:gagan451@sorted.sjbfgbm.mongodb.net/photoshare?retryWrites=true&w=majority';
// console.log('🔍 Hardcoded URI check:', MONGO_URI.includes('sorted') ? '✅ Using SORTED cluster' : '❌ Using WRONG cluster');
// console.log('🔍 Connecting to:', MONGO_URI.substring(0, 50) + '...');

// mongoose.connect(MONGO_URI)

// ============================================
// AUTH MIDDLEWARE
// ============================================

const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
  next();
};

// ============================================
// HELPER FUNCTIONS
// ============================================

// Calculate image hash for duplicate detection
function calculateImageHash(buffer) {
  return crypto.createHash('md5').update(buffer).digest('hex');
}

// Call Face API
async function callFaceAPI(endpoint, method, data) {
  const response = await fetch(`${FACE_API_URL}${endpoint}`, {
    method,
    body: data,
    headers: data instanceof FormData ? {} : { 'Content-Type': 'application/json' }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Face API error: ${error}`);
  }

  return await response.json();
}

// Match face embeddings against all users
async function matchFaceToUsers(faceEmbedding, threshold = 0.35) {
  const allUsers = await User.find({}, { username: 1, faceEmbedding: 1 });

  const profileEmbeddings = {};
  allUsers.forEach(user => {
    profileEmbeddings[user.username] = user.faceEmbedding;
  });

  const matchResult = await callFaceAPI('/match-face', 'POST', JSON.stringify({
    face_embedding: faceEmbedding,
    profile_embeddings: profileEmbeddings,
    threshold
  }));

  if (matchResult.matched_profile) {
    const user = allUsers.find(u => u.username === matchResult.matched_profile);
    return {
      userId: user._id,
      username: user.username,
      confidence: matchResult.confidence
    };
  }

  return null;
}

// ============================================
// AUTH ROUTES
// ============================================

app.post('/api/signup', upload.single('profilePhoto'), async (req, res) => {
  try {
    const { username, password, phoneNumber, securityQuestion, securityAnswer } = req.body;

    // Validation
    if (!username || !password || !phoneNumber || !req.file || !securityQuestion || !securityAnswer) {
      return res.status(400).json({
        success: false,
        error: 'All fields required'
      });
    }

    // Use in signup route:
    const validationErrors = validateSignupInput(username, phoneNumber, password);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: validationErrors.join('. ')
      });
    }


    // Password validation
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters'
      });
    }

    // Check password strength
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);

    if (!hasUpperCase || !hasLowerCase || !hasNumber) {
      return res.status(400).json({
        success: false,
        error: 'Password must contain uppercase, lowercase, and number'
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({
      $or: [{ username }, { phoneNumber }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Username or phone number already exists'
      });
    }

    // Extract face embedding
    const formData = new FormData();
    formData.append('file', new Blob([req.file.buffer]), req.file.originalname);

    // const faceResult = await callFaceAPI('/extract-profile', 'POST', formData);

    // if (!faceResult.success || !faceResult.embedding) {
    //   return res.status(400).json({
    //     success: false,
    //     error: 'No face detected in profile photo'
    //   });
    // }

    const faceResult = await callFaceAPI('/extract-profile', 'POST', formData);

    if (!faceResult.success || !faceResult.embedding) {
      return res.status(400).json({
        success: false,
        error: 'No face detected in profile photo'
      });
    }

    const faceArea = faceResult.facial_area;
    const faceSize = faceArea.w * faceArea.h;
    const confidence = faceResult.confidence;

    // Check 1: Confidence (face clarity)
    if (confidence < 0.90) {
      return res.status(400).json({
        success: false,
        error: 'Face not clear enough. Please ensure good lighting and face the camera directly.'
      });
    }

    // Check 2: Face size
    if (faceSize < 8000) {
      return res.status(400).json({
        success: false,
        error: 'Face too small in photo. Please take a closer selfie.'
      });
    }

    // All validations passed, continue with signup

    // Hash password - CRITICAL SECURITY FIX
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user with hashed password
    const user = await User.create({
      username,
      password: hashedPassword,  // Store hashed, not plain text
      phoneNumber,
      profilePhoto: {
        data: req.file.buffer,
        contentType: req.file.mimetype
      },
      faceEmbedding: faceResult.embedding,
      securityQuestion,
      securityAnswer: await bcrypt.hash(securityAnswer.toLowerCase().trim(), 10)
    });

    req.session.userId = user._id;

    res.json({
      success: true,
      message: 'Signup successful',
      userId: user._id
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Find user
    const user = await User.findOne({ username });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Compare hashed password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    req.session.userId = user._id;

    res.json({
      success: true,
      message: 'Login successful',
      userId: user._id,
      username: user.username
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Add after /api/login route (around line 360):
app.post('/api/forgot-password-check', async (req, res) => {
  try {
    const { username } = req.body;
    const user = await User.findOne({ username });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      securityQuestion: user.securityQuestion
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/reset-password', async (req, res) => {
  try {
    const { username, securityAnswer, newPassword } = req.body;
    const user = await User.findOne({ username });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const isValidAnswer = await bcrypt.compare(
      securityAnswer.toLowerCase().trim(),
      user.securityAnswer
    );

    if (!isValidAnswer) {
      return res.status(401).json({
        success: false,
        error: 'Incorrect answer'
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ success: true, message: 'Password reset successful' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/track-failure', async (req, res) => {
  const { type, username, error, timestamp } = req.body;

  // Log to console (for development)
  console.error('AUTH FAILURE:', {
    type,
    username,
    error,
    timestamp
  });

  // Optional: Save to database or file
  // await FailureLog.create({ type, username, error, timestamp });

  res.json({ success: true });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/current-user', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId, {
      username: 1,
      phoneNumber: 1
    });
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add after /api/current-user route:
app.post('/api/feedback', requireAuth, async (req, res) => {
  try {
    const { mostExcitedFeature, howHeard } = req.body;
    const userId = req.session.userId;

    await User.updateOne(
      { _id: userId },
      {
        $set: {
          feedback: {
            mostExcitedFeature,
            howHeard,
            submittedAt: new Date()
          }
        }
      }
    );

    console.log(`📊 Feedback from ${userId}: Feature=${mostExcitedFeature}, Source=${howHeard}`);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// GROUP ROUTES
// ============================================
async function batchMatchFacesToUsers(faceEmbeddings, threshold = 0.35) {
  if (faceEmbeddings.length === 0) return [];

  const allUsers = await User.find({}, { username: 1, faceEmbedding: 1 });

  const profileEmbeddings = {};
  allUsers.forEach(user => {
    profileEmbeddings[user.username] = user.faceEmbedding;
  });

  const matchResults = await callFaceAPI('/batch-match', 'POST', JSON.stringify({
    face_embeddings: faceEmbeddings,
    profile_embeddings: profileEmbeddings,
    threshold
  }));

  if (!matchResults.success) return [];

  return matchResults.matches.map(match => {
    if (match.matched_profile) {
      const user = allUsers.find(u => u.username === match.matched_profile);
      return {
        userId: user._id,
        username: user.username,
        confidence: match.confidence
      };
    }
    return null;
  });
}

// NEW ROUTE: Send group requests instead of direct addition
app.post('/api/confirm-group-members', requireAuth, async (req, res) => {
  try {
    const { groupId, usernamesToAdd } = req.body;
    const userId = req.session.userId;

    // Verify group exists and user is creator
    const group = await Group.findById(groupId);
    if (!group || group.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    // Get original detected members
    const originalMembers = group.members.map(m => m.toString());

    // Find users to remove (were auto-detected but creator removed them)
    const usersToKeep = await User.find({
      username: { $in: usernamesToAdd }
    }).select('_id username');

    const userIdsToKeep = usersToKeep.map(u => u._id.toString());

    const usersToRemove = originalMembers.filter(memberId =>
      memberId !== userId.toString() && !userIdsToKeep.includes(memberId)
    );

    // Remove unwanted members
    if (usersToRemove.length > 0) {
      await Group.updateOne(
        { _id: groupId },
        { $pull: { members: { $in: usersToRemove } } }
      );

      await User.updateMany(
        { _id: { $in: usersToRemove } },
        { $pull: { groups: groupId } }
      );
    }

    // Create requests for users not already in group
    const requestsSent = [];
    for (const user of usersToKeep) {
      if (!originalMembers.includes(user._id.toString())) {
        // Check if request already exists
        const existingRequest = await GroupRequest.findOne({
          group: groupId,
          requestedUser: user._id,
          status: 'pending'
        });

        if (!existingRequest) {
          await GroupRequest.create({
            group: groupId,
            requestedUser: user._id,
            requestedBy: userId
          });
          requestsSent.push(user.username);
        }
      }
    }

    res.json({
      success: true,
      message: requestsSent.length > 0
        ? `Membership requests sent to: ${requestsSent.join(', ')}`
        : 'Group finalized',
      requestsSent: requestsSent
    });

  } catch (error) {
    console.error('Confirm group error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Send individual member request (for manual "Add Member" button)
app.post('/api/send-member-request', requireAuth, async (req, res) => {
  try {
    const { groupId, username } = req.body;
    const userId = req.session.userId;

    // Verify group exists and user is creator
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'Group not found'
      });
    }

    if (group.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Only group creator can add members'
      });
    }

    // Find user to add
    const userToAdd = await User.findOne({ username });
    if (!userToAdd) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Check if already a member
    if (group.members.includes(userToAdd._id)) {
      return res.status(400).json({
        success: false,
        error: 'User is already a member'
      });
    }

    // Check if request already exists
    const existingRequest = await GroupRequest.findOne({
      group: groupId,
      requestedUser: userToAdd._id,
      status: 'pending'
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        error: 'Request already sent to this user'
      });
    }

    // Create request
    await GroupRequest.create({
      group: groupId,
      requestedUser: userToAdd._id,
      requestedBy: userId
    });

    res.json({
      success: true,
      message: `Membership request sent to ${username}`
    });

  } catch (error) {
    console.error('Send member request error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get pending requests for current user
app.get('/api/my-group-requests', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;

    const requests = await GroupRequest.find({
      requestedUser: userId,
      status: 'pending'
    })
      .populate('group', 'groupName')
      .populate('requestedBy', 'username')
      .sort({ createdAt: -1 });

    res.json({ success: true, requests });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Accept group request
app.post('/api/accept-group-request/:requestId', requireAuth, async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.session.userId;

    const request = await GroupRequest.findOne({
      _id: requestId,
      requestedUser: userId,
      status: 'pending'
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Request not found'
      });
    }

    // Add user to group
    await Group.updateOne(
      { _id: request.group },
      { $addToSet: { members: userId } }
    );

    await User.updateOne(
      { _id: userId },
      { $addToSet: { groups: request.group } }
    );

    // Update request status
    request.status = 'accepted';
    await request.save();

    res.json({ success: true, message: 'Joined group successfully' });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reject group request
app.post('/api/reject-group-request/:requestId', requireAuth, async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.session.userId;

    const request = await GroupRequest.findOne({
      _id: requestId,
      requestedUser: userId,
      status: 'pending'
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Request not found'
      });
    }

    request.status = 'rejected';
    await request.save();

    res.json({ success: true, message: 'Request declined' });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// app.post('/api/create-group', requireAuth, upload.array('photos', 50), async (req, res) => {
//   try {
//     const { groupName, memberUsernames } = req.body;
//     const userId = req.session.userId;

//     if (!groupName || !req.files || req.files.length === 0) {
//       return res.status(400).json({
//         success: false,
//         error: 'Group name and photos required'
//       });
//     }

//     // Create group
//     const group = await Group.create({
//       groupName,
//       createdBy: userId,
//       members: [userId]
//     });

//     // Process each photo
//     const detectedUsers = new Set();
//     const processedPhotos = [];
//     const seenHashes = new Set();


//     // Detect duplicates first (sync operation)
//     const uniqueFiles = [];
//     for (const file of req.files) {
//       const imageHash = calculateImageHash(file.buffer);
//       if (!seenHashes.has(imageHash)) {
//         seenHashes.add(imageHash);
//         uniqueFiles.push({ file, imageHash });
//       }
//     }

//     // Process all photos in parallel
//     const photoPromises = uniqueFiles.map(async ({ file, imageHash }) => {
//       // Detect faces
//       const formData = new FormData();
//       formData.append('file', new Blob([file.buffer]), file.originalname);

//       const detectResult = await callFaceAPI('/detect-faces', 'POST', formData);

//       if (!detectResult.success || detectResult.total_faces === 0) return null;

//       // Batch match all faces
//       const faceEmbeddings = detectResult.faces.map(f => f.embedding);
//       const matches = await batchMatchFacesToUsers(faceEmbeddings);

//       const detectedFaces = [];
//       const photoUsers = new Set();

//       detectResult.faces.forEach((face, idx) => {
//         const match = matches[idx];
//         if (match && !photoUsers.has(match.userId.toString())) {
//           detectedFaces.push({
//             user: match.userId,
//             confidence: match.confidence,
//             facialArea: face.facial_area
//           });
//           photoUsers.add(match.userId.toString());
//         }
//       });

//       // Save photo
//       const photo = await Photo.create({
//         photoData: file.buffer,
//         contentType: file.mimetype,
//         uploadedBy: userId,
//         group: group._id,
//         detectedFaces,
//         capturedAt: new Date(),
//         imageHash
//       });

//       return { photoId: photo._id, detectedUserIds: Array.from(photoUsers) };
//     });

//     const results = await Promise.all(photoPromises);

//     // Collect all detected users and photo IDs
//     for (const result of results) {
//       if (result) {
//         processedPhotos.push(result.photoId);
//         result.detectedUserIds.forEach(uid => detectedUsers.add(uid));
//       }
//     }
//     // Update group with photos and detected members
//     const detectedUserIds = Array.from(detectedUsers);
//     await group.updateOne({
//       $addToSet: { members: { $each: detectedUserIds } },
//       $push: { photos: { $each: processedPhotos } }
//     });

//     // Update user groups
//     await User.updateMany(
//       { _id: { $in: [...detectedUserIds, userId] } },
//       { $addToSet: { groups: group._id } }
//     );

//     // Get usernames for detected users
//     const detectedUserObjects = await User.find(
//       { _id: { $in: detectedUserIds } },
//       { username: 1 }
//     );

//     res.json({
//       success: true,
//       groupId: group._id,
//       detectedUsers: detectedUserObjects.map(u => ({
//         userId: u._id,
//         username: u.username
//       })),
//       totalPhotos: processedPhotos.length
//     });

//   } catch (error) {
//     console.error('Create group error:', error);
//     res.status(500).json({
//       success: false,
//       error: error.message
//     });
//   }
// });
app.post('/api/create-group', requireAuth, upload.array('photos', 50), async (req, res) => {
  try {
    const { groupName } = req.body;
    const userId = req.session.userId;

    if (!groupName || !req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Group name and photos required'
      });
    }

    // Create group with ONLY the creator as member
    const group = await Group.create({
      groupName,
      createdBy: userId,
      members: [userId]  // ✅ ONLY creator initially
    });

    // Process photos (same as before)
    const detectedUsers = new Set();
    const processedPhotos = [];
    const seenHashes = new Set();

    const uniqueFiles = [];
    for (const file of req.files) {
      const imageHash = calculateImageHash(file.buffer);
      if (!seenHashes.has(imageHash)) {
        seenHashes.add(imageHash);
        uniqueFiles.push({ file, imageHash });
      }
    }

    const photoPromises = uniqueFiles.map(async ({ file, imageHash }) => {
      const formData = new FormData();
      formData.append('file', new Blob([file.buffer]), file.originalname);

      const detectResult = await callFaceAPI('/detect-faces', 'POST', formData);

      if (!detectResult.success || detectResult.total_faces === 0) return null;

      const faceEmbeddings = detectResult.faces.map(f => f.embedding);
      const matches = await batchMatchFacesToUsers(faceEmbeddings);

      const detectedFaces = [];
      const photoUsers = new Set();

      detectResult.faces.forEach((face, idx) => {
        const match = matches[idx];
        if (match && !photoUsers.has(match.userId.toString())) {
          detectedFaces.push({
            user: match.userId,
            confidence: match.confidence,
            facialArea: face.facial_area
          });
          photoUsers.add(match.userId.toString());
        }
      });

      const photo = await Photo.create({
        photoData: file.buffer,
        contentType: file.mimetype,
        uploadedBy: userId,
        group: group._id,
        detectedFaces,
        capturedAt: new Date(),
        imageHash
      });

      return { photoId: photo._id, detectedUserIds: Array.from(photoUsers) };
    });

    const results = await Promise.all(photoPromises);

    for (const result of results) {
      if (result) {
        processedPhotos.push(result.photoId);
        result.detectedUserIds.forEach(uid => detectedUsers.add(uid));
      }
    }

    // ✅ UPDATE: Only add photos to group, NOT members
    await group.updateOne({
      $push: { photos: { $each: processedPhotos } }
    });

    // ✅ UPDATE: Add creator to their own groups
    await User.updateOne(
      { _id: userId },
      { $addToSet: { groups: group._id } }
    );

    // Get usernames for detected users (excluding creator)
    const detectedUserIds = Array.from(detectedUsers).filter(
      uid => uid !== userId.toString()
    );

    const detectedUserObjects = await User.find(
      { _id: { $in: detectedUserIds } },
      { username: 1 }
    );

    res.json({
      success: true,
      groupId: group._id,
      detectedUsers: detectedUserObjects.map(u => ({
        userId: u._id,
        username: u.username
      })),
      totalPhotos: processedPhotos.length
    });

  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/remove-member-from-group', requireAuth, async (req, res) => {
  try {
    console.log("entered /api/remove-member-from-group")
    const { groupId, username } = req.body;
    const userId = req.session.userId;

    // Get group and check if requester is creator
    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'Group not found'
      });
    }

    if (group.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Only group creator can remove members'
      });
    }

    // Find user to remove
    const userToRemove = await User.findOne({ username });
    if (!userToRemove) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Don't allow removing the creator
    if (userToRemove._id.toString() === userId.toString()) {
      return res.status(400).json({
        success: false,
        error: 'Cannot remove group creator'
      });
    }

    // Remove from group
    await Group.updateOne(
      { _id: groupId },
      { $pull: { members: userToRemove._id } }
    );

    // Remove group from user's groups
    await User.updateOne(
      { _id: userToRemove._id },
      { $pull: { groups: groupId } }
    );

    res.json({
      success: true,
      message: 'Member removed successfully'
    });

  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/add-member-to-group', requireAuth, async (req, res) => {
  try {
    const { groupId, username } = req.body;

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    await Group.updateOne(
      { _id: groupId },
      { $addToSet: { members: user._id } }
    );

    await User.updateOne(
      { _id: user._id },
      { $addToSet: { groups: groupId } }
    );

    res.json({ success: true, message: 'Member added' });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/my-groups', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;

    const groups = await Group.find({
      members: userId
    }).populate('createdBy', 'username')
      .select('groupName createdBy createdAt');

    res.json({ success: true, groups });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/group/:groupId', requireAuth, async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.session.userId;

    const group = await Group.findOne({
      _id: groupId,
      members: userId
    }).populate('members', 'username')
      .populate('createdBy', 'username');

    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'Group not found'
      });
    }

    // Get all photos sorted by date
    const allPhotos = await Photo.find({
      group: groupId
    }).sort({ capturedAt: -1 })
      .populate('uploadedBy', 'username')
      .populate('detectedFaces.user', 'username');

    // Get user's personal photos
    const userPhotos = allPhotos.filter(photo =>
      photo.detectedFaces.some(face =>
        face.user._id.toString() === userId.toString()
      )
    );

    // Convert photos to base64
    const photosWithData = allPhotos.map(photo => ({
      _id: photo._id,
      photoData: photo.photoData.toString('base64'),
      contentType: photo.contentType,
      uploadedBy: photo.uploadedBy.username,
      detectedFaces: photo.detectedFaces.map(f => ({
        username: f.user.username,
        confidence: f.confidence
      })),
      capturedAt: photo.capturedAt
    }));

    const userPhotosWithData = userPhotos.map(photo => ({
      _id: photo._id,
      photoData: photo.photoData.toString('base64'),
      contentType: photo.contentType,
      capturedAt: photo.capturedAt
    }));

    res.json({
      success: true,
      group: {
        groupName: group.groupName,
        members: group.members,
        createdBy: group.createdBy
      },
      allPhotos: photosWithData,
      userPhotos: userPhotosWithData
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/photo/:photoId', requireAuth, async (req, res) => {
  try {
    const { photoId } = req.params;
    const userId = req.session.userId;

    // Get photo
    const photo = await Photo.findById(photoId).populate('group');

    if (!photo) {
      return res.status(404).json({
        success: false,
        error: 'Photo not found'
      });
    }

    // Check authorization: user must be member of the group
    const group = await Group.findOne({
      _id: photo.group._id,
      members: userId
    });

    if (!group) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: You are not a member of this group'
      });
    }

    // Serve photo
    res.set('Content-Type', photo.contentType);
    res.send(photo.photoData);

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});


// ============================================
// INSTANT SHARE
// ============================================

// app.post('/api/instant-share', requireAuth, upload.single('photo'), async (req, res) => {
//   try {
//     const userId = req.session.userId;

//     if (!req.file) {
//       return res.status(400).json({ 
//         success: false, 
//         error: 'Photo required' 
//       });
//     }

//     // Detect faces
//     const formData = new FormData();
//     formData.append('file', new Blob([req.file.buffer]), req.file.originalname);

//     const detectResult = await callFaceAPI('/detect-faces', 'POST', formData);

//     if (!detectResult.success || detectResult.total_faces === 0) {
//       return res.json({ 
//         success: true, 
//         message: 'No faces detected',
//         sentTo: []
//       });
//     }

//     // Match faces and send to respective groups
//     const sentToUsers = new Set();

//     for (const face of detectResult.faces) {
//       const match = await matchFaceToUsers(face.embedding);
//       if (match) {
//         sentToUsers.add(match.userId.toString());
//       }
//     }

//     // TODO: Create notifications or add to user's inbox
//     // For now, just return who it would be sent to

//     const users = await User.find({ 
//       _id: { $in: Array.from(sentToUsers) } 
//     }, { username: 1 });

//     res.json({ 
//       success: true, 
//       message: 'Photo shared',
//       sentTo: users.map(u => u.username)
//     });

//   } catch (error) {
//     res.status(500).json({ success: false, error: error.message });
//   }
// });
// ============================================
// INSTANT SHARE
// ============================================

app.post('/api/instant-share', requireAuth, upload.single('photo'), async (req, res) => {
  try {
    const userId = req.session.userId;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Photo required'
      });
    }

    // Detect faces
    const formData = new FormData();
    formData.append('file', new Blob([req.file.buffer]), req.file.originalname);

    const detectResult = await callFaceAPI('/detect-faces', 'POST', formData);

    if (!detectResult.success || detectResult.total_faces === 0) {
      return res.json({
        success: true,
        message: 'No faces detected',
        sentTo: []
      });
    }

    // Match faces to users
    // Batch match faces (FASTER)
    const detectedUsers = new Set();
    const detectedFaces = [];

    const faceEmbeddings = detectResult.faces.map(f => f.embedding);
    const matches = await batchMatchFacesToUsers(faceEmbeddings);

    detectResult.faces.forEach((face, idx) => {
      const match = matches[idx];
      if (match) {
        detectedUsers.add(match.userId.toString());
        detectedFaces.push({
          user: match.userId,
          confidence: match.confidence,
          facialArea: face.facial_area
        });
      }
    });
    if (detectedUsers.size === 0) {
      return res.json({
        success: true,
        message: 'No known faces detected',
        sentTo: []
      });
    }

    // Save shared photo
    const sharedPhoto = await SharedPhoto.create({
      photoData: req.file.buffer,
      contentType: req.file.mimetype,
      sharedBy: userId,
      sharedWith: Array.from(detectedUsers),
      detectedFaces
    });

    // Get usernames of recipients
    const recipients = await User.find({
      _id: { $in: Array.from(detectedUsers) }
    }, { username: 1 });

    res.json({
      success: true,
      message: 'Photo shared successfully',
      photoId: sharedPhoto._id,
      sentTo: recipients.map(u => u.username)
    });

  } catch (error) {
    console.error('Instant share error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get photos shared WITH current user
app.get('/api/shared-with-me', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;

    const sharedPhotos = await SharedPhoto.find({
      sharedWith: userId
    })
      .sort({ sharedAt: -1 })
      .populate('sharedBy', 'username')
      .populate('detectedFaces.user', 'username');

    const photosWithData = sharedPhotos.map(photo => ({
      _id: photo._id,
      photoData: photo.photoData.toString('base64'),
      contentType: photo.contentType,
      sharedBy: photo.sharedBy.username,
      sharedAt: photo.sharedAt,
      detectedFaces: photo.detectedFaces.map(f => ({
        username: f.user.username,
        confidence: f.confidence
      })),
      viewed: photo.viewed.some(v => v.user.toString() === userId.toString())
    }));

    res.json({
      success: true,
      photos: photosWithData,
      totalUnviewed: photosWithData.filter(p => !p.viewed).length
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get photos shared BY current user
app.get('/api/shared-by-me', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;

    const sharedPhotos = await SharedPhoto.find({
      sharedBy: userId
    })
      .sort({ sharedAt: -1 })
      .populate('sharedWith', 'username')
      .populate('detectedFaces.user', 'username');

    const photosWithData = sharedPhotos.map(photo => ({
      _id: photo._id,
      photoData: photo.photoData.toString('base64'),
      contentType: photo.contentType,
      sharedWith: photo.sharedWith.map(u => u.username),
      sharedAt: photo.sharedAt,
      detectedFaces: photo.detectedFaces.map(f => ({
        username: f.user.username,
        confidence: f.confidence
      })),
      viewCount: photo.viewed.length
    }));

    res.json({
      success: true,
      photos: photosWithData
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Mark photo as viewed
app.post('/api/mark-viewed/:photoId', requireAuth, async (req, res) => {
  try {
    const { photoId } = req.params;
    const userId = req.session.userId;

    await SharedPhoto.updateOne(
      {
        _id: photoId,
        sharedWith: userId,
        'viewed.user': { $ne: userId }
      },
      {
        $push: {
          viewed: {
            user: userId,
            viewedAt: new Date()
          }
        }
      }
    );

    res.json({ success: true });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
