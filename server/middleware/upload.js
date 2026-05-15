const multer = require('multer');

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_FILES_PER_REQUEST = 3;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (!file || !ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return cb(new Error('Only JPG, PNG, and WEBP images are allowed.'));
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: MAX_FILES_PER_REQUEST,
  },
});

const uploadImagesRaw = upload.array('images', MAX_FILES_PER_REQUEST);

const uploadImages = (req, res, next) => {
  uploadImagesRaw(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'Each image must be 5MB or smaller.',
        });
      }

      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
          success: false,
          message: 'You can upload up to 3 images per request.',
        });
      }

      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          success: false,
          message: 'Use "images" as the upload field name.',
        });
      }
    }

    return res.status(400).json({
      success: false,
      message: err.message || 'Invalid image upload request.',
    });
  });
};

module.exports = {
  uploadImages,
  MAX_FILE_SIZE_BYTES,
  MAX_FILES_PER_REQUEST,
  ALLOWED_MIME_TYPES,
};
