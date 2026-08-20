const multer = require('multer');
const { ALLOWED_AVATAR_MIME_TYPES, MAX_AVATAR_FILE_SIZE_BYTES } = require('../helpers/userAvatar');

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_FILES_PER_REQUEST = 3;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const MAX_LOGO_FILE_SIZE_BYTES = 1 * 1024 * 1024;
const ALLOWED_LOGO_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml']);

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

// Logo
const logoFileFilter = (req, file, cb) => {
  if (!file || !ALLOWED_LOGO_MIME_TYPES.has(file.mimetype)) {
    return cb(new Error('Only JPG, PNG, GIF, and SVG logos are allowed.'));
  }

  cb(null, true);
};

const uploadLogoMulter = multer({
  storage,
  fileFilter: logoFileFilter,
  limits: {
    fileSize: MAX_LOGO_FILE_SIZE_BYTES,
    files: 1,
  },
});

const uploadLogoRaw = uploadLogoMulter.single('logo');

const uploadLogo = (req, res, next) => {
  uploadLogoRaw(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'Workspace logo must be 1MB or smaller.',
        });
      }

      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          success: false,
          message: 'Use "logo" as the upload field name.',
        });
      }
    }

    return res.status(400).json({
      success: false,
      message: err.message || 'Invalid logo upload request.',
    });
  });
};

const MAX_CV_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_CV_MIME_TYPES = new Set(['application/pdf']);

const cvFileFilter = (req, file, cb) => {
  if (!file || !ALLOWED_CV_MIME_TYPES.has(file.mimetype)) {
    return cb(new Error('Only PDF files are allowed for CV upload.'));
  }
  cb(null, true);
};

const uploadCvMulter = multer({
  storage,
  fileFilter: cvFileFilter,
  limits: {
    fileSize: MAX_CV_FILE_SIZE_BYTES,
    files: 1,
  },
});

const uploadCvRaw = uploadCvMulter.single('cv');

const uploadCv = (req, res, next) => {
  uploadCvRaw(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'CV must be 5MB or smaller.',
        });
      }

      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          success: false,
          message: 'Use "cv" as the upload field name.',
        });
      }
    }

    return res.status(400).json({
      success: false,
      message: err.message || 'Invalid CV upload request.',
    });
  });
};

// Avatar
//
// The allowed set and the size cap live in `helpers/userAvatar.js` rather than
// here, because they are rules worth unit-testing and this file cannot be
// required without multer. Note it does *not* reuse ALLOWED_LOGO_MIME_TYPES:
// that set permits SVG, and a profile picture is uploaded by every role and
// served from a public bucket. See the helper.
const avatarFileFilter = (req, file, cb) => {
  if (!file || !ALLOWED_AVATAR_MIME_TYPES.has(file.mimetype)) {
    return cb(new Error('Profile picture must be a JPG, PNG, or WEBP image.'));
  }

  cb(null, true);
};

const uploadAvatarMulter = multer({
  storage,
  fileFilter: avatarFileFilter,
  limits: {
    fileSize: MAX_AVATAR_FILE_SIZE_BYTES,
    files: 1,
  },
});

const uploadAvatarRaw = uploadAvatarMulter.single('avatar');

const uploadAvatar = (req, res, next) => {
  uploadAvatarRaw(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'Profile picture must be 2MB or smaller.',
        });
      }

      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          success: false,
          message: 'Use "avatar" as the upload field name.',
        });
      }
    }

    return res.status(400).json({
      success: false,
      message: err.message || 'Invalid profile picture upload request.',
    });
  });
};

module.exports = {
  uploadImages,
  uploadLogo,
  uploadCv,
  uploadAvatar,
  MAX_FILE_SIZE_BYTES,
  MAX_FILES_PER_REQUEST,
  ALLOWED_MIME_TYPES,
  MAX_LOGO_FILE_SIZE_BYTES,
  ALLOWED_LOGO_MIME_TYPES,
  MAX_CV_FILE_SIZE_BYTES,
  ALLOWED_CV_MIME_TYPES,
};
