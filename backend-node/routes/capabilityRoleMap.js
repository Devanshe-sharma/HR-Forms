const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Capability = require('../models/Capability');
const CapabilityAssessment = require('../models/CapabilityAssessment');
const EmployeeScore = require('../models/EmployeeScore');
const { requireRole } = require('../config/roles');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// View only: capability_assessment (+ employee_scores later) → Capability, Department, Dept Head, Mgmt Level, Required/Achieved/Gap, Mandatory
router.get('/', requireRole(['Admin', 'HR', 'HeadOfDepartment', 'Trainer', 'Management', 'Employee']), asyncHandler(async (req, res) => {
  const assessments = await CapabilityAssessment.find()
    .populate('capabilityId', 'capabilityName capabilityDescription isGeneric')
    .lean();

  const rows = assessments.map(a => {
    const cap = a.capabilityId;
    const achieved = a.scoreAchieved != null ? Number(a.scoreAchieved) : null;
    const required = a.requiredScore != null ? Number(a.requiredScore) : 0;
    const gap = achieved == null ? null : Math.max(0, required - achieved);
    return {
      _id: a._id,
      capability: cap?.capabilityName || '',
      capabilityId: a.capabilityId?._id || a.capabilityId,
      roleId: a.roleId,
      roleName: '',
      department: a.departmentId,
      deptHead: a.departmentHead || '',
      managementLevel: a.managementLevel ?? null,
      requiredScore: a.requiredScore,
      maximumScore: a.maximumScore,
      achievedScore: achieved,
      gap,
      mandatory: a.mandatory,
      trainingRequired: a.mandatory ? 'Yes' : 'No',
    };
  });

  res.json({ success: true, data: rows });
}));

module.exports = router;
