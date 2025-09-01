const express = require('express');
const router = express.Router();

let testimonialsCollection;

const setCollection = (db) => {
    testimonialsCollection = db.collection("testimonials")
}

router.get("/", async (req, res) => {
    try {
        const testimonials = await testimonialsCollection.find().toArray();
        res.status(200).json({
            success: true,
            count: testimonials.length,
            data: testimonials
        })
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message,
        })
    }
})

module.exports = {router, setCollection}