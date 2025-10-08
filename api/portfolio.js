const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb");
const multer = require('multer');
const path = require('path');
const fs = require('fs');

let portfolioCollection;

// Multer configuration for image upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'uploads/portfolio';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileExtension = path.extname(file.originalname);
        cb(null, 'portfolio-' + uniqueSuffix + fileExtension);
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

const setCollection = (db) => {
    portfolioCollection = db.collection("portfolio");
};

// Get all portfolio items with optional filtering
router.get("/", async (req, res) => {
    try {
        const { category, featured, limit } = req.query;
        let query = {};
        
        if (category && category !== 'all') {
            query.category = category;
        }
        
        if (featured) {
            query.featured = featured === 'true';
        }

        let portfolios;
        if (limit) {
            portfolios = await portfolioCollection.find(query)
                .sort({ createdAt: -1 })
                .limit(parseInt(limit))
                .toArray();
        } else {
            portfolios = await portfolioCollection.find(query)
                .sort({ createdAt: -1 })
                .toArray();
        }

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

// Get single portfolio item by id
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

// Create new portfolio item with image upload
router.post("/", upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Image file is required",
            });
        }

        const portfolioData = {
            title: req.body.title,
            category: req.body.category,
            client: req.body.client,
            description: req.body.description,
            features: JSON.parse(req.body.features || '[]'),
            technologies: JSON.parse(req.body.technologies || '[]'),
            status: req.body.status || 'Completed',
            projectDate: req.body.projectDate,
            image: '/uploads/portfolio/' + req.file.filename,
            featured: req.body.featured === 'true',
            liveUrl: req.body.liveUrl || '',
            githubUrl: req.body.githubUrl || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const result = await portfolioCollection.insertOne(portfolioData);
        
        res.status(201).json({
            success: true,
            message: "Portfolio item added successfully",
            data: { _id: result.insertedId, ...portfolioData },
        });
    } catch (error) {
        console.error("Error adding portfolio item:", error);
        
        // Delete uploaded file if error occurs
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({
            success: false,
            message: error.message || "Internal server error",
        });
    }
});

// Update portfolio item with optional image upload
router.put("/:id", upload.single('image'), async (req, res) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({
            success: false,
            message: "Invalid ID format",
        });
    }

    try {
        // First find the existing portfolio
        const existingPortfolio = await portfolioCollection.findOne({ _id: new ObjectId(id) });
        
        if (!existingPortfolio) {
            return res.status(404).json({
                success: false,
                message: "Portfolio item not found",
            });
        }

        const updateData = {
            title: req.body.title,
            category: req.body.category,
            client: req.body.client,
            description: req.body.description,
            features: JSON.parse(req.body.features || '[]'),
            technologies: JSON.parse(req.body.technologies || '[]'),
            status: req.body.status,
            projectDate: req.body.projectDate,
            featured: req.body.featured === 'true',
            liveUrl: req.body.liveUrl || '',
            githubUrl: req.body.githubUrl || '',
            updatedAt: new Date().toISOString()
        };

        // If new image is uploaded, update the image path
        if (req.file) {
            // Delete old image file
            if (existingPortfolio.image) {
                const oldImagePath = path.join(__dirname, '../uploads/portfolio', path.basename(existingPortfolio.image));
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }
            updateData.image = '/uploads/portfolio/' + req.file.filename;
        }

        const result = await portfolioCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Portfolio item not found",
            });
        }

        const updatedDoc = await portfolioCollection.findOne({ _id: new ObjectId(id) });

        res.status(200).json({
            success: true,
            message: "Portfolio item updated successfully",
            data: updatedDoc,
        });
    } catch (error) {
        console.error("Error updating portfolio item:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Internal server error",
        });
    }
});

// Delete portfolio item
router.delete("/:id", async (req, res) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({
            success: false,
            message: "Invalid ID format",
        });
    }

    try {
        // First find the portfolio to get the image path
        const portfolio = await portfolioCollection.findOne({ _id: new ObjectId(id) });
        
        if (!portfolio) {
            return res.status(404).json({
                success: false,
                message: "Portfolio item not found",
            });
        }

        // Delete the image file
        if (portfolio.image) {
            const imagePath = path.join(__dirname, '../uploads/portfolio', path.basename(portfolio.image));
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }

        const result = await portfolioCollection.deleteOne({ _id: new ObjectId(id) });

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