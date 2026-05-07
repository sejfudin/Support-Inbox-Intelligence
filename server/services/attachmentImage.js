const crypto = require('crypto');
const mongoose = require('mongoose');
const Ticket = require('../models/Ticket');
const Comment = require('../models/Comment');
const attachmentImageRepo = require('../repository/attachmentImage');
const { supabase, supabaseBucket } = require('../config/supabase');
const { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } = require('../middleware/upload');

const ENTITY_TYPES = {
  TICKET_DESCRIPTION: 'ticket_description',
  COMMENT: 'comment',
};

const MIME_TO_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const SIGNED_URL_EXPIRES_IN_SECONDS = 60 * 60; // 1h

const makeError = (message, statusCode = 400) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const parseImageId = (imageId) => {
  const n = Number(imageId);
  if (!Number.isInteger(n) || n <= 0) throw makeError('Invalid image id.', 400);
  return n;
};

const isBucketPublic = () =>
  String(process.env.SUPABASE_BUCKET_VISIBILITY || 'private').toLowerCase() === 'public';

const buildUniqueFileName = (mimeType) => {
  const ext = MIME_TO_EXT[mimeType];
  if (!ext) throw makeError('Unsupported image type.', 400);

  const ts = Date.now();
  const rand = crypto.randomBytes(6).toString('hex');
  return `${ts}-${rand}.${ext}`;
};

const buildImagePath = (entityType, entityId, fileName) => {
  if (entityType === ENTITY_TYPES.TICKET_DESCRIPTION) {
    return `attachments/ticket-descriptions/${entityId}/${fileName}`;
  }

  if (entityType === ENTITY_TYPES.COMMENT) {
    return `attachments/comments/${entityId}/${fileName}`;
  }

  throw makeError('Invalid attachment entity type.', 400);
};

const buildImageUrl = async (imagePath) => {
  if (isBucketPublic()) {
    const { data } = supabase.storage.from(supabaseBucket).getPublicUrl(imagePath);
    return data?.publicUrl || null;
  }

  const { data, error } = await supabase.storage
    .from(supabaseBucket)
    .createSignedUrl(imagePath, SIGNED_URL_EXPIRES_IN_SECONDS);

  if (error) throw error;
  return data?.signedUrl || null;
};

const mapRowsWithImageUrl = async (rows) => {
  return Promise.all(
    (rows || []).map(async (row) => ({
      ...row,
      image_url: await buildImageUrl(row.image_path),
    }))
  );
};

const normalizeSupabaseError = (error) => {
  const msg = String(error?.message || '').toLowerCase();

  if (error?.code === '23514') {
    return makeError('Invalid image metadata (mime type or file size).', 400);
  }

  if (error?.code === '23505') {
    return makeError('Duplicate image path. Please retry upload.', 409);
  }

  if (msg.includes('maximum 3 images are allowed')) {
    return makeError('Maximum 3 images are allowed per user per item.', 400);
  }

  return error;
};

const verifyEntityExists = async (entityType, entityId, { allowArchivedRead = false } = {}) => {
  if (!isValidObjectId(entityId)) {
    throw makeError('Invalid entity id.', 400);
  }

  if (entityType === ENTITY_TYPES.TICKET_DESCRIPTION) {
    const ticket = await Ticket.findById(entityId).select('_id isArchived');
    if (!ticket) throw makeError('Ticket not found.', 404);

    if (!allowArchivedRead && ticket.isArchived) {
      throw makeError('Cannot manage images for archived ticket.', 403);
    }
    return;
  }

  if (entityType === ENTITY_TYPES.COMMENT) {
    const comment = await Comment.findById(entityId).select('_id isDeleted ticket');
    if (!comment) throw makeError('Comment not found.', 404);

    const ticket = await Ticket.findById(comment.ticket).select('_id isArchived');
    if (!ticket) throw makeError('Ticket not found for comment.', 404);

    if (!allowArchivedRead) {
      if (comment.isDeleted) throw makeError('Cannot manage images for deleted comment.', 403);
      if (ticket.isArchived) throw makeError('Cannot manage images on archived ticket.', 403);
    }
    return;
  }

  throw makeError('Invalid attachment entity type.', 400);
};

const removeStoragePaths = async (paths) => {
  if (!paths || paths.length === 0) return;

  const { error } = await supabase.storage.from(supabaseBucket).remove(paths);
  if (error) throw error;
};

const validateFiles = (files) => {
  if (!files || files.length === 0) {
    throw makeError('At least one image is required.', 400);
  }

  for (const file of files) {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw makeError('Only JPG, PNG, and WEBP images are allowed.', 400);
    }
    if (!file.size || file.size > MAX_FILE_SIZE_BYTES) {
      throw makeError('Each image must be 5MB or smaller.', 400);
    }
  }
};

const getEntityImages = async ({ entityType, entityId }) => {
  await verifyEntityExists(entityType, entityId, { allowArchivedRead: true });
  const rows = await attachmentImageRepo.findByEntity(entityType, entityId);
  return mapRowsWithImageUrl(rows);
};

const uploadEntityImages = async ({ entityType, entityId, files, uploadedByUserId }) => {
  await verifyEntityExists(entityType, entityId, { allowArchivedRead: false });

  if (!isValidObjectId(uploadedByUserId)) {
    throw makeError('Invalid authenticated user id.', 400);
  }

  validateFiles(files);

  const currentCount = await attachmentImageRepo.countByUserAndEntity(
    uploadedByUserId,
    entityType,
    entityId
  );

  if (currentCount + files.length > 3) {
    throw makeError('Maximum 3 images are allowed per user per item.', 400);
  }

  const uploadedPaths = [];
  const rowsToInsert = [];

  try {
    for (const file of files) {
      const fileName = buildUniqueFileName(file.mimetype);
      const imagePath = buildImagePath(entityType, entityId, fileName);

      const { error: uploadError } = await supabase.storage
        .from(supabaseBucket)
        .upload(imagePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      uploadedPaths.push(imagePath);

      rowsToInsert.push({
        entity_type: entityType,
        entity_id: entityId,
        uploaded_by_user_id: uploadedByUserId,
        image_path: imagePath,
        original_file_name: file.originalname || null,
        mime_type: file.mimetype,
        file_size: file.size,
      });
    }

    const insertedRows = await attachmentImageRepo.createMany(rowsToInsert);
    return await mapRowsWithImageUrl(insertedRows);
  } catch (error) {
    try {
      await removeStoragePaths(uploadedPaths);
    } catch (cleanupError) {
      console.error('[attachmentImageService] cleanup upload failure:', cleanupError.message);
    }

    throw normalizeSupabaseError(error);
  }
};

const deleteEntityImage = async ({ entityType, entityId, imageId }) => {
  await verifyEntityExists(entityType, entityId, { allowArchivedRead: false });

  const parsedImageId = parseImageId(imageId);

  const row = await attachmentImageRepo.findByIdForEntity(parsedImageId, entityType, entityId);
  if (!row) throw makeError('Image not found.', 404);

  const imagePath = row.image_path;

  const { error: storageError } = await supabase.storage.from(supabaseBucket).remove([imagePath]);
  if (storageError) throw normalizeSupabaseError(storageError);

  try {
    await attachmentImageRepo.deleteById(parsedImageId, entityType, entityId);
  } catch (dbError) {
    console.error('[attachmentImageService] metadata delete failed:', {
      imageId: parsedImageId,
      imagePath,
      entityType,
      entityId,
      message: dbError.message,
    });
    throw makeError('Image file was deleted, but metadata delete failed.', 500);
  }

  return { success: true };
};

const deleteAllEntityImages = async ({ entityType, entityId }) => {
  await verifyEntityExists(entityType, entityId, { allowArchivedRead: false });

  const rows = await attachmentImageRepo.findByEntity(entityType, entityId);
  if (rows.length === 0) return { success: true };

  const paths = rows.map((r) => r.image_path);

  const { error: storageError } = await supabase.storage.from(supabaseBucket).remove(paths);
  if (storageError) throw normalizeSupabaseError(storageError);

  try {
    await attachmentImageRepo.deleteByEntity(entityType, entityId);
  } catch (dbError) {
    console.error('[attachmentImageService] bulk metadata delete failed:', {
      entityType,
      entityId,
      paths,
      message: dbError.message,
    });
    throw makeError('Files were deleted, but metadata delete failed.', 500);
  }

  return { success: true };
};

module.exports = {
  ENTITY_TYPES,
  getEntityImages,
  uploadEntityImages,
  deleteEntityImage,
  deleteAllEntityImages,
};
