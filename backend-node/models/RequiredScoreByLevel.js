// models/RequiredScoreByLevel.js — required score per employee level (1, 2, 3)
const mongoose = require('mongoose');
const { Schema } = mongoose;

const requiredScoreByLevelSchema = new Schema({
  level: { type: Number, enum: [1, 2, 3], required: true, unique: true },
  requiredScore: { type: Number, required: true, min: 0, max: 100 },
}, { timestamps: true });

const RequiredScoreByLevel = mongoose.models.RequiredScoreByLevel || mongoose.model('RequiredScoreByLevel', requiredScoreByLevelSchema);
module.exports = RequiredScoreByLevel;
