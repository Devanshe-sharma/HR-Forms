const PublicHoliday = require('../models/PublicHoliday');
const WorkingSchedule = require('../models/WorkingSchedule');

function dateKey(d) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

async function getWorkingDays() {
  const schedule = await WorkingSchedule.findOne().lean();
  return new Set(schedule?.workingDays?.length ? schedule.workingDays : [1, 2, 3, 4, 5]);
}

// Counts only working days between dateFrom and dateTo (inclusive), skipping
// PublicHoliday dates. A half-day request always spans a single day and
// counts as 0.5, regardless of what the weekday/holiday check would say —
// the employee is explicitly asking for half of one specific working day.
async function computeLeaveDuration(dateFrom, dateTo, halfDay) {
  const from = new Date(dateFrom);
  const to = new Date(dateTo);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
    throw new Error('Invalid date range');
  }

  if (halfDay?.enabled) {
    return 0.5;
  }

  const workingDays = await getWorkingDays();
  const holidays = await PublicHoliday.find({
    date: { $gte: new Date(from.getFullYear(), from.getMonth(), from.getDate()), $lte: to },
  }).select('date').lean();
  const holidaySet = new Set(holidays.map((h) => dateKey(h.date)));

  let count = 0;
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  while (cursor <= end) {
    if (workingDays.has(cursor.getDay()) && !holidaySet.has(dateKey(cursor))) {
      count += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

module.exports = { computeLeaveDuration, getWorkingDays };
