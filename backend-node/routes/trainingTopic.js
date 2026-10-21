const express = require('express');
const router = express.Router();
const { requireRole } = require('../config/roles');
const TrainingTopic = require('../models/TrainingTopic');
const { sendMail } = require('../emails/mailer');
const buildTrainingApprovalRequest = require('../emails/templates/trainingApprovalRequest');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Training is open to every logged-in role — no requireRole gate except on
// the Management approve/reject/sendBack actions below.
// GET all training topics
router.get('/', asyncHandler(async (req, res) => {
  const { status } = req.query;
  const filter = status ? { status } : {};
  const topics = await TrainingTopic.find(filter).sort({ createdAt: -1 });
  res.json({ success: true, data: topics });
}));

// GET single training topic
router.get('/:id', asyncHandler(async (req, res) => {
  const topic = await TrainingTopic.findById(req.params.id);
  if (!topic) return res.status(404).json({ success: false, error: 'Training topic not found' });
  res.json({ success: true, data: topic });
}));

// POST create training topic
router.post('/', asyncHandler(async (req, res) => {
  const {
    trainingName, trainerName, capabilityArea, capabilitySkill,
    type, isGeneric, proposedScheduleDate, contentPdfLink, videoLink,
    assessmentLink, status, createdBy
  } = req.body || {};

  if (!trainingName?.trim()) return res.status(400).json({ success: false, error: 'Training name is required' });
  if (!trainerName?.trim()) return res.status(400).json({ success: false, error: 'Trainer name is required' });
  if (!capabilityArea?.trim()) return res.status(400).json({ success: false, error: 'Capability area is required' });
  if (!capabilitySkill?.trim()) return res.status(400).json({ success: false, error: 'Capability skill is required' });
  if (!type) return res.status(400).json({ success: false, error: 'Type is required' });
  if (!proposedScheduleDate) return res.status(400).json({ success: false, error: 'Proposed schedule date is required' });

  // 👇 Sequential numeric ID logic
  const lastTopic = await TrainingTopic
    .findOne({})
    .sort({ trainingId: -1 })
    .select('trainingId');

  const nextTrainingId = lastTopic ? lastTopic.trainingId + 1 : 1;

  const newTopic = await TrainingTopic.create({
    trainingId: nextTrainingId,
    trainingName: trainingName.trim(),
    trainerName: trainerName.trim(),
    capabilityArea: capabilityArea.trim(),
    capabilitySkill: capabilitySkill.trim(),
    type,
    isGeneric: Boolean(isGeneric),
    proposedScheduleDate,
    contentPdfLink: contentPdfLink?.trim() || '',
    videoLink: videoLink?.trim() || '',
    assessmentLink: assessmentLink?.trim() || '',
    status: status || 'Draft',
    createdBy: createdBy || req.headers['x-user-role'] || 'System',
  });

  res.status(201).json({ success: true, data: newTopic });
}));

// PATCH update training topic
router.patch('/:id', asyncHandler(async (req, res) => {
  const updates = req.body || {};
  const allowed = ['trainingName', 'trainerName', 'capabilityArea', 'capabilitySkill', 'type',
    'isGeneric', 'proposedScheduleDate', 'contentPdfLink', 'videoLink', 'assessmentLink', 'status'];
  const filtered = Object.fromEntries(Object.entries(updates).filter(([k]) => allowed.includes(k)));

  const updated = await TrainingTopic.findByIdAndUpdate(req.params.id, filtered, { new: true });
  if (!updated) return res.status(404).json({ success: false, error: 'Training topic not found' });
  res.json({ success: true, data: updated });
}));

// DELETE training topic
router.delete('/:id', asyncHandler(async (req, res) => {
  const deleted = await TrainingTopic.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ success: false, error: 'Training topic not found' });
  res.json({ success: true });
}));

// PATCH submit for approval
router.patch('/:id/submit-for-approval', asyncHandler(async (req, res) => {
  const topic = await TrainingTopic.findById(req.params.id);
  if (!topic) return res.status(404).json({ success: false, error: 'Training topic not found' });
  if (topic.status !== 'Draft') return res.status(400).json({ success: false, error: 'Only draft topics can be submitted for approval' });

  topic.status = 'Pending Approval';
  await topic.save();
  res.json({ success: true, data: topic });
}));

// POST approve
router.post('/:id/approve', requireRole(['Admin', 'Management']), asyncHandler(async (req, res) => {
  const topic = await TrainingTopic.findById(req.params.id);
  if (!topic) return res.status(404).json({ success: false, error: 'Training topic not found' });
  if (topic.status !== 'Pending Approval') return res.status(400).json({ success: false, error: 'Only pending approval topics can be approved' });

  topic.status = 'Approved';
  topic.managementRemark = req.body?.managementRemark?.trim() || '';
  topic.approvedBy = req.headers['x-user-role'] || 'Management';
  topic.approvedAt = new Date();
  await topic.save();
  res.json({ success: true, data: topic });
}));

// POST reject
router.post('/:id/reject', requireRole(['Admin', 'Management']), asyncHandler(async (req, res) => {
  const topic = await TrainingTopic.findById(req.params.id);
  if (!topic) return res.status(404).json({ success: false, error: 'Training topic not found' });
  if (topic.status !== 'Pending Approval') return res.status(400).json({ success: false, error: 'Only pending approval topics can be rejected' });

  const { managementRemark } = req.body || {};
  if (!managementRemark?.trim()) return res.status(400).json({ success: false, error: 'Management remark is required for rejection' });

  topic.status = 'Rejected';
  topic.managementRemark = managementRemark.trim();
  topic.approvedBy = req.headers['x-user-role'] || 'Management';
  topic.approvedAt = new Date();
  await topic.save();
  res.json({ success: true, data: topic });
}));

// POST send back
router.post('/:id/sendBack', requireRole(['Admin', 'Management']), asyncHandler(async (req, res) => {
  const topic = await TrainingTopic.findById(req.params.id);
  if (!topic) return res.status(404).json({ success: false, error: 'Training topic not found' });
  if (topic.status !== 'Pending Approval') return res.status(400).json({ success: false, error: 'Only pending approval topics can be sent back' });

  const { managementRemark } = req.body || {};
  if (!managementRemark?.trim()) return res.status(400).json({ success: false, error: 'Management remark is required for sending back' });

  topic.status = 'Sent Back';
  topic.managementRemark = managementRemark.trim();
  topic.approvedBy = req.headers['x-user-role'] || 'Management';
  topic.approvedAt = new Date();
  await topic.save();
  res.json({ success: true, data: topic });
}));

// ─────────────────────────────────────────────────────────────────────────────
// POST /approval-request/preview & /approval-request/send
// Manual, HR-triggered summary email to Management of every "Pending
// Approval" topic — rebuilt replacement for the old (disabled, broken)
// emailQuarterlyPlan.js cron job. Never fires on its own.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/approval-request/preview', asyncHandler(async (req, res) => {
  const topics = await TrainingTopic.find({ status: 'Pending Approval' }).sort({ createdAt: 1 }).lean();
  if (!topics.length) return res.status(400).json({ success: false, error: 'No topics are currently Pending Approval.' });

  const { subject, html } = buildTrainingApprovalRequest(topics);
  res.json({ success: true, data: { to: process.env.EMAIL_MANAGEMENT || '', cc: process.env.EMAIL_HR_TEAM || '', subject, body: html, topicCount: topics.length } });
}));

router.post('/approval-request/send', asyncHandler(async (req, res) => {
  const { to, cc, subject, customBody } = req.body || {};
  if (!to || !to.trim()) return res.status(400).json({ success: false, error: 'Recipient (To) is required' });
  if (!customBody) return res.status(400).json({ success: false, error: 'Email body is required' });

  await sendMail({
    from: `"Brisk Olive HR" <${process.env.GMAIL_USER}>`,
    to: to.trim(),
    cc: cc?.trim() || undefined,
    subject: subject || 'Training Plan – Approval Request',
    html: customBody,
  });

  res.json({ success: true });
}));

module.exports = router;