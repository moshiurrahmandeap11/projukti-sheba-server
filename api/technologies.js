const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb"); 

let technologiesCollection;

const setCollection = (db) => {
  technologiesCollection = db.collection("technologies");
};

// GET technologies
router.get("/", async (req, res) => {
  try {
    const technologies = await technologiesCollection.find().toArray();
    res.status(200).json({
      success: true,
      count: technologies.length,
      data: technologies, // সব array আকারে যাবে
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// POST technologies (array accept করবে)
router.post("/", async (req, res) => {
  try {
    const newTechnologies = req.body; // Expecting an array

    if (!Array.isArray(newTechnologies)) {
      return res.status(400).json({
        success: false,
        message: "Request body must be an array of technologies",
      });
    }

    const result = await technologiesCollection.insertMany(newTechnologies);

    res.status(201).json({
      success: true,
      message: "Technologies added successfully",
      count: result.insertedCount,
      data: newTechnologies.map((tech, index) => ({
        _id: result.insertedIds[index],
        ...tech,
      })),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});


// DELETE a technology by _id
router.delete("/:id", async (req, res) => {
  try {
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid technology ID",
      });
    }

    const result = await technologiesCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Technology not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Technology deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

module.exports = { router, setCollection };
