const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');

let OurTeamCollection;

const setCollection = (db) => {
  OurTeamCollection = db.collection("our_team");
};

// Input validation middleware
const validateTeamMember = (req, res, next) => {
  const { name, position, department, experience, expertise, bio, social, skills, icon, image } = req.body;

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ success: false, message: 'Name is required and must be a non-empty string' });
  }
  if (!position || typeof position !== 'string' || position.trim() === '') {
    return res.status(400).json({ success: false, message: 'Position is required and must be a non-empty string' });
  }
  if (!department || typeof department !== 'string' || department.trim() === '') {
    return res.status(400).json({ success: false, message: 'Department is required and must be a non-empty string' });
  }
  if (!experience || typeof experience !== 'string' || experience.trim() === '') {
    return res.status(400).json({ success: false, message: 'Experience is required and must be a non-empty string' });
  }
  if (!Array.isArray(expertise) || expertise.length === 0 || !expertise.every(item => typeof item === 'string')) {
    return res.status(400).json({ success: false, message: 'Expertise must be a non-empty array of strings' });
  }
  if (!bio || typeof bio !== 'string' || bio.trim() === '') {
    return res.status(400).json({ success: false, message: 'Bio is required and must be a non-empty string' });
  }
  if (!social || typeof social !== 'object' || !social.linkedin || !social.twitter || !social.email || !social.github) {
    return res.status(400).json({ success: false, message: 'Social links (linkedin, twitter, email, github) are required' });
  }
  if (!Array.isArray(skills) || skills.length === 0 || !skills.every(item => typeof item === 'string')) {
    return res.status(400).json({ success: false, message: 'Skills must be a non-empty array of strings' });
  }
  if (!icon || typeof icon !== 'string' || icon.trim() === '') {
    return res.status(400).json({ success: false, message: 'Icon is required and must be a non-empty string' });
  }
  if (!image || typeof image !== 'string' || image.trim() === '') {
    return res.status(400).json({ success: false, message: 'Image is required and must be a non-empty string' });
  }

  next();
};

// GET all team members
router.get("/", async (req, res) => {
  try {
    const teamMembers = await OurTeamCollection.find().toArray();
    res.status(200).json({
      success: true,
      count: teamMembers.length,
      data: teamMembers,
    });
  } catch (error) {
    console.error("Error fetching team members:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch team members",
    });
  }
});

// GET a team member by ID
router.get("/:id", async (req, res) => {
  try {
    const memberId = req.params.id;
    if (!ObjectId.isValid(memberId)) {
      return res.status(400).json({ success: false, message: "Invalid team member ID" });
    }

    const member = await OurTeamCollection.findOne({ _id: new ObjectId(memberId) });
    if (!member) {
      return res.status(404).json({ success: false, message: "Team member not found" });
    }

    res.status(200).json({
      success: true,
      data: member,
    });
  } catch (error) {
    console.error("Error fetching team member by ID:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch team member",
    });
  }
});

// POST a new team member
router.post("/", validateTeamMember, async (req, res) => {
  try {
    const newMember = {
      name: req.body.name,
      position: req.body.position,
      department: req.body.department,
      experience: req.body.experience,
      expertise: req.body.expertise,
      bio: req.body.bio,
      social: {
        linkedin: req.body.social.linkedin,
        twitter: req.body.social.twitter,
        email: req.body.social.email,
        github: req.body.social.github,
      },
      skills: req.body.skills,
      icon: req.body.icon,
      image: req.body.image,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await OurTeamCollection.insertOne(newMember);
    if (result.insertedId) {
      const insertedMember = await OurTeamCollection.findOne({ _id: result.insertedId });
      res.status(201).json({
        success: true,
        message: "Team member added successfully",
        data: insertedMember,
      });
    } else {
      throw new Error("Failed to insert team member");
    }
  } catch (error) {
    console.error("Error adding team member:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to add team member",
    });
  }
});

// PUT (update) a team member by ID
router.put("/:id", validateTeamMember, async (req, res) => {
  try {
    const memberId = req.params.id;
    if (!ObjectId.isValid(memberId)) {
      return res.status(400).json({ success: false, message: "Invalid team member ID" });
    }

    const updatedMember = {
      name: req.body.name,
      position: req.body.position,
      department: req.body.department,
      experience: req.body.experience,
      expertise: req.body.expertise,
      bio: req.body.bio,
      social: {
        linkedin: req.body.social.linkedin,
        twitter: req.body.social.twitter,
        email: req.body.social.email,
        github: req.body.social.github,
      },
      skills: req.body.skills,
      icon: req.body.icon,
      image: req.body.image,
      updatedAt: new Date(),
    };

    const result = await OurTeamCollection.updateOne(
      { _id: new ObjectId(memberId) },
      { $set: updatedMember }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: "Team member not found" });
    }

    if (result.modifiedCount > 0) {
      const updatedDoc = await OurTeamCollection.findOne({ _id: new ObjectId(memberId) });
      res.status(200).json({
        success: true,
        message: "Team member updated successfully",
        data: updatedDoc,
      });
    } else {
      res.status(200).json({
        success: true,
        message: "No changes made to team member",
      });
    }
  } catch (error) {
    console.error("Error updating team member:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to update team member",
    });
  }
});

// DELETE a team member by ID
router.delete("/:id", async (req, res) => {
  try {
    const memberId = req.params.id;
    if (!ObjectId.isValid(memberId)) {
      return res.status(400).json({ success: false, message: "Invalid team member ID" });
    }

    const result = await OurTeamCollection.deleteOne({ _id: new ObjectId(memberId) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: "Team member not found" });
    }

    res.status(200).json({
      success: true,
      message: "Team member deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting team member:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to delete team member",
    });
  }
});

module.exports = { router, setCollection };