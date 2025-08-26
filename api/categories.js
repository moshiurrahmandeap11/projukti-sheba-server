const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb");

let categoriesCollection;

// Set MongoDB collection
const setCollection = (db) => {
  categoriesCollection = db.collection("categories");
};

// GET all categories
router.get("/", async (req, res) => {
  try {
    const categories = await categoriesCollection.find().toArray();
    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories, // sob array e jabe
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// POST new category (expects array of objects [{name: 'Website'}, ...])
router.post("/", async (req, res) => {
  try {
    const newCategories = req.body;

    if (!Array.isArray(newCategories)) {
      return res.status(400).json({
        success: false,
        message: "Request body must be an array of categories",
      });
    }

    const result = await categoriesCollection.insertMany(newCategories);

    res.status(201).json({
      success: true,
      message: "Categories added successfully",
      count: result.insertedCount,
      data: newCategories.map((cat, i) => ({
        _id: result.insertedIds[i],
        ...cat,
      })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// DELETE a category by _id
router.delete("/:id", async (req, res) => {
  try {
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    const result = await categoriesCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

module.exports = { router, setCollection };
