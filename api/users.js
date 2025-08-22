const express = require('express');
const { ObjectId } = require('mongodb');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { body, param, validationResult } = require('express-validator');

// module.exports এখন একটি ফাংশন যা কালেকশন গ্রহণ করে
module.exports = (usersCollection, admin) => {
  const router = express.Router();

  // Configure multer for file uploads
  // Vercel-এ লোকাল স্টোরেজ কাজ করে না। এটি শুধুমাত্র লোকাল ডেভেলপমেন্টের জন্য।
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

  // Validation middleware
  const userValidationRules = [
    body('firebaseUID')
      .trim()
      .notEmpty()
      .withMessage('Firebase UID is required')
      .matches(/^[a-zA-Z0-9_-]+$/)
      .withMessage('Invalid Firebase UID format'),
    body('email').optional().isEmail().withMessage('Invalid email format'),
    body('fullName').optional().trim().isLength({ max: 100 }).withMessage('Full name must not exceed 100 characters'),
    body('role').optional().isIn(['user', 'admin']).withMessage('Role must be either "user" or "admin"'),
  ];
  
  const validateId = [
    param('id')
      .custom((value) => ObjectId.isValid(value) || /^[a-zA-Z0-9_-]+$/.test(value))
      .withMessage('Invalid ID format'),
  ];

  const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array().map(err => ({ field: err.param, message: err.msg })),
      });
    }
    next();
  };

  // Helper functions (calculateUserStorage, formatBytes) এখানে থাকবে...
    // Helper function to calculate user storage
  const calculateUserStorage = async (firebaseUID) => {
    try {
      let totalBytes = 0;
      const userProfile = await usersCollection.findOne({ firebaseUID });
      if (userProfile) {
        totalBytes += JSON.stringify(userProfile).length;
        if (userProfile.photoURL) {
          try {
            // Vercel-এ এটি কাজ করবে না, কারণ লোকাল ফাইল সিস্টেম নেই
            const filePath = path.join(__dirname, '..', userProfile.photoURL);
            const stats = await fs.stat(filePath);
            totalBytes += stats.size;
          } catch (fileError) {
            // console.error(`Error reading profile image size for ${firebaseUID}: ${fileError.message}`);
          }
        }
      }
      return totalBytes;
    } catch (error) {
      console.error(`Storage calculation error for ${firebaseUID}:`, error);
      return 0;
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 MB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // --- Routes ---

  // GET all users
  router.get('/', async (req, res) => {
    try {
      const users = await usersCollection.find().toArray();
      res.status(200).json({ success: true, data: users, count: users.length });
    } catch (err) {
      console.error('Error fetching users:', err);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });

  // GET single user by Firebase UID or MongoDB _id
  router.get('/:id', validateId, handleValidationErrors, async (req, res) => {
    // ... আপনার বাকি কোড এখানে অপরিবর্তিত থাকবে ...
    try {
        const { id } = req.params;
        let user;

        if (ObjectId.isValid(id) && id.length === 24) {
          user = await usersCollection.findOne({ _id: new ObjectId(id) });
        } else {
          user = await usersCollection.findOne({ firebaseUID: id });
        }

        if (!user) {
          return res.status(404).json({ success: false, error: 'User not found' });
        }

        let storageBytes = await calculateUserStorage(user.firebaseUID);

        await usersCollection.updateOne(
          { firebaseUID: user.firebaseUID },
          { $set: { storageUsed: storageBytes, lastStorageUpdate: new Date() } }
        );

        const userWithStorage = {
          ...user,
          role: user.role || 'user',
          storageUsed: formatBytes(storageBytes),
          storageBytes,
        };

        res.status(200).json({ success: true, data: userWithStorage });
      } catch (err) {
        console.error('Error fetching user:', err);
        res.status(500).json({ success: false, error: 'Internal server error' });
      }
  });
  
  // POST, PUT, DELETE রাউটগুলো এখানে অপরিবর্তিত থাকবে...
  // ... আপনার POST, PUT, DELETE রাউটের কোডগুলো এখানে কপি করে দিন ...


  // সবশেষে router রিটার্ন করতে হবে
  return router;
};