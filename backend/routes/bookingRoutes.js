const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const auth = require('../middleware/auth');
const upload = require('../middleware/uploadMiddleware');

// Custom file middleware to accept screenshot or file field names
const handleScreenshotUpload = (req, res, next) => {
  upload.fields([
    { name: 'screenshot', maxCount: 1 },
    { name: 'file', maxCount: 1 }
  ])(req, res, (err) => {
    if (err) {
      console.error('File upload middleware error:', err);
      return res.status(400).json({ success: false, error: err.message || 'File upload failed' });
    }
    if (req.files) {
      req.file = (req.files.screenshot && req.files.screenshot[0]) || (req.files.file && req.files.file[0]) || null;
    }
    next();
  });
};

// POST /api/bookings - Create booking
router.post('/', auth, handleScreenshotUpload, bookingController.createBooking);

// GET /api/bookings/:id - Load booking by ID or bookingId
router.get('/:id', auth, bookingController.getBookingById);

// PUT /api/bookings/:id/edit - Edit booking
router.put('/:id/edit', auth, handleScreenshotUpload, bookingController.editBooking);

module.exports = router;
