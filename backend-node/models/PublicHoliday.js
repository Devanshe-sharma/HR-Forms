const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PublicHolidaySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
  },
  { timestamps: true }
);

PublicHolidaySchema.index({ date: 1 });

module.exports = mongoose.model('PublicHoliday', PublicHolidaySchema);
