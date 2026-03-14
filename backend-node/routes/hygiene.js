const express = require('express');
const router = express.Router();
const { Hygiene } = require('../models/pmsModels');
const asyncHandler = require('express-async-handler');

// GET /api/hygiene - Get all hygiene data
router.get('/', asyncHandler(async (req, res) => {
  try {
    const { employeeId } = req.query;
    let query = {};
    if (employeeId) query.employeeId = employeeId;

    const hygieneData = await Hygiene.find(query).sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      data: hygieneData,
      message: 'Hygiene data retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching hygiene data:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching hygiene data',
      error: error.message
    });
  }
}));

// POST /api/hygiene - Add new hygiene data
router.post('/', asyncHandler(async (req, res) => {
  try {
    const { 
      employeeId, 
      attendance: { present, total }, 
      lateMarks, 
      leaves: { taken, allowed } 
    } = req.body;
    
    // Calculate attendance percentage
    const attendancePercentage = total > 0 ? (present / total) * 100 : 0;
    const remainingLeaves = allowed - taken;
    
    // Calculate hygiene score
    const attendanceScore = attendancePercentage;
    const lateScore = Math.max(0, 100 - (lateMarks * 10)); // 10 points per late mark
    const leaveScore = (remainingLeaves / allowed) * 100;
    const finalScore = (attendanceScore * 0.4) + (lateScore * 0.3) + (leaveScore * 0.3);
    
    const hygiene = new Hygiene({
      employeeId,
      attendance: {
        present,
        total,
        percentage: attendancePercentage
      },
      lateMarks: lateMarks || 0,
      leaves: {
        taken: taken || 0,
        allowed: allowed,
        remaining: remainingLeaves
      },
      outOfOffice: 0,
      score: finalScore
    });

    await hygiene.save();
    res.status(201).json({
      success: true,
      data: hygiene,
      message: 'Hygiene data created successfully'
    });
  } catch (error) {
    console.error('Error creating hygiene data:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating hygiene data',
      error: error.message
    });
  }
}));

// PUT /api/hygiene/:id - Update hygiene data
router.put('/:id', asyncHandler(async (req, res) => {
  try {
    const { 
      attendance, 
      lateMarks, 
      leaves, 
      outOfOffice,
      employeeId
    } = req.body;
    
    const hygiene = await Hygiene.findById(req.params.id);
    if (!hygiene) {
      return res.status(404).json({
        success: false,
        message: 'Hygiene data not found'
      });
    }

    if (attendance) {
      const attendancePercentage = attendance.total > 0 ? (attendance.present / attendance.total) * 100 : 0;
      hygiene.attendance = {
        present: attendance.present,
        total: attendance.total,
        percentage: attendancePercentage
      };
    }
    
    if (lateMarks !== undefined) hygiene.lateMarks = lateMarks;
    if (leaves) {
      const remainingLeaves = leaves.allowed - leaves.taken;
      hygiene.leaves = {
        taken: leaves.taken,
        allowed: leaves.allowed,
        remaining: remainingLeaves
      };
    }
    if (outOfOffice !== undefined) hygiene.outOfOffice = outOfOffice;
    if (employeeId !== undefined) hygiene.employeeId = employeeId;
    
    hygiene.updatedAt = new Date();
    
    await hygiene.save();
    res.status(200).json({
      success: true,
      data: hygiene,
      message: 'Hygiene data updated successfully'
    });
  } catch (error) {
    console.error('Error updating hygiene data:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating hygiene data',
      error: error.message
    });
  }
}));

module.exports = router;
