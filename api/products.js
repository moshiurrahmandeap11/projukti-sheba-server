const express = require('express');
const { ObjectId } = require('mongodb');
const router = express.Router();

let productsCollection;

const setCollection = (db) => {
    productsCollection = db.collection("products");
};

// All products get (with optional category filter)
router.get("/", async (req, res) => {
    try {
        const { category } = req.query;
        const query = category ? { category } : {};
        const products = await productsCollection.find(query).toArray();
        res.status(200).json({
            success: true,
            count: products.length,
            data: products
        });
    } catch (err) {
        console.error("Error fetching products:", err);
        res.status(500).json({
            success: false,
            message: "Internal Server error"
        });
    }
});

// Get single product
router.get("/:id", async (req, res) => {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({
            success: false,
            message: "Invalid ID format",
        });
    }

    try {
        const productItem = await productsCollection.findOne({
            _id: new ObjectId(id),
        });

        if (!productItem) {
            return res.status(404).json({
                success: false,
                message: "Product item not found",
            });
        }

        res.status(200).json({
            success: true,
            data: productItem,
        });
    } catch (error) {
        console.error("Error fetching product item:", error);
        res.status(500).json({
            success: false,
            message: "Internal Server error",
        });
    }
});

// Post a new product item
router.post("/", async (req, res) => {
    const newProduct = req.body;

    try {
        const result = await productsCollection.insertOne(newProduct);
        res.status(201).json({
            success: true,
            message: "Product item added successfully",
            data: { _id: result.insertedId, ...newProduct },
        });
    } catch (error) {
        console.error("Error adding product item:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
});

// Put (update) a product item by id
router.put("/:id", async (req, res) => {
    const { id } = req.params;
    const updatedProduct = req.body;

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({
            success: false,
            message: "Invalid ID format",
        });
    }

    try {
        const result = await productsCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: updatedProduct }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Product item not found",
            });
        }

        const updatedDoc = await productsCollection.findOne({
            _id: new ObjectId(id),
        });

        res.status(200).json({
            success: true,
            message: "Product item updated successfully",
            data: updatedDoc,
        });
    } catch (error) {
        console.error("Error updating product item:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});

// Delete a product by id
router.delete("/:id", async (req, res) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({
            success: false,
            message: "Invalid ID format",
        });
    }

    try {
        const result = await productsCollection.deleteOne({
            _id: new ObjectId(id),
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Product item not found",
            });
        }

        res.status(200).json({
            success: true,
            message: "Product item deleted successfully",
        });
    } catch (error) {
        console.error("Error deleting product item:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});

module.exports = { router, setCollection };