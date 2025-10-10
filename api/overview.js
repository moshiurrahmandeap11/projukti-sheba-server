const express = require('express');
const router = express.Router();

let overviewCollection;

const setCollection = (db) => {
    overviewCollection = db.collection("overview");
}

// GET all overview stats
router.get("/", async (req, res) => {
    try {
        const result = await overviewCollection.find().toArray();
        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        console.log("Error fetching overview data:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch overview data"
        });
    }
});

// UPDATE overview stats
router.put("/", async (req, res) => {
    try {
        const { stats } = req.body;
        
        if (!stats || !Array.isArray(stats)) {
            return res.status(400).json({
                success: false,
                message: "Invalid data format"
            });
        }

        // Delete all existing documents
        await overviewCollection.deleteMany({});
        
        // Insert new documents
        const documents = stats.map((stat, index) => ({
            id: index,
            label: stat.label,
            value: stat.value
        }));
        
        const result = await overviewCollection.insertMany(documents);
        
        res.status(200).json({
            success: true,
            message: "Overview data updated successfully",
            data: result
        });
    } catch (error) {
        console.log("Error updating overview data:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update overview data"
        });
    }
});

module.exports = { router, setCollection };