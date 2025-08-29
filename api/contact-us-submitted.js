const express = require('express');
const { ObjectId } = require('mongodb');
const router = express.Router();

let ContactUsSubmittedCollection;

const setCollection = (db) => {
    ContactUsSubmittedCollection = db.collection("contactSubmittedRequests");
};

// POST: Save submitted contact request
router.post('/', async (req, res) => {
    try {
        const { name, email, phone, company, subject, message, service } = req.body;

        // Validate required fields
        if (!name || !email || !subject || !message) {
            return res.status(400).json({
                success: false,
                message: 'Name, email, subject, and message are required'
            });
        }

        const submittedRequest = {
            name,
            email,
            phone: phone || '',
            company: company || '',
            subject,
            message,
            service: service || '',
            createdAt: new Date(),
            submitted: true
        };

        const result = await ContactUsSubmittedCollection.insertOne(submittedRequest);
        res.status(201).json({
            success: true,
            data: { _id: result.insertedId, ...submittedRequest }
        });
    } catch (error) {
        console.error('Error creating submitted contact request:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// GET: Fetch all submitted contact requests
router.get('/', async (req, res) => {
    try {
        const submittedRequests = await ContactUsSubmittedCollection.find().toArray();
        res.status(200).json({
            success: true,
            count: submittedRequests.length,
            data: submittedRequests
        });
    } catch (error) {
        console.error('Error fetching submitted contact requests:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// DELETE: Delete a submitted contact request by ID
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid ID format'
            });
        }

        const result = await ContactUsSubmittedCollection.deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Submitted contact request not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Submitted contact request deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting submitted contact request:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

module.exports = { router, setCollection };
