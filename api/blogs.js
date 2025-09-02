const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');

let blogsCollection;

const setCollection = (db) => {
    blogsCollection = db.collection('blogs');
};

// GET all blogs
router.get("/", async (req, res) => {
    try {
        const blogs = await blogsCollection.find().toArray();
        res.status(200).json({
            success: true,
            count: blogs.length,
            data: blogs
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch blogs" });
    }
});

// GET a single blog by ID
router.get("/:id", async (req, res) => {
    try {
        const blogId = req.params.id;
        const blog = await blogsCollection.findOne({ _id: new ObjectId(blogId) });

        if (!blog) {
            return res.status(404).json({ error: "Blog not found" });
        }

        res.status(200).json({
            success: true,
            data: blog
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch blog" });
    }
});


// POST a new blog
router.post("/", async (req, res) => {
    try {
        const blogData = {
            ...req.body,
            createdAt: req.body.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        const result = await blogsCollection.insertOne(blogData);
        const insertedBlog = await blogsCollection.findOne({ _id: result.insertedId });
        res.status(201).json({
            success: true,
            data: insertedBlog
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to create blog" });
    }
});

// PUT update a blog by ID
router.put("/:id", async (req, res) => {
  try {
    const blogId = req.params.id;
    
    // Validate if ID is a valid ObjectId
    if (!ObjectId.isValid(blogId)) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid blog ID format" 
      });
    }

    const blogData = {
      ...req.body,
      updatedAt: new Date().toISOString()
    };

    const result = await blogsCollection.findOneAndUpdate(
      { _id: new ObjectId(blogId) },
      { $set: blogData },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return res.status(404).json({ 
        success: false, 
        error: "Blog not found" 
      });
    }

    res.status(200).json({
      success: true,
      data: result.value
    });

  } catch (error) {
    console.error("Update blog error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to update blog" 
    });
  }
});

// DELETE a blog by ID
router.delete("/:id", async (req, res) => {
    try {
        const blogId = req.params.id;
        const result = await blogsCollection.deleteOne({ _id: new ObjectId(blogId) });
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: "Blog not found" });
        }
        res.status(200).json({
            success: true,
            data: { message: "Blog deleted successfully" }
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete blog" });
    }
});

module.exports = { router, setCollection };