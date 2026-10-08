/**
 * backend-node/utils/attendanceReport.js
 *
 * Builds the Attendance reports (daily, one employee's month, and the
 * company-wide month summary) by joining punches, the working calendar,
 * approved leaves and Out of Office records into one status per
 * employee-day.
 *
 * Rules (confirmed by HR):
 *  - Day: flexible start 08:00–09:00, full day = 9 hours from the (clamped)
 *    start, so 09:00 → 18:00, 08:00 → 17:00.
 *  - Late only counts after 09:05 (5 min leniency); measured from 09:00.
 *  - Leaving up to 5 min early is not a shortfall.
 *  - Monthly buffers per employee: one 120-min and two 30-min. A late
 *    arrival / early exit that fits a free buffer is absorbed by the
 *    smallest free buffer that covers it, applied day by day in date order.
 *  - Worked >= 5h but still short after buffers = Half Day. Worked < 5h =
 *    treated as absent (then leave / OOO is checked).
 *  - Working days: Mon–Fri, Saturdays only on the 2nd and 4th; all Sundays
 *    and PublicHoliday dates are holidays.
 */

const AttendancePunch = require('../models/AttendancePunch');
const LeaveRequest = require('../models/LeaveRequest');
const OutOfOffice = require('../models/OutOfOffice');
const PublicHoliday = require('../models/PublicHoliday');
const { MACHINE_EMPLOYEES, normaliseCode } = require('./attendanceEmployees');

const IST_OFFSET_MS = 5.5 * 3600000;

const FLEX_START_MIN = 8 * 60;      // earliest flexible start
const LATE_BASE_MIN = 9 * 60;       // latest on-time start
const LATE_GRACE_MIN = 5;           // late only after 09:05
const EARLY_GRACE_MIN = 5;          // leaving <=5 min early is fine
const FULL_DAY_MIN = 9 * 60;
const HALF_DAY_MIN = 5 * 60;
const BUFFERS = [120, 30, 30];

const STATUSES = ['Present', 'Late', 'Half Day', 'Absent', 'On Leave', 'Out of Office', 'Holiday', 'Incomplete'];

const istKey = d => new Date(new Date(d).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
const istMinutes = d => {
  const t = new Date(new Date(d).getTime() + IST_OFFSET_MS);
  return t.getUTCHours() * 60 + t.getUTCMinutes() + t.getUTCSeconds() / 60;
};
const nameKey = s => String(s || '').toLowerCase().replace(/[^a-z]/g, '');
const codeOrder = (a, b) => (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0) || a.localeCompare(b);

const dowOf = dateKey => new Date(`${dateKey}T00:00:00Z`).getUTCDay();

function isWeeklyOff(dateKey) {
  const dow = dowOf(dateKey);
  if (dow === 0) return true;
  if (dow === 6) {
    const nth = Math.ceil(Number(dateKey.slice(8, 10)) / 7);
    return nth !== 2 && nth !== 4;
  }
  return false;
}

function daysInMonth(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

// Absorb a late/early amount into the smallest free buffer that covers it.
// An amount that rounds (to the nearest 30 min) to exactly 30 min or 2 hours
// is treated as exactly that, so e.g. 2h 7m late counts as the 2h buffer.
function absorb(rawMinutes, free) {
  if (rawMinutes <= 0) return { unabsorbed: 0, used: 0 };
  const rounded = Math.round(rawMinutes / 30) * 30;
  const minutes = rounded === 30 || rounded === 120 ? rounded : rawMinutes;
  let best = -1;
  free.forEach((b, i) => {
    if (b != null && b >= minutes && (best === -1 || b < free[best])) best = i;
  });
  if (best === -1) return { unabsorbed: minutes, used: 0 };
  const used = free[best];
  free[best] = null;
  return { unabsorbed: 0, used };
}

// One employee-day's punches -> in/out, late and early-out (after leniency).
function measureDay(punchTimes, isToday) {
  const sorted = punchTimes.slice().sort((a, b) => a - b);
  const punchIn = sorted[0];
  const hasOut = sorted.length > 1;
  const punchOut = hasOut ? sorted[sorted.length - 1] : null;

  const inMin = istMinutes(punchIn);
  const lateRaw = inMin - LATE_BASE_MIN;
  const lateMin = lateRaw > LATE_GRACE_MIN ? Math.round(lateRaw) : 0;

  let earlyMin = 0;
  let workedMin = null;
  if (hasOut) {
    workedMin = Math.round((punchOut - punchIn) / 60000);
    const expectedStart = Math.min(Math.max(inMin, FLEX_START_MIN), LATE_BASE_MIN);
    const earlyRaw = expectedStart + FULL_DAY_MIN - istMinutes(punchOut);
    earlyMin = earlyRaw > EARLY_GRACE_MIN ? Math.round(earlyRaw) : 0;
  }
  return { punchIn, punchOut, lateMin, earlyMin, workedMin, hasOut, incomplete: !hasOut && !isToday };
}

// Everything needed to evaluate any employee for one calendar month.
async function loadMonthContext(monthKey) {
  const monthStart = new Date(`${monthKey}-01T00:00:00+05:30`);
  const monthEnd = new Date(`${monthKey}-${String(daysInMonth(monthKey)).padStart(2, '0')}T23:59:59.999+05:30`);

  const [punches, holidays, leaves, oooRecords] = await Promise.all([
    AttendancePunch.find({ timestamp: { $gte: monthStart, $lte: monthEnd } })
      .select('employeeCode employeeName timestamp').lean(),
    PublicHoliday.find({ date: { $gte: monthStart, $lte: monthEnd } }).select('name date').lean(),
    LeaveRequest.find({ status: 'approved', dateFrom: { $lte: monthEnd }, dateTo: { $gte: monthStart } })
      .select('employeeName dateFrom dateTo halfDay').lean(),
    OutOfOffice.find({ startDateTime: { $lte: monthEnd } })
      .select('person.name startDateTime upToDate').lean(),
  ]);

  const byCode = new Map();       // code -> dayKey -> [Date]
  const seenName = new Map();
  for (const p of punches) {
    const code = normaliseCode(p.employeeCode);
    if (!byCode.has(code)) byCode.set(code, new Map());
    const days = byCode.get(code);
    const k = istKey(p.timestamp);
    if (!days.has(k)) days.set(k, []);
    days.get(k).push(new Date(p.timestamp));
    if (p.employeeName) seenName.set(code, p.employeeName);
  }

  return {
    monthKey,
    byCode,
    seenName,
    holidays: new Map(holidays.map(h => [istKey(h.date), h.name])),
    leaves: leaves.map(l => ({ key: nameKey(l.employeeName), from: istKey(l.dateFrom), to: istKey(l.dateTo), half: !!l.halfDay?.enabled })),
    ooo: oooRecords.map(o => {
      const from = istKey(o.startDateTime);
      return { key: nameKey(o.person?.name), from, to: o.upToDate || from };
    }),
  };
}

// Walk one employee through the month day by day (so buffers are consumed in
// date order) up to and including lastKey. Returns the day rows plus the
// buffers still free at the end.
function evaluateEmployee(code, ctx, lastKey, todayKey) {
  const name = MACHINE_EMPLOYEES[code] || ctx.seenName.get(code) || '';
  const nk = nameKey(name);
  const punchDays = ctx.byCode.get(code) || new Map();
  const free = BUFFERS.slice();
  const rows = [];

  const total = daysInMonth(ctx.monthKey);
  for (let d = 1; d <= total; d++) {
    const date = `${ctx.monthKey}-${String(d).padStart(2, '0')}`;
    if (date > lastKey) break;

    const holidayName = ctx.holidays.get(date);
    const off = isWeeklyOff(date) || !!holidayName;
    const holidayLabel = holidayName || (dowOf(date) === 0 ? 'Sunday' : 'Weekly off');

    const base = {
      date, weekday: dowOf(date), employeeCode: code, employeeName: name,
      punchIn: null, punchOut: null, workedMin: null,
      lateMin: 0, earlyMin: 0, bufferUsedMin: 0, note: '',
    };

    const leave = nk && ctx.leaves.find(l => l.key === nk && l.from <= date && date <= l.to);
    const away = nk && ctx.ooo.some(o => o.key === nk && o.from <= date && date <= o.to);
    // Out of Office is a few hours, not a whole day, so it only explains a short
    // day the employee actually punched in for — never a whole day with no punch.
    const absentStatus = (punched = false) => {
      if (leave) return { status: 'On Leave', note: leave.half ? 'Half day leave' : '' };
      if (away && punched) return { status: 'Out of Office', note: '' };
      return { status: 'Absent', note: '' };
    };

    const times = punchDays.get(date);
    if (!times) {
      rows.push(off ? { ...base, status: 'Holiday', note: holidayLabel } : { ...base, ...absentStatus() });
      continue;
    }

    const m = measureDay(times, date === todayKey);
    const filled = { ...base, punchIn: m.punchIn, punchOut: m.punchOut, workedMin: m.workedMin, lateMin: m.lateMin, earlyMin: m.earlyMin };

    if (off) { rows.push({ ...filled, status: 'Holiday', note: holidayLabel }); continue; }

    // A day with no out punch (and not today) must not eat a buffer.
    if (m.incomplete) { rows.push({ ...filled, status: 'Incomplete', note: 'No out punch' }); continue; }

    const freeBefore = free.slice();
    const late = absorb(m.lateMin, free);
    const early = m.hasOut ? absorb(m.earlyMin, free) : { unabsorbed: 0, used: 0 };
    filled.bufferUsedMin = late.used + early.used;

    if (!m.hasOut) { rows.push({ ...filled, status: late.unabsorbed > 0 ? 'Late' : 'Present' }); continue; }
    if (m.workedMin < HALF_DAY_MIN) {
      // Short day: not a presence — hand its buffers back and check leave / OOO.
      rows.push({ ...filled, bufferUsedMin: 0, ...absentStatus(true), note: `Worked ${Math.floor(m.workedMin / 60)}h ${m.workedMin % 60}m (<5h)` });
      free.splice(0, free.length, ...freeBefore);
      continue;
    }
    if (early.unabsorbed > 0) { rows.push({ ...filled, status: 'Half Day', note: '' }); continue; }
    if (late.unabsorbed > 0) { rows.push({ ...filled, status: 'Late', note: '' }); continue; }
    rows.push({ ...filled, status: 'Present', note: '' });
  }

  return { code, name, rows, free };
}

const rosterCodes = (ctx, onlyPunchedOn) => {
  const codes = new Set(Object.keys(MACHINE_EMPLOYEES));
  for (const [code, days] of ctx.byCode) if (!onlyPunchedOn || days.has(onlyPunchedOn)) codes.add(code);
  return [...codes].sort(codeOrder);
};

async function buildDailyReport(dateKey, todayKey) {
  const ctx = await loadMonthContext(dateKey.slice(0, 7));
  const holidayName = ctx.holidays.get(dateKey);
  const isHoliday = isWeeklyOff(dateKey) || !!holidayName;

  const rows = rosterCodes(ctx, dateKey).map(code => {
    const { rows: days } = evaluateEmployee(code, ctx, dateKey, todayKey);
    return days[days.length - 1];
  });

  return {
    date: dateKey,
    isHoliday,
    holidayLabel: isHoliday ? (holidayName || (dowOf(dateKey) === 0 ? 'Sunday' : 'Weekly off')) : '',
    rows,
  };
}

function summarise(days) {
  const counts = Object.fromEntries(STATUSES.map(s => [s, 0]));
  let workedMin = 0, lateMin = 0, earlyMin = 0;
  for (const r of days) {
    counts[r.status]++;
    workedMin += r.workedMin || 0;
    lateMin += r.lateMin;
    earlyMin += r.earlyMin;
  }
  return { counts, workedMin, lateMin, earlyMin };
}

function bufferInfo(days, free) {
  return {
    total: BUFFERS,
    remaining: free.filter(b => b != null),
    used: days.filter(r => r.bufferUsedMin > 0).map(r => ({ date: r.date, minutes: r.bufferUsedMin })),
  };
}

// Month ends at the last day on or before today (never future dates).
const lastKeyFor = (monthKey, todayKey) => {
  const end = `${monthKey}-${String(daysInMonth(monthKey)).padStart(2, '0')}`;
  return end < todayKey ? end : todayKey;
};

async function buildMonthlyReport(code, monthKey, todayKey) {
  const ctx = await loadMonthContext(monthKey);
  const c = normaliseCode(code);
  const { name, rows, free } = evaluateEmployee(c, ctx, lastKeyFor(monthKey, todayKey), todayKey);
  return { month: monthKey, employeeCode: c, employeeName: name, days: rows, summary: summarise(rows), buffers: bufferInfo(rows, free) };
}

async function buildMonthlySummary(monthKey, todayKey) {
  const ctx = await loadMonthContext(monthKey);
  const lastKey = lastKeyFor(monthKey, todayKey);
  const rows = rosterCodes(ctx, null).map(code => {
    const { name, rows: days, free } = evaluateEmployee(code, ctx, lastKey, todayKey);
    return { employeeCode: code, employeeName: name, ...summarise(days), buffersRemaining: free.filter(b => b != null) };
  });
  return { month: monthKey, rows };
}

module.exports = { buildDailyReport, buildMonthlyReport, buildMonthlySummary, STATUSES };
