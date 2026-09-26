const mongoose = require('mongoose');

// A chart the AI assistant produced and a user pinned to their HR Dashboard.
// Stores the query (not the data) so it re-runs against live data on every
// dashboard load, without calling Gemini again.
const AiInsightSchema = new mongoose.Schema(
  {
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    question: { type: String, default: '' },
    chartType: { type: String, enum: ['bar', 'line', 'pie', 'table', 'metric'], default: 'bar' },
    xKey: { type: String, default: '' },
    yKeys: { type: [String], default: [] },
    collectionName: { type: String, required: true },
    pipeline: { type: String, required: true }, // JSON-encoded aggregation pipeline
  },
  { timestamps: true }
);

module.exports = mongoose.model('AiInsight', AiInsightSchema);
