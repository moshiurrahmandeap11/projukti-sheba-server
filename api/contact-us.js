const express = require('express');
const { setCollection } = require('./our-team');
const router = express.Router();


// get all contact requests
router.get("/", async(req, res) => {
    try {
        const contactRequests = await ContactUsCollection.find().toArray();
        res.status(200).json({
            success: true,
            count: contactRequests.length,
            data: contactRequests
        })
    } catch (error) {
        console.error("Error fetching contact requests:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        })
    }
})

module.exports = {router, setCollection}