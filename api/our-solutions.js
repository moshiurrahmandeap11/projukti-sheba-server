const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');

let ourSolutionsCollection;

const setCollection = (db) => {
    ourSolutionsCollection = db.collection("ourSolutions"); // lowercase এ পরিবর্তন করুন
}

// Get all solutions
router.get('/', async (req, res) => {
    try {
        console.log('Fetching all solutions...'); // Debug log
        const solutions = await ourSolutionsCollection.find({}).toArray();
        console.log('Found solutions:', solutions.length); // Debug log
        
        res.json({
            success: true,
            data: solutions
        });
    } catch (error) {
        console.error('Error fetching solutions:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch solutions'
        });
    }
});

// Debug route - সব রাউট চেক করার জন্য
router.get('/debug/routes', (req, res) => {
    const routes = [];
    router.stack.forEach((middleware) => {
        if (middleware.route) {
            routes.push({
                path: middleware.route.path,
                methods: Object.keys(middleware.route.methods)
            });
        }
    });
    res.json({ 
        message: 'Our Solutions Routes',
        routes: routes 
    });
});

// Get solution by category
router.get('/category/:category', async (req, res) => {
    try {
        const { category } = req.params;
        console.log('Fetching solution for category:', category);
        
        const solution = await ourSolutionsCollection.findOne({ category });
        
        if (!solution) {
            return res.status(404).json({
                success: false,
                message: 'Solution category not found'
            });
        }

        res.json({
            success: true,
            data: solution
        });
    } catch (error) {
        console.error('Error fetching solution:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch solution'
        });
    }
});

// Create or update solution category
router.post('/', async (req, res) => {
    try {
        const { category, solutions } = req.body;

        if (!category || !solutions) {
            return res.status(400).json({
                success: false,
                message: 'Category and solutions are required'
            });
        }

        // Check if category already exists
        const existingSolution = await ourSolutionsCollection.findOne({ category });
        
        if (existingSolution) {
            // Update existing category
            const result = await ourSolutionsCollection.updateOne(
                { category },
                { 
                    $set: { 
                        solutions,
                        updatedAt: new Date()
                    } 
                }
            );

            res.json({
                success: true,
                message: 'Solution category updated successfully',
                data: result
            });
        } else {
            // Create new category
            const newSolution = {
                category,
                solutions,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const result = await ourSolutionsCollection.insertOne(newSolution);

            res.status(201).json({
                success: true,
                message: 'Solution category created successfully',
                data: result
            });
        }
    } catch (error) {
        console.error('Error creating/updating solution:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create/update solution'
        });
    }
});

// Delete solution category
router.delete('/:category', async (req, res) => {
    try {
        const { category } = req.params;

        const result = await ourSolutionsCollection.deleteOne({ category });

        if (result.deletedCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Solution category not found'
            });
        }

        res.json({
            success: true,
            message: 'Solution category deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting solution:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete solution'
        });
    }
});

// Update individual solution item
router.put('/:category/item/:itemId', async (req, res) => {
    try {
        const { category, itemId } = req.params;
        const { title, subtitle, icon } = req.body;

        const result = await ourSolutionsCollection.updateOne(
            { 
                category,
                "solutions.id": parseInt(itemId)
            },
            {
                $set: {
                    "solutions.$.title": title,
                    "solutions.$.subtitle": subtitle,
                    "solutions.$.icon": icon,
                    updatedAt: new Date()
                }
            }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Solution item not found'
            });
        }

        res.json({
            success: true,
            message: 'Solution item updated successfully'
        });
    } catch (error) {
        console.error('Error updating solution item:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update solution item'
        });
    }
});

module.exports = { router, setCollection };