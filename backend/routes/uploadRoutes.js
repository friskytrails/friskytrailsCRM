const express = require('express');
const router = express.Router();
const upload = require('../middleware/uploadMiddleware');
const auth = require('../middleware/auth');

const cloudinary = require('../config/cloudinary');

// GET /api/upload/signature
// Returns signed credentials for direct client-to-Cloudinary upload
router.get('/signature', auth, (req, res) => {
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = 'crm_attachments';
    const publicId = req.query.public_id;

    const { CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;

    if (!CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
      return res.status(500).json({ message: 'Cloudinary configuration missing on backend' });
    }

    const paramsToSign = {
      timestamp: timestamp,
      folder: folder
    };

    if (publicId) {
      paramsToSign.public_id = publicId;
    }

    const signature = cloudinary.utils.api_sign_request(paramsToSign, CLOUDINARY_API_SECRET);

    res.status(200).json({
      timestamp,
      signature,
      apiKey: CLOUDINARY_API_KEY,
      cloudName: CLOUD_NAME,
      folder,
      publicId
    });
  } catch (error) {
    console.error('Error generating Cloudinary upload signature:', error);
    res.status(500).json({ message: 'Error generating upload signature', error: error.message });
  }
});

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
