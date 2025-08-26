const express = require('express');
const { ObjectId } = require('mongodb');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { body, param, validationResult } = require('express-validator');

const router = express.Router();

let usersCollection;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Images only (jpg, png, gif)'));
    }
  },
});

// Set collection from index.js
const setCollection = (database) => {
  usersCollection = database.collection('users');
};

// Validation middleware for POST
const userValidationRulesPost = [
  body('firebaseUID')
    .trim()
    .notEmpty()
    .withMessage('Firebase UID is required')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Invalid Firebase UID format'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Invalid email format'),
  body('fullName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Full name must not exceed 100 characters'),
  body('role')
    .optional()
    .isIn(['user', 'admin'])
    .withMessage('Role must be either "user" or "admin"'),
];

// Validation middleware for ID (MongoDB _id or firebaseUID)
const validateId = [
  param('id')
    .custom((value) => ObjectId.isValid(value) || /^[a-zA-Z0-9_-]+$/.test(value))
    .withMessage('Invalid ID format (must be MongoDB ObjectId or valid Firebase UID)'),
];

// Error handling middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array().map(err => ({ field: err.param, message: err.msg })) });
  }
  next();
};

// Helper function to calculate user storage
const calculateUserStorage = async (firebaseUID) => {
  try {
    let totalBytes = 0;
    const userProfile = await usersCollection.findOne({ firebaseUID });
    if (userProfile) {
      totalBytes += JSON.stringify(userProfile).length;
      if (userProfile.photoURL) {
        try {
          const filePath = path.join(__dirname, '..', userProfile.photoURL);
          const stats = await fs.stat(filePath);
          totalBytes += stats.size;
        } catch (fileError) {
          console.error(`Error reading profile image size for ${firebaseUID}: ${fileError.message}`);
        }
      }
    }
    return totalBytes;
  } catch (error) {
    console.error(`Storage calculation error for ${firebaseUID}:`, error);
    return 0;
  }
};

// Helper function to format bytes
const formatBytes = (bytes) => {
  if (bytes === 0) return '0 MB';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// GET all users
router.get('/', async (req, res) => {
  try {
    const users = await usersCollection.find().toArray();
    res.status(200).json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET single user by Firebase UID or MongoDB _id
router.get('/:id', validateId, handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;
    let user;

    if (ObjectId.isValid(id) && id.length === 24) {
      user = await usersCollection.findOne({ _id: new ObjectId(id) });
    } else {
      user = await usersCollection.findOne({ firebaseUID: id });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Calculate current storage
    let storageBytes = user.storageUsed || 0;
    storageBytes = await calculateUserStorage(user.firebaseUID);

    // Update storage in database
    await usersCollection.updateOne(
      { firebaseUID: user.firebaseUID },
      { $set: { storageUsed: storageBytes, lastStorageUpdate: new Date() } }
    );

    // Include role and storage in response
    const userWithStorage = {
      ...user,
      role: user.role || 'user',
      storageUsed: formatBytes(storageBytes),
      storageBytes,
    };

    res.status(200).json(userWithStorage);
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET user storage info separately
router.get('/:uid/storage', async (req, res) => {
  try {
    const { uid } = req.params;

    const storageBytes = await calculateUserStorage(uid);

    // Update storage in user document
    await usersCollection.updateOne(
      { firebaseUID: uid },
      { $set: { storageUsed: storageBytes, lastStorageUpdate: new Date() } }
    );

    // Storage limit check
    const user = await usersCollection.findOne({ firebaseUID: uid });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const isPremium = user.premium || false;
    const storageLimit = isPremium ? 50 * 1024 * 1024 * 1024 : 5 * 1024 * 1024 * 1024;
    const storagePercentage = ((storageBytes / storageLimit) * 100).toFixed(1);

    res.status(200).json({
      storageUsed: formatBytes(storageBytes),
      storageBytes,
      storageLimit: formatBytes(storageLimit),
      storagePercentage,
      isPremium,
    });
  } catch (err) {
    console.error('Error fetching storage:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST create user
router.post('/', userValidationRulesPost, handleValidationErrors, async (req, res) => {
  try {
    const { firebaseUID, fullName, email, premium, role } = req.body;

    // Check for existing user
    const existingUser = await usersCollection.findOne({ firebaseUID });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this Firebase UID already exists' });
    }

    const newUser = {
      firebaseUID,
      fullName: fullName || '',
      email: email || '',
      premium: premium || false,
      role: role || 'user',
      storageUsed: 0,
      projects: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      privacy: {
        showEmail: true,
        showPhone: false,
        showLocation: true,
      },
    };

    const result = await usersCollection.insertOne(newUser);
    res.status(201).json({ _id: result.insertedId, ...newUser });
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT update user
router.put('/:id', validateId, handleValidationErrors, upload.single('profileImage'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      fullName,
      email,
      phone,
      location,
      company,
      position,
      bio,
      website,
      linkedIn,
      github,
      twitter,
      dateOfBirth,
      privacy,
      premium,
      role,
    } = req.body;

    console.log("Parsed privacy:", privacy ? JSON.parse(privacy) : null);

    const updateData = {
      fullName: fullName || undefined,
      email: email || undefined,
      phone: phone || undefined,
      location: location || undefined,
      company: company || undefined,
      position: position || undefined,
      bio: bio || undefined,
      website: website || undefined,
      linkedIn: linkedIn || undefined,
      github: github || undefined,
      twitter: twitter || undefined,
      dateOfBirth: dateOfBirth || undefined,
      privacy: privacy ? JSON.parse(privacy) : undefined,
      premium: premium !== undefined ? premium : undefined,
      role: role || undefined,
      updatedAt: new Date(),
    };

    if (req.file) {
      updateData.photoURL = `/uploads/${req.file.filename}`; 
    }

    // Remove undefined fields
    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

    let result;
    if (ObjectId.isValid(id) && id.length === 24) {
      result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
      );
    } else {
      result = await usersCollection.updateOne(
        { firebaseUID: id },
        { $set: updateData }
      );
    }

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (result.modifiedCount === 0) {
      return res.status(200).json(updateData);
    }

    // Recalculate storage after update
    const storageBytes = await calculateUserStorage(id);
    await usersCollection.updateOne(
      { firebaseUID: id },
      { $set: { storageUsed: storageBytes, lastStorageUpdate: new Date() } }
    );

    res.status(200).json({ ...updateData, photoURL: updateData.photoURL, storageBytes });
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE user
router.delete('/:id', validateId, handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;

    let result;
    if (ObjectId.isValid(id) && id.length === 24) {
      result = await usersCollection.deleteOne({ _id: new ObjectId(id) });
    } else {
      result = await usersCollection.deleteOne({ firebaseUID: id });
    }

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = { router, setCollection };