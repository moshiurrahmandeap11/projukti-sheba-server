const express = require('express');
const { ObjectId } = require('mongodb');
const { body, param, query, validationResult } = require('express-validator');
const router = express.Router();

// Collection placeholder
let db;

// Function to set the database collection
const setCollection = (database) => {
  db = database;
};

// Validation middleware for POST and PUT
const projectValidationRules = [
  body('firebaseID')
    .trim()
    .notEmpty()
    .withMessage('Firebase ID is required')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Invalid Firebase ID format'),
  body('postId')
    .trim()
    .notEmpty()
    .withMessage('Post ID is required')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Invalid Post ID format'),
];

// Validation middleware for ObjectId
const validateObjectId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid project ID'),
];

// Error handling middleware
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

// GET /total-projects - Retrieve all projects with optional firebaseID filter
router.get(
  '/',
  [
    query('firebaseID')
      .optional()
      .trim()
      .matches(/^[a-zA-Z0-9_-]+$/)
      .withMessage('Invalid Firebase ID format'),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { firebaseID } = req.query;
      const filter = firebaseID ? { firebaseID } : {};
      const projects = await db.collection('totalProjects').find(filter).toArray();
      
      res.status(200).json({
        success: true,
        data: projects,
        count: projects.length,
      });
    } catch (error) {
      console.error('Error fetching projects:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }
);

// GET /total-projects/:firebaseID - Retrieve projects by firebaseID
router.get(
  '/:firebaseID',
  [
    param('firebaseID')
      .trim()
      .notEmpty()
      .withMessage('Firebase ID is required')
      .matches(/^[a-zA-Z0-9_-]+$/)
      .withMessage('Invalid Firebase ID format'),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { firebaseID } = req.params;
      const projects = await db.collection('totalProjects').find({ firebaseID }).toArray();

      if (projects.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No projects found for this Firebase ID',
        });
      }

      res.status(200).json({
        success: true,
        data: projects,
        count: projects.length,
      });
    } catch (error) {
      console.error('Error fetching projects by firebaseID:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }
);

// POST /total-projects - Create a new project
router.post(
  '/',
  projectValidationRules,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { firebaseID, postId } = req.body;

      // Check for duplicate postId
      const existingProject = await db.collection('totalProjects').findOne({ postId });
      if (existingProject) {
        return res.status(400).json({
          success: false,
          message: 'Post ID already exists',
        });
      }

      const newProject = {
        firebaseID,
        postId,
        createdAt: new Date(),
      };

      const result = await db.collection('totalProjects').insertOne(newProject);

      res.status(201).json({
        success: true,
        message: 'Project created successfully',
        data: {
          _id: result.insertedId,
          ...newProject,
        },
      });
    } catch (error) {
      console.error('Error creating project:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }
);

// PUT /total-projects/:id - Update an existing project
router.put(
  '/:id',
  validateObjectId,
  projectValidationRules,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { firebaseID, postId } = req.body;

      // Check for duplicate postId (excluding the current project)
      const existingProject = await db.collection('totalProjects').findOne({
        postId,
        _id: { $ne: new ObjectId(id) },
      });
      if (existingProject) {
        return res.status(400).json({
          success: false,
          message: 'Post ID already exists',
        });
      }

      const updateData = {
        firebaseID,
        postId,
        createdAt: new Date(), // Retain original createdAt or update if desired
      };

      const result = await db.collection('totalProjects').findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: updateData },
        { returnDocument: 'after' }
      );

      if (!result.value) {
        return res.status(404).json({
          success: false,
          message: 'Project not found',
        });
      }

      res.status(200).json({
        success: true,
        message: 'Project updated successfully',
        data: result.value,
      });
    } catch (error) {
      console.error('Error updating project:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }
);

// DELETE /total-projects/:id - Delete a project
router.delete(
  '/:id',
  validateObjectId,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id } = req.params;

      const result = await db.collection('totalProjects').deleteOne({
        _id: new ObjectId(id),
      });

      if (result.deletedCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'Project not found',
        });
      }

      res.status(200).json({
        success: true,
        message: 'Project deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting project:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }
);

module.exports = {
  router,
  setCollection,
};