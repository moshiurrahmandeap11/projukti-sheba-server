const express = require('express');
const { ObjectId } = require('mongodb');
const router = express.Router();

let servicesCollection; // mongo collection handle

// setCollection function (Mongo collection assign করার জন্য)
function setCollection(db) {
  servicesCollection = db.collection("services");
}

// @route   GET /services
router.get("/", async (req, res) => {
  try {
    const services = await servicesCollection.find().toArray();
    res.status(200).json({
      success: true,
      count: services.length,
      data: services
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// @route   GET /services/:id (Single service get করার জন্য)
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid service ID" });
    }

    const service = await servicesCollection.findOne({ _id: new ObjectId(id) });
    
    if (!service) {
      return res.status(404).json({ success: false, message: "Service not found" });
    }

    res.status(200).json({
      success: true,
      data: service
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// @route   POST /services
router.post("/", async (req, res) => {
  try {
    const {
      title,
      paragraph,
      keyFeatures,
      technologies,
      totalProjects,
      category
    } = req.body;

    if (!title || !paragraph) {
      return res.status(400).json({ success: false, message: "Title & paragraph required" });
    }

    const newService = {
      title,
      paragraph,
      keyFeatures: keyFeatures || [],
      technologies: technologies || [],
      totalProjects: totalProjects || 0,
      category: category || "General",
      createdAt: new Date()
    };

    const result = await servicesCollection.insertOne(newService);

    res.status(201).json({
      success: true,
      message: "Service added successfully",
      data: { ...newService, _id: result.insertedId }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// @route   PUT /services/:id (Service update করার জন্য)
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      paragraph,
      keyFeatures,
      technologies,
      totalProjects,
      category
    } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid service ID" });
    }

    if (!title || !paragraph) {
      return res.status(400).json({ success: false, message: "Title & paragraph required" });
    }

    const updatedService = {
      title,
      paragraph,
      keyFeatures: keyFeatures || [],
      technologies: technologies || [],
      totalProjects: totalProjects || 0,
      category: category || "General",
      updatedAt: new Date()
    };

    const result = await servicesCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedService }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: "Service not found" });
    }

    res.status(200).json({
      success: true,
      message: "Service updated successfully",
      data: { ...updatedService, _id: id }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// @route   DELETE /services/:id (Service delete করার জন্য)
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid service ID" });
    }

    const result = await servicesCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: "Service not found" });
    }

    res.status(200).json({
      success: true,
      message: "Service deleted successfully"
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = { router, setCollection }; 