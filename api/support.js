const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');

let supportTicketsCollection;

// set mongoDB collection
const setCollection = (db) => {
    supportTicketsCollection = db.collection('support_tickets');
}

// get all support tickets
router.get("/", async (req, res) => {
    try {
        const { startDate, endDate } = req.query; // YYYY-MM-DD format expected
        const query = {};

        // Date filter
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate).toISOString();
            if (endDate) query.createdAt.$lte = new Date(endDate).toISOString();
        }

        const tickets = await supportTicketsCollection
            .find(query)
            .sort({ createdAt: -1 }) // latest first
            .toArray();

        res.status(200).json({
            success: true,
            count: tickets.length,
            data: tickets
        });
    } catch (error) {
        console.error("Error fetching support tickets:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
});


// post api
router.post("/", async(req, res) => {
    try {
        const newTicket = {
            ...req.body,
            status: 'pending', // default status
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        const result = await supportTicketsCollection.insertOne(newTicket);
        res.status(201).json({
            success: true,
            message: "Support ticket created successfully",
            data: result
        });
    } catch (error) {
        console.error("Error creating support ticket:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create support ticket"
        });
    }
})

// patch api - update ticket status
router.patch("/:id", async(req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        // Validate ObjectId
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid ticket ID"
            });
        }

        // Validate status
        const validStatuses = ['pending', 'engage', 'completed'];
        if (!status || !validStatuses.includes(status.toLowerCase())) {
            return res.status(400).json({
                success: false,
                message: "Invalid status. Must be one of: pending, engage, completed"
            });
        }

        // Update the ticket
        const result = await supportTicketsCollection.updateOne(
            { _id: new ObjectId(id) },
            { 
                $set: { 
                    status: status.toLowerCase(),
                    updatedAt: new Date().toISOString()
                }
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Ticket not found"
            });
        }

        if (result.modifiedCount === 0) {
            return res.status(200).json({
                success: true,
                message: "Ticket status was already set to this value"
            });
        }

        res.status(200).json({
            success: true,
            message: "Ticket status updated successfully",
            data: {
                ticketId: id,
                newStatus: status.toLowerCase(),
                updatedAt: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error("Error updating support ticket:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
})

module.exports = {router, setCollection}