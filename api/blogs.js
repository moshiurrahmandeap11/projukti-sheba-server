// blogs.js

const express = require('express');
const router = express.Router();
// No longer need ObjectId unless other parts of your app use it
// const { ObjectId } = require('mongodb'); 

let blogsCollection;

const setCollection = (db) => {
    blogsCollection = db.collection('blogs');
};

// GET all blogs (no changes here)
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
        // FIX: Query by string ID directly
        const blog = await blogsCollection.findOne({ _id: blogId }); 
        if (!blog) {
            // This is the line that was correctly sending the 404
            return res.status(404).json({ success: false, error: "Blog not found" });
        }
        res.status(200).json({
            success: true,
            data: blog
        });
    } catch (error) {
        res.status(500).json({ success: false, error: "Failed to fetch blog" });
    }
});

// POST a new blog (no changes here)
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
        res.status(500).json({ success: false, error: "Failed to create blog" });
    }
});


// PUT update a blog by ID
router.put("/:id", async (req, res) => {
    try {
        const blogId = req.params.id;
        const blogData = {
            ...req.body,
            updatedAt: new Date().toISOString()
        };

        // FIX: Query by string ID directly, not new ObjectId(blogId)
        const result = await blogsCollection.findOneAndUpdate(
            { _id: blogId }, 
            { $set: blogData },
            { returnDocument: 'after' }
        );

        // This conditional logic is correct, but was being triggered by the type mismatch
        if (!result) { // The findOneAndUpdate result itself is the document or null
            return res.status(404).json({ success: false, error: "Blog not found" });
        }
        
        res.status(200).json({
            success: true,
            data: result // The updated document is directly in 'result'
        });
    } catch (error) {
        console.error("Update Error:", error); // Added for better server-side debugging
        res.status(500).json({ success: false, error: "Failed to update blog" });
    }
});


// DELETE a blog by ID
router.delete("/:id", async (req, res) => {
    try {
        const blogId = req.params.id;
        // FIX: Query by string ID directly
        const result = await blogsCollection.deleteOne({ _id: blogId });
        
        if (result.deletedCount === 0) {
            return res.status(404).json({ success: false, error: "Blog not found" });
        }
        res.status(200).json({
            success: true,
            data: { message: "Blog deleted successfully" }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: "Failed to delete blog" });
    }
});


module.exports = { router, setCollection };