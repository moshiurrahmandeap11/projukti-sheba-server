const express = require('express');
const router = express.Router();

let supportTicketsCollection;

// set mongoDB collection
const setCollection = (db) => {
    supportTicketsCollection = db.collection('support_tickets');
}

// get all support tickets

router.get("/", async(req, res) => {
    try {
        const tickets = await supportTicketsCollection.find().toArray();
        res.status(200).json({
            success: true,
            count: tickets.length,
            data: tickets
        })
    } catch (error) {
        console.error("Error fetching support tickets:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
})

module.exports = {router, setCollection}