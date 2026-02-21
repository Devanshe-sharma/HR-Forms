const express = require('express');
const router = express.Router();
const EmployeeScore = require('../models/EmployeeScore');
const Employee = require('../models/Employee');
const TrainingSchedule = require('../models/TrainingSchedule');
const { requireRole } = require('../config/roles');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/employees', requireRole(['Admin', 'Management']), asyncHandler(async (req, res) => {
  const employees = await Employee.find()
    .select('_id employee_id full_name department designation level')
    .sort({ full_name: 1 })
    .lean();
  res.json({ success: true, data: employees });
}));

router.get('/employee/:employeeId', requireRole(['Admin', 'Management']), asyncHandler(async (req, res) => {
  const { employeeId } = req.params;
  const emp = await Employee.findById(employeeId).lean();
  if (!emp) return res.status(404).json({ success: false, error: 'Employee not found' });

  const scores = await EmployeeScore.find({ employeeId })
    .populate('trainingScheduleId')
    .populate('capabilityId', 'capabilityName')
    .sort({ evaluatedAt: -1 })
    .lean();

  const bySchedule = {};
  let totalScore = 0;
  let totalMax = 0;
  let completed = 0;
  for (const s of scores) {
    const sid = s.trainingScheduleId?._id?.toString() || s.trainingScheduleId?.toString();
    if (!sid) continue;
    if (!bySchedule[sid]) {
      bySchedule[sid] = { trainingScheduleId: s.trainingScheduleId, rows: [], scoreSum: 0, maxSum: 0 };
    }
    bySchedule[sid].rows.push({
      capabilityId: s.capabilityId,
      capabilityName: s.capabilityId?.capabilityName,
      scoreObtained: s.scoreObtained,
      maxScore: s.maxScore,
      percentage: s.percentage,
      status: s.status,
      evaluatedAt: s.evaluatedAt,
    });
    bySchedule[sid].scoreSum += s.scoreObtained || 0;
    bySchedule[sid].maxSum += s.maxScore || 0;
    totalScore += s.scoreObtained || 0;
    totalMax += s.maxScore || 0;
    completed++;
  }

  const rows = Object.entries(bySchedule).map(([sid, v]) => ({
    trainingScheduleId: sid,
    training: v.trainingScheduleId,
    scorePerTraining: v.rows,
    averageScore: v.maxSum > 0 ? Math.round((v.scoreSum / v.maxSum) * 100) : 0,
  }));

  const avgScore = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;

  res.json({
    success: true,
    data: {
      employee: emp,
      rows,
      averageScore: avgScore,
      completionCount: completed,
    },
  });
}));

router.post('/', requireRole(['Admin', 'Trainer', 'HR', 'HeadOfDepartment']), asyncHandler(async (req, res) => {
  const { employeeId, trainingScheduleId, capabilityId, scoreObtained, maxScore, status } = req.body || {};
  if (!employeeId || !trainingScheduleId || scoreObtained == null || maxScore == null) {
    return res.status(400).json({ success: false, error: 'employeeId, trainingScheduleId, scoreObtained, maxScore required' });
  }
  const percentage = maxScore > 0 ? Math.round((Number(scoreObtained) / Number(maxScore)) * 100) : 0;
  const doc = await EmployeeScore.create({
    employeeId,
    trainingScheduleId,
    capabilityId: capabilityId || null,
    scoreObtained: Number(scoreObtained),
    maxScore: Number(maxScore),
    percentage,
    status: status === 'Pass' || percentage >= 70 ? 'Pass' : 'Fail',
  });
  res.status(201).json({ success: true, data: doc });
}));

module.exports = router;
