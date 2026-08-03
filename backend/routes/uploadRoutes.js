const express = require('express');
const router = express.Router();
const upload = require('../middleware/uploadMiddleware');
const auth = require('../middleware/auth');

// POST /api/upload
// Endpoint for uploading a single file. The field name in form-data should be 'file'
router.post('/', auth, (req, res) => {
  upload.single('file')(req, res, function(err) {
    if (err) {
      console.error('Multer/Cloudinary error:', err);
      return res.status(400).json({ message: 'File upload error', error: err.message });
    }
    
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
      
      // req.file contains information about the uploaded file,
      // including the path (which is the Cloudinary secure URL when using multer-storage-cloudinary)
      const secureFileUrl = req.file.secure_url || (req.file.path ? req.file.path.replace('http://', 'https://') : '');
      res.status(200).json({
        message: 'File uploaded successfully',
        fileUrl: secureFileUrl,
        fileData: req.file
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      res.status(500).json({ message: 'Server error during file upload', error: error.message });
    }
  });
});

module.exports = router;
