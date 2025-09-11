const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb");

let portfolioCollection;

const setCollection = (db) => {
  portfolioCollection = db.collection("portfolio");
};

// get all portfolio items
router.get("/", async (req, res) => {
  try {
    const portfolios = await portfolioCollection.find().toArray();
    res.status(200).json({
      success: true,
      count: portfolios.length,
      data: portfolios,
    });
  } catch (error) {
    console.error("Error fetching portfolios:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// get single portfolio item by id
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid ID format",
    });
  }

  try {
    const portfolioItem = await portfolioCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!portfolioItem) {
      return res.status(404).json({
        success: false,
        message: "Portfolio item not found",
      });
    }

    res.status(200).json({
      success: true,
      data: portfolioItem,
    });
  } catch (error) {
    console.error("Error fetching portfolio item:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// post a new portfolio item
router.post("/", async (req, res) => {
  const newPortfolio = req.body;

  try {
    const result = await portfolioCollection.insertOne(newPortfolio);
    res.status(201).json({
      success: true,
      message: "Portfolio item added successfully",
      data: { _id: result.insertedId, ...newPortfolio },
    });
  } catch (error) {
    console.error("Error adding portfolio item:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// put(update) a portfolio item by id
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const updatedPortfolio = req.body;

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid ID format",
    });
  }

  try {
    const result = await portfolioCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedPortfolio }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Portfolio item not found",
      });
    }

    const updatedDoc = await portfolioCollection.findOne({
      _id: new ObjectId(id),
    });

    res.status(200).json({
      success: true,
      message: "Portfolio item updated successfully",
      data: updatedDoc,
    });
  } catch (error) {
    console.error("Error updating portfolio item:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// delete a portfolio item by id
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid ID format",
    });
  }

  try {
    const result = await portfolioCollection.deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Portfolio item not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Portfolio item deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting portfolio item:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

module.exports = { router, setCollection };
