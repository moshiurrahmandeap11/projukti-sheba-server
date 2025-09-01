const express = require('express');
const { ObjectId } = require('mongodb');
const router = express.Router();

let TestimonialCollection;

const setCollection = (db) => {
  TestimonialCollection = db.collection("testimonials");
};

// POST: Save a new testimonial
router.post('/', async (req, res) => {
  try {
    const { name, position, company, location, date, rating, photoURL, testimonial, videoUrl, project, category } = req.body;

    const testimonialData = {
      name: name || '',
      position: position || '',
      company: company || '',
      location: location || '',
      date: date ? new Date(date) : new Date(),
      rating: rating ? parseInt(rating) : 0,
      photoURL: photoURL || '',
      testimonial: testimonial || '',
      videoUrl: videoUrl || '',
      project: project || '',
      category: category || '',
      createdAt: new Date(),
    };

    const result = await TestimonialCollection.insertOne(testimonialData);
    res.status(201).json({
      success: true,
      data: { _id: result.insertedId, ...testimonialData },
    });
  } catch (error) {
    console.error('Error creating testimonial:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
});

// PUT: Update a testimonial by ID
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, position, company, location, date, rating, photoURL, testimonial, videoUrl, project, category } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ID format',
      });
    }

    const testimonialData = {
      name: name || '',
      position: position || '',
      company: company || '',
      location: location || '',
      date: date ? new Date(date) : new Date(),
      rating: rating ? parseInt(rating) : 0,
      photoURL: photoURL || '',
      testimonial: testimonial || '',
      videoUrl: videoUrl || '',
      project: project || '',
      category: category || '',
      updatedAt: new Date(),
    };

    const result = await TestimonialCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: testimonialData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Testimonial not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Testimonial updated successfully',
      data: { _id: id, ...testimonialData },
    });
  } catch (error) {
    console.error('Error updating testimonial:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
});

// GET: Fetch all testimonials
router.get('/', async (req, res) => {
  try {
    const testimonials = await TestimonialCollection.find().toArray();
    res.status(200).json({
      success: true,
      count: testimonials.length,
      data: testimonials,
    });
  } catch (error) {
    console.error('Error fetching testimonials:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
});

// DELETE: Delete a testimonial by ID
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ID format',
      });
    }

    const result = await TestimonialCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Testimonial not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Testimonial deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting testimonial:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
});

module.exports = { router, setCollection };