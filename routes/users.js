const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb");
const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Ensure this folder exists
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
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = filetypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error("Images only (jpg, png, gif)"));
    }
  },
});

let usersCollection;
let db;

// Set collection from index.js
const setCollection = (database) => {
  db = database;
  usersCollection = db.collection("users");
};

// Helper function to calculate user storage
const calculateUserStorage = async (firebaseUID) => {
  try {
    let totalBytes = 0;

    // User profile size
    const userProfile = await usersCollection.findOne({ firebaseUID });
    if (userProfile) {
      totalBytes += JSON.stringify(userProfile).length;
      // Add profile image size if it exists
      if (userProfile.photoURL) {
        try {
          const filePath = path.join(__dirname, "..", userProfile.photoURL);
          const stats = await fs.stat(filePath);
          totalBytes += stats.size;
        } catch (fileError) {
          console.error(
            `Error reading profile image size: ${fileError.message}`
          );
        }
      }
    }

    return totalBytes;
  } catch (error) {
    console.error("Storage calculation error:", error);
    return 0;
  }
};

// Helper function to format bytes
const formatBytes = (bytes) => {
  if (bytes === 0) return "0 MB";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

// GET all users
router.get("/", async (req, res) => {
  try {
    const users = await usersCollection.find().toArray();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single user by Firebase UID
router.get("/:uid", async (req, res) => {
  try {
    const user = await usersCollection.findOne({
      firebaseUID: req.params.uid,
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Calculate current storage
    let storageBytes = user.storageUsed || 0;
    storageBytes = await calculateUserStorage(req.params.uid);

    // Update storage in database
    await usersCollection.updateOne(
      { firebaseUID: req.params.uid },
      { $set: { storageUsed: storageBytes, lastStorageUpdate: new Date() } }
    );

    const userWithStorage = {
      ...user,
      storageUsed: formatBytes(storageBytes),
      storageBytes: storageBytes,
    };

    res.json(userWithStorage);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET user storage info separately
router.get("/:uid/storage", async (req, res) => {
  try {
    const storageBytes = await calculateUserStorage(req.params.uid);

    // Update storage in user document
    await usersCollection.updateOne(
      { firebaseUID: req.params.uid },
      {
        $set: {
          storageUsed: storageBytes,
          lastStorageUpdate: new Date(),
        },
      }
    );

    // Storage limit check
    const user = await usersCollection.findOne({ firebaseUID: req.params.uid });
    const isPremium = user?.premium || false;
    const storageLimit = isPremium
      ? 50 * 1024 * 1024 * 1024
      : 5 * 1024 * 1024 * 1024; // 50GB or 5GB
    const storagePercentage = ((storageBytes / storageLimit) * 100).toFixed(1);

    res.json({
      storageUsed: formatBytes(storageBytes),
      storageBytes: storageBytes,
      storageLimit: formatBytes(storageLimit),
      storagePercentage: storagePercentage,
      isPremium: isPremium,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update user
// PUT update user
router.put("/:id", upload.single("profileImage"), async (req, res) => {
  try {
    const userId = req.params.id;
    const updatedUser = req.body;

    // Parse privacy field if it's a string (from FormData)
    if (typeof updatedUser.privacy === "string") {
      updatedUser.privacy = JSON.parse(updatedUser.privacy);
    }

    // Add profile image path if uploaded
    if (req.file) {
      updatedUser.photoURL = `/uploads/${req.file.filename}`;
    }

    // Add server timestamp for updatedAt
    const updateData = {
      ...updatedUser,
      updatedAt: new Date()
    };

    let result;

    // Check if the ID is a MongoDB ObjectId or Firebase UID
    if (ObjectId.isValid(userId) && userId.length === 24) {
      console.log(`Updating user by MongoDB _id: ${userId}`);
      result = await usersCollection.updateOne(
        { _id: new ObjectId(userId) },
        { $set: updateData }
      );
    } else {
      console.log(`Updating user by firebaseUID: ${userId}`);
      result = await usersCollection.updateOne(
        { firebaseUID: userId },
        { $set: updateData }
      );
    }

    if (result.matchedCount === 0) {
      return res.status(404).json({ 
        error: "User not found",
        message: "No user found with the provided ID" 
      });
    }

    if (result.modifiedCount === 0) {
      return res.status(200).json({ 
        message: "No changes made to user profile",
        result 
      });
    }

    // Recalculate storage after update
    const storageBytes = await calculateUserStorage(userId);
    await usersCollection.updateOne(
      { firebaseUID: userId },
      { $set: { storageUsed: storageBytes, lastStorageUpdate: new Date() } }
    );

    // Return success response
    res.status(200).json({ 
      message: "User profile updated successfully",
      modifiedCount: result.modifiedCount,
      result,
      photoURL: updateData.photoURL // শুধু নতুন photoURL পাঠানো
    });

  } catch (err) {
    console.error("Error updating user:", err);
    res.status(500).json({ 
      error: "Internal server error",
      message: err.message 
    });
  }
});

// GET user by ID (for MongoDB _id or Firebase UID)
router.get("/:id", async (req, res) => {
  try {
    const userId = req.params.id;
    let user;

    if (ObjectId.isValid(userId) && userId.length === 24) {
      console.log(`Fetching user by MongoDB _id: ${userId}`);
      user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    } else {
      console.log(`Fetching user by firebaseUID: ${userId}`);
      user = await usersCollection.findOne({ firebaseUID: userId });
    }

    if (!user) {
      return res.status(404).json({
        error: "User not found",
        message: "No user found with the provided ID",
      });
    }

    res.status(200).json(user);
  } catch (err) {
    console.error("Error fetching user:", err);
    res.status(500).json({
      error: "Internal server error",
      message: err.message,
    });
  }
});

// POST create user
router.post("/", async (req, res) => {
  try {
    const newUser = {
      firebaseUID: req.body.firebaseUID,
      fullName: req.body.fullName,
      email: req.body.email,
      premium: req.body.premium || false,
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
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE user
router.delete("/:id", async (req, res) => {
  try {
    const result = await usersCollection.deleteOne({
      _id: new ObjectId(req.params.id),
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { router, setCollection };
