const express = require('express');
const router = express.Router();
const { requireRole } = require('../config/roles');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// In-memory storage for training topics (replace with actual model later)
let trainingTopics = [];

// GET all training topics
router.get('/', requireRole(['Admin', 'HR', 'Management', 'HeadOfDepartment']), asyncHandler(async (req, res) => {
  const { status } = req.query;
  let filteredTopics = trainingTopics;
  
  if (status) {
    filteredTopics = trainingTopics.filter(topic => topic.status === status);
  }
  
  res.json({ success: true, data: filteredTopics });
}));

// GET single training topic
router.get('/:id', requireRole(['Admin', 'HR', 'Management', 'HeadOfDepartment']), asyncHandler(async (req, res) => {
  const topic = trainingTopics.find(t => t._id === req.params.id);
  if (!topic) return res.status(404).json({ success: false, error: 'Training topic not found' });
  res.json({ success: true, data: topic });
}));

// POST create training topic
router.post('/', requireRole(['Admin', 'HR', 'HeadOfDepartment']), asyncHandler(async (req, res) => {
  const { 
    trainingId, 
    trainingName, 
    trainerName, 
    capabilityArea, 
    capabilitySkill, 
    type, 
    isGeneric, 
    proposedScheduleDate, 
    contentPdfLink, 
    videoLink, 
    assessmentLink, 
    status,
    createdBy 
  } = req.body || {};
  
  if (!trainingName || !String(trainingName).trim()) {
    return res.status(400).json({ success: false, error: 'Training name is required' });
  }
  if (!trainerName || !String(trainerName).trim()) {
    return res.status(400).json({ success: false, error: 'Trainer name is required' });
  }
  if (!capabilityArea || !String(capabilityArea).trim()) {
    return res.status(400).json({ success: false, error: 'Capability area is required' });
  }
  if (!capabilitySkill || !String(capabilitySkill).trim()) {
    return res.status(400).json({ success: false, error: 'Capability skill is required' });
  }
  if (!type) {
    return res.status(400).json({ success: false, error: 'Type is required' });
  }
  if (!proposedScheduleDate) {
    return res.status(400).json({ success: false, error: 'Proposed schedule date is required' });
  }
  
  const newTopic = {
    _id: Date.now().toString(),
    trainingId: trainingId || 'TR' + Date.now().toString().slice(-8),
    trainingName: String(trainingName).trim(),
    trainerName: String(trainerName).trim(),
    capabilityArea: String(capabilityArea).trim(),
    capabilitySkill: String(capabilitySkill).trim(),
    type: String(type),
    isGeneric: Boolean(isGeneric),
    proposedScheduleDate: String(proposedScheduleDate),
    contentPdfLink: String(contentPdfLink || '').trim(),
    videoLink: String(videoLink || '').trim(),
    assessmentLink: String(assessmentLink || '').trim(),
    status: String(status || 'Draft'),
    createdAt: new Date().toISOString(),
    createdBy: createdBy || 'System',
  };
  
  trainingTopics.push(newTopic);
  res.status(201).json({ success: true, data: newTopic });
}));

// PATCH update training topic
router.patch('/:id', requireRole(['Admin', 'HR', 'HeadOfDepartment']), asyncHandler(async (req, res) => {
  const index = trainingTopics.findIndex(t => t._id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, error: 'Training topic not found' });
  
  const updates = req.body || {};
  trainingTopics[index] = {
    ...trainingTopics[index],
    ...(updates.trainingName && { trainingName: String(updates.trainingName).trim() }),
    ...(updates.trainerName && { trainerName: String(updates.trainerName).trim() }),
    ...(updates.capabilityArea && { capabilityArea: String(updates.capabilityArea).trim() }),
    ...(updates.capabilitySkill && { capabilitySkill: String(updates.capabilitySkill).trim() }),
    ...(updates.type && { type: String(updates.type) }),
    ...(updates.isGeneric !== undefined && { isGeneric: Boolean(updates.isGeneric) }),
    ...(updates.proposedScheduleDate && { proposedScheduleDate: String(updates.proposedScheduleDate) }),
    ...(updates.contentPdfLink !== undefined && { contentPdfLink: String(updates.contentPdfLink || '').trim() }),
    ...(updates.videoLink !== undefined && { videoLink: String(updates.videoLink || '').trim() }),
    ...(updates.assessmentLink !== undefined && { assessmentLink: String(updates.assessmentLink || '').trim() }),
    ...(updates.status && { status: String(updates.status) }),
  };
  
  res.json({ success: true, data: trainingTopics[index] });
}));

// DELETE training topic
router.delete('/:id', requireRole(['Admin', 'HR']), asyncHandler(async (req, res) => {
  const index = trainingTopics.findIndex(t => t._id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, error: 'Training topic not found' });
  
  trainingTopics.splice(index, 1);
  res.json({ success: true });
}));

// POST submit for approval
router.patch('/:id/submit-for-approval', requireRole(['Admin', 'HR', 'HeadOfDepartment']), asyncHandler(async (req, res) => {
  const index = trainingTopics.findIndex(t => t._id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, error: 'Training topic not found' });
  
  if (trainingTopics[index].status !== 'Draft') {
    return res.status(400).json({ success: false, error: 'Only draft topics can be submitted for approval' });
  }
  
  trainingTopics[index].status = 'Pending Approval';
  res.json({ success: true, data: trainingTopics[index] });
}));

// POST approve training topic
router.post('/:id/approve', requireRole(['Admin', 'Management']), asyncHandler(async (req, res) => {
  const index = trainingTopics.findIndex(t => t._id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, error: 'Training topic not found' });
  
  if (trainingTopics[index].status !== 'Pending Approval') {
    return res.status(400).json({ success: false, error: 'Only pending approval topics can be approved' });
  }
  
  const { managementRemark } = req.body || {};
  trainingTopics[index].status = 'Approved';
  trainingTopics[index].managementRemark = String(managementRemark || '').trim();
  trainingTopics[index].approvedBy = 'Management'; // Replace with actual user
  trainingTopics[index].approvedAt = new Date().toISOString();
  
  res.json({ success: true, data: trainingTopics[index] });
}));

// POST reject training topic
router.post('/:id/reject', requireRole(['Admin', 'Management']), asyncHandler(async (req, res) => {
  const index = trainingTopics.findIndex(t => t._id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, error: 'Training topic not found' });
  
  if (trainingTopics[index].status !== 'Pending Approval') {
    return res.status(400).json({ success: false, error: 'Only pending approval topics can be rejected' });
  }
  
  const { managementRemark } = req.body || {};
  if (!managementRemark || !String(managementRemark).trim()) {
    return res.status(400).json({ success: false, error: 'Management remark is required for rejection' });
  }
  
  trainingTopics[index].status = 'Rejected';
  trainingTopics[index].managementRemark = String(managementRemark).trim();
  trainingTopics[index].approvedBy = 'Management'; // Replace with actual user
  trainingTopics[index].approvedAt = new Date().toISOString();
  
  res.json({ success: true, data: trainingTopics[index] });
}));

// POST send back training topic
router.post('/:id/sendBack', requireRole(['Admin', 'Management']), asyncHandler(async (req, res) => {
  const index = trainingTopics.findIndex(t => t._id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, error: 'Training topic not found' });
  
  if (trainingTopics[index].status !== 'Pending Approval') {
    return res.status(400).json({ success: false, error: 'Only pending approval topics can be sent back' });
  }
  
  const { managementRemark } = req.body || {};
  if (!managementRemark || !String(managementRemark).trim()) {
    return res.status(400).json({ success: false, error: 'Management remark is required for sending back' });
  }
  
  trainingTopics[index].status = 'Sent Back';
  trainingTopics[index].managementRemark = String(managementRemark).trim();
  trainingTopics[index].approvedBy = 'Management'; // Replace with actual user
  trainingTopics[index].approvedAt = new Date().toISOString();
  
  res.json({ success: true, data: trainingTopics[index] });
}));

module.exports = router;
