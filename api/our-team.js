const express = require('express');
const router = express.Router();

let OurTeamCollection;

const setCollection = (db) => {
  OurTeamCollection = db.collection("our_team");
};


// get all categories

router.get("/", async( req, res) => {
    try {
        const teamMembers = await OurTeamCollection.find().toArray();
        res.status(200).json({
            success: true,
            count: teamMembers.length,
            data: teamMembers
        })
    } catch (error) {
        console.error("Error fetching team members:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch team members"
        });
    }
})

module.exports = { router, setCollection };