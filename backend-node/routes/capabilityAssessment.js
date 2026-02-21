const express = require('express');
const router = express.Router();
const CapabilityAssessment = require('../models/CapabilityAssessment');
const Employee = require('../models/Employee');
const Department = require('../models/Department');
const { requireRole } = require('../config/roles');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/', requireRole(['Admin', 'HeadOfDepartment', 'HR', 'Trainer', 'Management', 'Employee']), asyncHandler(async (req, res) => {
  const list = await CapabilityAssessment.find()
    .populate('capabilityId', 'capabilityName capabilityDescription isGeneric')
    .sort({ createdAt: -1 })
    .lean();
  res.json({ success: true, data: list });
}));

router.get('/:id', requireRole(['Admin', 'HeadOfDepartment', 'HR', 'Trainer', 'Management', 'Employee']), asyncHandler(async (req, res) => {
  const doc = await CapabilityAssessment.findById(req.params.id)
    .populate('capabilityId', 'capabilityName capabilityDescription isGeneric')
    .lean();
  if (!doc) return res.status(404).json({ success: false, error: 'Capability assessment not found' });
  res.json({ success: true, data: doc });
}));

router.post('/', requireRole(['Admin', 'HeadOfDepartment']), asyncHandler(async (req, res) => {
  const {
    capabilityId,
    roleId,
    departmentId,
    departmentHead,
    managementLevel,
    requiredScore,
    maximumScore,
    scoreAchieved,
    mandatory,
    assessmentLink,
    trainingMandatoryAfterTest,
    createdBy,
  } = req.body || {};

  if (!capabilityId)
    return res.status(400).json({ success: false, error: 'Capability is required' });
  if (!roleId)
    return res.status(400).json({ success: false, error: 'role_id (employee) is required' });

  const emp = await Employee.findById(roleId).lean();
  if (!emp) return res.status(400).json({ success: false, error: 'Invalid role_id employee' });

  const derivedDept = String(departmentId || emp.department || '').trim();
  if (!derivedDept)
    return res.status(400).json({ success: false, error: 'Department is required' });
  if (requiredScore == null || maximumScore == null)
    return res.status(400).json({ success: false, error: 'Required score and maximum score are required' });

  const validLevels = [1, 2, 3, 4];
  if (managementLevel != null && !validLevels.includes(Number(managementLevel)))
    return res.status(400).json({ success: false, error: 'Management level must be 1, 2, 3, or 4' });

  // Auto-fill dept head if not provided
  let deptHeadValue = departmentHead ? String(departmentHead).trim() : '';
  if (!deptHeadValue && derivedDept) {
    const deptDoc = await Department.findOne({ department: derivedDept }).lean();
    deptHeadValue = String(deptDoc?.dept_head_email || '').trim();
  }

  const doc = await CapabilityAssessment.create({
    capabilityId,
    roleId: String(roleId),
    departmentId: derivedDept,
    departmentHead: deptHeadValue,
    managementLevel: managementLevel != null ? Number(managementLevel) : undefined,
    requiredScore: Number(requiredScore),
    maximumScore: Number(maximumScore),
    scoreAchieved: scoreAchieved != null && scoreAchieved !== '' ? Number(scoreAchieved) : undefined,
    mandatory: Boolean(mandatory),
    assessmentLink: String(assessmentLink || '').trim(),
    trainingMandatoryAfterTest: Boolean(trainingMandatoryAfterTest),
    createdBy: createdBy || null,
  });

  const populated = await CapabilityAssessment.findById(doc._id)
    .populate('capabilityId', 'capabilityName capabilityDescription isGeneric')
    .lean();
  res.status(201).json({ success: true, data: populated || doc });
}));

router.patch('/:id', requireRole(['Admin', 'HeadOfDepartment']), asyncHandler(async (req, res) => {
  const updates = {};

  if (req.body.capabilityId != null)             updates.capabilityId             = req.body.capabilityId;
  if (req.body.roleId != null)                   updates.roleId                   = String(req.body.roleId);
  if (req.body.departmentId != null)             updates.departmentId             = String(req.body.departmentId).trim();
  if (req.body.departmentHead != null)           updates.departmentHead           = String(req.body.departmentHead).trim();
  if (req.body.managementLevel != null) {
    const lvl = Number(req.body.managementLevel);
    if (![1, 2, 3, 4].includes(lvl))
      return res.status(400).json({ success: false, error: 'Management level must be 1, 2, 3, or 4' });
    updates.managementLevel = lvl;
  }
  if (req.body.requiredScore != null)            updates.requiredScore            = Number(req.body.requiredScore);
  if (req.body.maximumScore != null)             updates.maximumScore             = Number(req.body.maximumScore);
  if (req.body.scoreAchieved != null && req.body.scoreAchieved !== '')
                                                 updates.scoreAchieved            = Number(req.body.scoreAchieved);
  if (req.body.mandatory != null)                updates.mandatory                = Boolean(req.body.mandatory);
  if (req.body.assessmentLink != null)           updates.assessmentLink           = String(req.body.assessmentLink).trim();
  if (req.body.trainingMandatoryAfterTest != null)
                                                 updates.trainingMandatoryAfterTest = Boolean(req.body.trainingMandatoryAfterTest);

  // Re-derive departmentId if roleId changed and departmentId not provided
  if (updates.roleId != null && updates.departmentId == null) {
    const emp = await Employee.findById(updates.roleId).lean();
    if (!emp) return res.status(400).json({ success: false, error: 'Invalid role_id employee' });
    updates.departmentId = String(emp.department || '').trim();
  }

  // Re-derive department head if department changes and departmentHead not provided
  if (updates.departmentId != null && updates.departmentHead == null) {
    const deptDoc = await Department.findOne({ department: updates.departmentId }).lean();
    updates.departmentHead = String(deptDoc?.dept_head_email || '').trim();
  }

  const doc = await CapabilityAssessment.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true })
    .populate('capabilityId', 'capabilityName capabilityDescription isGeneric')
    .lean();

  if (!doc) return res.status(404).json({ success: false, error: 'Capability assessment not found' });
  res.json({ success: true, data: doc });
}));

router.delete('/:id', requireRole(['Admin', 'HeadOfDepartment']), asyncHandler(async (req, res) => {
  const doc = await CapabilityAssessment.findByIdAndDelete(req.params.id);
  if (!doc) return res.status(404).json({ success: false, error: 'Capability assessment not found' });
  res.json({ success: true });
}));

module.exports = router;