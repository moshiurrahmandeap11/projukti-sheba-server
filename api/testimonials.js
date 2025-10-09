const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');

let testimonialsCollection;

const setCollection = (db) => {
    testimonialsCollection = db.collection("testimonials");
}

// Get all testimonials
router.get('/', async (req, res) => {
    try {
        const testimonials = await testimonialsCollection.find({}).sort({ createdAt: -1 }).toArray();
        res.json({
            success: true,
            data: testimonials
        });
    } catch (error) {
        console.error('Error fetching testimonials:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch testimonials'
        });
    }
});

// Get testimonials by type - এই রাউটটি নিশ্চিত করুন
router.get('/type/:type', async (req, res) => {
    try {
        const { type } = req.params;
        
        // Validate type
        if (!['video', 'text'].includes(type)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid type. Must be "video" or "text"'
            });
        }

        const testimonials = await testimonialsCollection.find({ type }).sort({ createdAt: -1 }).toArray();
        
        res.json({
            success: true,
            data: testimonials
        });
    } catch (error) {
        console.error('Error fetching testimonials by type:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch testimonials'
        });
    }
});

// Create new testimonial
router.post('/', async (req, res) => {
    try {
        const {
            name,
            position,
            company,
            location,
            date,
            rating,
            category,
            project,
            photoURL,
            testimonial,
            videoUrl,
            type
        } = req.body;

        // Validation
        if (!name || !testimonial || !type) {
            return res.status(400).json({
                success: false,
                message: 'Name, testimonial, and type are required'
            });
        }

        if (!['video', 'text'].includes(type)) {
            return res.status(400).json({
                success: false,
                message: 'Type must be either "video" or "text"'
            });
        }

        const newTestimonial = {
            name: name.trim(),
            position: (position || '').trim(),
            company: (company || '').trim(),
            location: (location || '').trim(),
            date: date || new Date().toISOString(),
            rating: rating || 5,
            category: (category || '').trim(),
            project: (project || '').trim(),
            photoURL: (photoURL || '').trim(),
            testimonial: testimonial.trim(),
            videoUrl: (videoUrl || '').trim(),
            type: type,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await testimonialsCollection.insertOne(newTestimonial);

        res.status(201).json({
            success: true,
            message: 'Testimonial created successfully',
            data: { insertedId: result.insertedId }
        });
    } catch (error) {
        console.error('Error creating testimonial:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create testimonial'
        });
    }
});

// Update testimonial
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid testimonial ID'
            });
        }

        const allowedFields = [
            'name', 'position', 'company', 'location', 'date', 'rating',
            'category', 'project', 'photoURL', 'testimonial', 'videoUrl', 'type', 'updatedAt'
        ];
        
        const filteredUpdateData = {};
        allowedFields.forEach(field => {
            if (updateData[field] !== undefined) {
                if (typeof updateData[field] === 'string') {
                    filteredUpdateData[field] = updateData[field].trim();
                } else {
                    filteredUpdateData[field] = updateData[field];
                }
            }
        });

        filteredUpdateData.updatedAt = new Date();

        const result = await testimonialsCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: filteredUpdateData }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Testimonial not found'
            });
        }

        res.json({
            success: true,
            message: 'Testimonial updated successfully',
            data: result
        });
    } catch (error) {
        console.error('Error updating testimonial:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update testimonial'
        });
    }
});

// Delete testimonial
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid testimonial ID'
            });
        }

        const result = await testimonialsCollection.deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Testimonial not found'
            });
        }

        res.json({
            success: true,
            message: 'Testimonial deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting testimonial:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete testimonial'
        });
    }
});

module.exports = { router, setCollection };