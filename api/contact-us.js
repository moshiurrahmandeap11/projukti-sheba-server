const express = require('express');
const { ObjectId } = require('mongodb');
const router = express.Router();

let ContactUsCollection;

const setCollection = (db) => {
    ContactUsCollection = db.collection("contactRequests");
};

// POST: Save unsubmitted form data
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

        const contactRequest = {
            name,
            email,
            phone: phone || '',
            company: company || '',
            subject,
            message,
            service: service || '',
            createdAt: new Date(),
            submitted: false
        };

        const result = await ContactUsCollection.insertOne(contactRequest);
        res.status(201).json({
            success: true,
            data: { _id: result.insertedId, ...contactRequest }
        });
    } catch (error) {
        console.error('Error creating unsubmitted contact request:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// GET: Fetch all contact requests
router.get('/', async (req, res) => {
    try {
        const contactRequests = await ContactUsCollection.find().toArray();
        res.status(200).json({
            success: true,
            count: contactRequests.length,
            data: contactRequests
        });
    } catch (error) {
        console.error('Error fetching contact requests:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// DELETE: Delete a contact request by ID
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Validate ObjectID
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid ID format'
            });
        }

        const result = await ContactUsCollection.deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Contact request not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Contact request deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting contact request:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

module.exports = { router, setCollection };