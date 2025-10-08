const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { ObjectId } = require('mongodb');

let ourClientsCollection;

// Multer configuration for file upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'uploads/clients';
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Generate unique filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileExtension = path.extname(file.originalname);
        cb(null, 'client-' + uniqueSuffix + fileExtension);
    }
});

// File filter for images only
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
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

const setCollection = (db) => {
    ourClientsCollection = db.collection('ourClients');
};

// GET all clients
router.get("/", async (req, res) => {
    try {
        const clients = await ourClientsCollection.find().sort({ createdAt: -1 }).toArray();
        res.status(200).json({
            success: true,
            count: clients.length,
            data: clients
        });
    } catch (error) {
        console.error("Error fetching clients:", error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
});

// POST - Upload new client logo
router.post("/upload", upload.single('logo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "No file uploaded"
            });
        }

        const clientData = {
            originalName: req.file.originalname,
            filename: req.file.filename,
            logoUrl: '/uploads/clients/' + req.file.filename,
            mimetype: req.file.mimetype,
            size: req.file.size,
            createdAt: new Date().toISOString()
        };

        const result = await ourClientsCollection.insertOne(clientData);
        
        res.status(201).json({
            success: true,
            message: "Logo uploaded successfully",
            data: {
                _id: result.insertedId,
                ...clientData
            }
        });
    } catch (error) {
        console.error("Error uploading client logo:", error);
        
        // Delete uploaded file if error occurs
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
});

// DELETE a client by ID
router.delete("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        
        // Validate ObjectId
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid client ID"
            });
        }

        // First find the client to get the file path
        const client = await ourClientsCollection.findOne({ _id: new ObjectId(id) });
        
        if (!client) {
            return res.status(404).json({
                success: false,
                message: "Client not found"
            });
        }

        // Delete the file from server
        const filePath = path.join(__dirname, '../../uploads/clients', client.filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Delete from database
        const result = await ourClientsCollection.deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Client not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Client logo deleted successfully"
        });
    } catch (error) {
        console.error("Error deleting client:", error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
});

module.exports = { router, setCollection };