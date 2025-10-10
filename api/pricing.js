const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');

let pricingCollection;
let categoriesCollection;

const setCollection = (db) => {
    pricingCollection = db.collection("pricing");
    categoriesCollection = db.collection("pricing_categories");
}

// GET all categories
router.get("/categories", async (req, res) => {
    try {
        const categories = await categoriesCollection.find().toArray();
        res.status(200).json({
            success: true,
            data: categories
        });
    } catch (error) {
        console.log("Error fetching categories:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch categories"
        });
    }
});

// GET all products
router.get("/products", async (req, res) => {
    try {
        const products = await pricingCollection.find().toArray();
        res.status(200).json({
            success: true,
            data: products
        });
    } catch (error) {
        console.log("Error fetching products:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch products"
        });
    }
});

// GET products by category
router.get("/products/category/:categoryId", async (req, res) => {
    try {
        const { categoryId } = req.params;
        const category = await categoriesCollection.findOne({ _id: new ObjectId(categoryId) });
        
        if (!category) {
            return res.status(404).json({
                success: false,
                message: "Category not found"
            });
        }

        const products = await pricingCollection.find({ category: category.name }).toArray();
        res.status(200).json({
            success: true,
            data: products
        });
    } catch (error) {
        console.log("Error fetching products by category:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch products"
        });
    }
});

// CREATE new category
router.post("/categories", async (req, res) => {
    try {
        const { name } = req.body;
        
        if (!name) {
            return res.status(400).json({
                success: false,
                message: "Category name is required"
            });
        }

        // Check if category already exists
        const existingCategory = await categoriesCollection.findOne({ name });
        if (existingCategory) {
            return res.status(400).json({
                success: false,
                message: "Category already exists"
            });
        }

        const result = await categoriesCollection.insertOne({
            name,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        res.status(201).json({
            success: true,
            message: "Category created successfully",
            data: result
        });
    } catch (error) {
        console.log("Error creating category:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create category"
        });
    }
});

// UPDATE category
router.put("/categories/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: "Category name is required"
            });
        }

        const result = await categoriesCollection.updateOne(
            { _id: new ObjectId(id) },
            { 
                $set: { 
                    name,
                    updatedAt: new Date()
                } 
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Category not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Category updated successfully"
        });
    } catch (error) {
        console.log("Error updating category:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update category"
        });
    }
});

// DELETE category
router.delete("/categories/:id", async (req, res) => {
    try {
        const { id } = req.params;

        // Check if category has products
        const category = await categoriesCollection.findOne({ _id: new ObjectId(id) });
        if (category) {
            const productsCount = await pricingCollection.countDocuments({ category: category.name });
            if (productsCount > 0) {
                return res.status(400).json({
                    success: false,
                    message: "Cannot delete category with existing products"
                });
            }
        }

        const result = await categoriesCollection.deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Category not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Category deleted successfully"
        });
    } catch (error) {
        console.log("Error deleting category:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete category"
        });
    }
});

// CREATE new product
router.post("/products", async (req, res) => {
    try {
        const { name, category, price, features, description, popular, startingPriceText, emi } = req.body;
        
        if (!name || !category || !price) {
            return res.status(400).json({
                success: false,
                message: "Name, category and price are required"
            });
        }

        const result = await pricingCollection.insertOne({
            name,
            category,
            price: Number(price),
            features: features || [],
            description: description || "",
            popular: popular || false,
            startingPriceText: startingPriceText || false,
            emi: emi || "$10/month",
            createdAt: new Date(),
            updatedAt: new Date()
        });

        res.status(201).json({
            success: true,
            message: "Product created successfully",
            data: result
        });
    } catch (error) {
        console.log("Error creating product:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create product"
        });
    }
});

// UPDATE product
router.put("/products/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { name, category, price, features, description, popular, startingPriceText, emi } = req.body;

        if (!name || !category || !price) {
            return res.status(400).json({
                success: false,
                message: "Name, category and price are required"
            });
        }

        const result = await pricingCollection.updateOne(
            { _id: new ObjectId(id) },
            { 
                $set: { 
                    name,
                    category,
                    price: Number(price),
                    features: features || [],
                    description: description || "",
                    popular: popular || false,
                    startingPriceText: startingPriceText || false,
                    emi: emi || "$10/month",
                    updatedAt: new Date()
                } 
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Product updated successfully"
        });
    } catch (error) {
        console.log("Error updating product:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update product"
        });
    }
});

// DELETE product
router.delete("/products/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pricingCollection.deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Product deleted successfully"
        });
    } catch (error) {
        console.log("Error deleting product:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete product"
        });
    }
});

module.exports = { router, setCollection };