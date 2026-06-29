const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    // Extract extension
    const dotIndex = file.originalname.lastIndexOf('.');
    const ext = dotIndex !== -1 ? file.originalname.substring(dotIndex).toLowerCase() : '';
    const originalName = dotIndex !== -1 ? file.originalname.substring(0, dotIndex) : file.originalname;

    // Sanitize and generate unique suffix
    const sanitized = originalName.replace(/[^a-zA-Z0-9-_]/g, '_');
    const uniqueSuffix = Math.random().toString(36).substring(2, 8);

    // Explicitly define if it is an image or raw document
    const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);

    // For raw files (like .docx, .pdf), Cloudinary requires the extension in the public_id to preserve it
    const publicId = isImage 
      ? `${sanitized}_${uniqueSuffix}` 
      : `${sanitized}_${uniqueSuffix}${ext}`;

    return {
      folder: 'crm_attachments',
      resource_type: 'auto', // Fix: Use 'auto' so Cloudinary correctly handles images, PDFs, and raw files
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx'], // explicitly pass formats to avoid strict configuration rejections
      public_id: publicId
    };
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx', 'webp'];
    const dotIndex = file.originalname.lastIndexOf('.');
    const ext = dotIndex !== -1 ? file.originalname.substring(dotIndex + 1).toLowerCase() : '';
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File format .${ext || 'unknown'} is not allowed. Allowed formats: ${allowedExtensions.join(', ')}`), false);
    }
  }
});

module.exports = upload;

