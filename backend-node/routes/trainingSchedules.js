const express = require('express');
const router = express.Router();
const { requireRole } = require('../config/roles');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// In-memory storage for training schedules (replace with actual model later)
let trainingSchedules = [];

// GET all training schedules
router.get('/', requireRole(['Admin', 'HR', 'Management', 'HeadOfDepartment', 'Trainer', 'Employee']), asyncHandler(async (req, res) => {
  const { trainerId, employeeId } = req.query;
  let filteredSchedules = trainingSchedules;
  
  if (trainerId) {
    filteredSchedules = trainingSchedules.filter(schedule => schedule.trainerId === trainerId);
  }
  
  if (employeeId) {
    filteredSchedules = trainingSchedules.filter(schedule => 
      schedule.targetAudience.type === 'all' || 
      (schedule.targetAudience.departments && schedule.targetAudience.departments.includes(employeeId))
    );
  }
  
  res.json({ success: true, data: filteredSchedules });
}));

// GET single training schedule
router.get('/:id', requireRole(['Admin', 'HR', 'Management', 'HeadOfDepartment', 'Trainer', 'Employee']), asyncHandler(async (req, res) => {
  const schedule = trainingSchedules.find(s => s._id === req.params.id);
  if (!schedule) return res.status(404).json({ success: false, error: 'Training schedule not found' });
  res.json({ success: true, data: schedule });
}));

// POST create training schedule
router.post('/', requireRole(['Admin', 'HR']), asyncHandler(async (req, res) => {
  const { 
    trainingId,
    trainingName,
    capabilityArea,
    capabilitySkill,
    trainerName,
    type,
    trainingDate,
    startTime,
    endTime,
    venue,
    onlineLink,
    targetAudience,
    attendanceRequired,
    maxAttempts,
    feedbackWindow,
    createdBy
  } = req.body || {};
  
  if (!trainingName || !String(trainingName).trim()) {
    return res.status(400).json({ success: false, error: 'Training name is required' });
  }
  if (!trainingDate) {
    return res.status(400).json({ success: false, error: 'Training date is required' });
  }
  if (!startTime) {
    return res.status(400).json({ success: false, error: 'Start time is required' });
  }
  if (!endTime) {
    return res.status(400).json({ success: false, error: 'End time is required' });
  }
  if (!venue && !onlineLink) {
    return res.status(400).json({ success: false, error: 'Either venue or online link is required' });
  }
  if (!targetAudience || !targetAudience.type) {
    return res.status(400).json({ success: false, error: 'Target audience is required' });
  }
  
  const newSchedule = {
    _id: Date.now().toString(),
    trainingId: String(trainingId || ''),
    trainingName: String(trainingName).trim(),
    capabilityArea: String(capabilityArea || ''),
    capabilitySkill: String(capabilitySkill || ''),
    trainerName: String(trainerName || '').trim(),
    type: String(type || 'Generic'),
    trainingDate: String(trainingDate),
    startTime: String(startTime),
    endTime: String(endTime),
    venue: String(venue || '').trim(),
    onlineLink: String(onlineLink || '').trim(),
    targetAudience: {
      type: String(targetAudience.type),
      departments: targetAudience.departments || [],
      levels: targetAudience.levels || [],
      roles: targetAudience.roles || [],
    },
    attendanceRequired: Boolean(attendanceRequired !== false),
    maxAttempts: Number(maxAttempts) || 2,
    feedbackWindow: Number(feedbackWindow) || 5,
    status: 'Scheduled',
    createdAt: new Date().toISOString(),
    createdBy: createdBy || 'System',
  };
  
  trainingSchedules.push(newSchedule);
  res.status(201).json({ success: true, data: newSchedule });
}));

// PATCH update training schedule
router.patch('/:id', requireRole(['Admin', 'HR']), asyncHandler(async (req, res) => {
  const index = trainingSchedules.findIndex(s => s._id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, error: 'Training schedule not found' });
  
  const updates = req.body || {};
  trainingSchedules[index] = {
    ...trainingSchedules[index],
    ...(updates.trainingName && { trainingName: String(updates.trainingName).trim() }),
    ...(updates.capabilityArea && { capabilityArea: String(updates.capabilityArea).trim() }),
    ...(updates.capabilitySkill && { capabilitySkill: String(updates.capabilitySkill).trim() }),
    ...(updates.trainerName && { trainerName: String(updates.trainerName).trim() }),
    ...(updates.type && { type: String(updates.type) }),
    ...(updates.trainingDate && { trainingDate: String(updates.trainingDate) }),
    ...(updates.startTime && { startTime: String(updates.startTime) }),
    ...(updates.endTime && { endTime: String(updates.endTime) }),
    ...(updates.venue !== undefined && { venue: String(updates.venue || '').trim() }),
    ...(updates.onlineLink !== undefined && { onlineLink: String(updates.onlineLink || '').trim() }),
    ...(updates.targetAudience && { targetAudience: updates.targetAudience }),
    ...(updates.attendanceRequired !== undefined && { attendanceRequired: Boolean(updates.attendanceRequired) }),
    ...(updates.maxAttempts && { maxAttempts: Number(updates.maxAttempts) }),
    ...(updates.feedbackWindow && { feedbackWindow: Number(updates.feedbackWindow) }),
  };
  
  res.json({ success: true, data: trainingSchedules[index] });
}));

// DELETE training schedule
router.delete('/:id', requireRole(['Admin', 'HR']), asyncHandler(async (req, res) => {
  const index = trainingSchedules.findIndex(s => s._id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, error: 'Training schedule not found' });
  
  trainingSchedules.splice(index, 1);
  res.json({ success: true });
}));

// PATCH update schedule status
router.patch('/:id/status', requireRole(['Admin', 'HR']), asyncHandler(async (req, res) => {
  const index = trainingSchedules.findIndex(s => s._id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, error: 'Training schedule not found' });
  
  const { status } = req.body || {};
  if (!status) {
    return res.status(400).json({ success: false, error: 'Status is required' });
  }
  
  const validStatuses = ['Scheduled', 'Rescheduled', 'Cancelled', 'Completed'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, error: 'Invalid status' });
  }
  
  trainingSchedules[index].status = String(status);
  res.json({ success: true, data: trainingSchedules[index] });
}));

// GET pending schedules (for management approval)
router.get('/pending', requireRole(['Admin', 'Management']), asyncHandler(async (req, res) => {
  const pendingSchedules = trainingSchedules.filter(schedule => 
    schedule.status === 'Pending Approval' || schedule.status === 'Pending'
  );
  res.json({ success: true, data: pendingSchedules });
}));

module.exports = router;
