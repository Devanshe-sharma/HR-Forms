const express = require('express');
const router = express.Router();
const { Growth } = require('../models/pmsModels');
const asyncHandler = require('express-async-handler');

// GET /api/growth - Get all growth data
router.get('/', asyncHandler(async (req, res) => {
  try {
    const { employeeId } = req.query;
    let query = {};
    if (employeeId) query.employeeId = employeeId;

    const growthData = await Growth.find(query).sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      data: growthData,
      message: 'Growth data retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching growth data:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching growth data',
      error: error.message
    });
  }
}));

// POST /api/growth - Add new growth data
router.post('/', asyncHandler(async (req, res) => {
  try {
    const { 
      employeeId, 
      trainingDelivered, 
      trainingAttended, 
      investmentInitiatives, 
      innovation: { ideasSubmitted, ideasImplemented } 
    } = req.body;
    
    const innovationScore = ideasSubmitted > 0 ? (ideasImplemented / ideasSubmitted) * 100 : 0;
    
    const growth = new Growth({
      employeeId,
      trainingDelivered: trainingDelivered || 0,
      trainingAttended: trainingAttended || 0,
      investmentInitiatives: investmentInitiatives || 0,
      innovation: {
        ideasSubmitted: ideasSubmitted || 0,
        ideasImplemented: ideasImplemented || 0,
        score: innovationScore
      }
    });

    await growth.save();
    res.status(201).json({
      success: true,
      data: growth,
      message: 'Growth data created successfully'
    });
  } catch (error) {
    console.error('Error creating growth data:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating growth data',
      error: error.message
    });
  }
}));

// PUT /api/growth/:id - Update growth data
router.put('/:id', asyncHandler(async (req, res) => {
  try {
    const { 
      trainingDelivered, 
      trainingAttended, 
      investmentInitiatives, 
      innovation 
    } = req.body;
    
    const growth = await Growth.findById(req.params.id);
    if (!growth) {
      return res.status(404).json({
        success: false,
        message: 'Growth data not found'
      });
    }

    if (trainingDelivered !== undefined) growth.trainingDelivered = trainingDelivered;
    if (trainingAttended !== undefined) growth.trainingAttended = trainingAttended;
    if (investmentInitiatives !== undefined) growth.investmentInitiatives = investmentInitiatives;
    
    if (innovation) {
      if (innovation.ideasSubmitted !== undefined) growth.innovation.ideasSubmitted = innovation.ideasSubmitted;
      if (innovation.ideasImplemented !== undefined) {
        growth.innovation.ideasImplemented = innovation.ideasImplemented;
        growth.innovation.score = innovation.ideasSubmitted > 0 ? (innovation.ideasImplemented / innovation.ideasSubmitted) * 100 : 0;
      }
    }
    
    growth.updatedAt = new Date();
    
    await growth.save();
    res.status(200).json({
      success: true,
      data: growth,
      message: 'Growth data updated successfully'
    });
  } catch (error) {
    console.error('Error updating growth data:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating growth data',
      error: error.message
    });
  }
}));

module.exports = router;
