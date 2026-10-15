const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadFileToDrive } = require('../utils/googleDrive');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Training content (PDF/video/assessment) — open to every role, same Drive
// upload convention as everywhere else (multer memoryStorage, no local disk
// write). makePublic:true since employees need to open these links without
// being logged into the Shared Drive.
const uploadTrainingContent = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB — training videos run larger than a resume/document
}).any();

router.post('/training-content', uploadTrainingContent, asyncHandler(async (req, res) => {
  const file = req.files?.[0];
  if (!file) return res.status(400).json({ success: false, error: 'No file was selected' });

  const folderId = process.env.GOOGLE_DRIVE_TRAINING_FOLDER_ID || process.env.GOOGLE_DRIVE_RESUME_FOLDER_ID;
  const url = await uploadFileToDrive(file.buffer, file.originalname, file.mimetype, folderId, { makePublic: true });

  res.json({ success: true, url });
}));

module.exports = router;
