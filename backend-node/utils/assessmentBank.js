// utils/assessmentBank.js
// ─────────────────────────────────────────────────────────────────────────────
// Static question banks for the Excel Test and DISC Assessment.
//
// Excel: 20 MCQ (auto-graded against a stored answer key) + 10 Practical
// tasks (free-text formula/steps, left for HR to check and mark — formula
// correctness can't be reliably auto-graded). Mirrors the HR's standard
// "Basic Excel Skills Test" template (MCQ Questions sheet + Practical Tasks
// sheet) so the online form matches what HR already uses.
//
// DISC is a real forced-choice questionnaire, scored from the candidate's
// own picks via scoreDisc() below.
// ─────────────────────────────────────────────────────────────────────────────

const EXCEL_QUESTIONS = [
  { qNo: 1,  type: 'mcq', question: 'What symbol must every Excel formula begin with?', options: { A: '@', B: '=', C: '#', D: '$' }, correctAnswer: 'B' },
  { qNo: 2,  type: 'mcq', question: 'Which function adds up all numbers in a range?', options: { A: 'TOTAL()', B: 'ADD()', C: 'SUM()', D: 'PLUS()' }, correctAnswer: 'C' },
  { qNo: 3,  type: 'mcq', question: 'Which function calculates the average of a range of numbers?', options: { A: 'AVG()', B: 'AVERAGE()', C: 'MEAN()', D: 'MID()' }, correctAnswer: 'B' },
  { qNo: 4,  type: 'mcq', question: 'What is the default file extension for an Excel workbook (2007 onward)?', options: { A: '.xls', B: '.xlsm', C: '.xlsx', D: '.xlt' }, correctAnswer: 'C' },
  { qNo: 5,  type: 'mcq', question: 'A single box in a worksheet, identified like A1 or C5, is called a:', options: { A: 'Field', B: 'Cell', C: 'Range', D: 'Tab' }, correctAnswer: 'B' },
  { qNo: 6,  type: 'mcq', question: 'Which function counts only the numeric cells in a range?', options: { A: 'COUNT()', B: 'COUNTA()', C: 'COUNTIF()', D: 'SUM()' }, correctAnswer: 'A' },
  { qNo: 7,  type: 'mcq', question: 'Which function counts all non-empty cells (numbers AND text) in a range?', options: { A: 'COUNT()', B: 'COUNTA()', C: 'COUNTBLANK()', D: 'TALLY()' }, correctAnswer: 'B' },
  { qNo: 8,  type: 'mcq', question: 'Which function returns the largest value in a range?', options: { A: 'TOP()', B: 'LARGE()', C: 'MAX()', D: 'BIG()' }, correctAnswer: 'C' },
  { qNo: 9,  type: 'mcq', question: 'Which function returns the smallest value in a range?', options: { A: 'MIN()', B: 'LOW()', C: 'SMALL()', D: 'BOTTOM()' }, correctAnswer: 'A' },
  { qNo: 10, type: 'mcq', question: 'What is the keyboard shortcut to copy a selected cell in Windows Excel?', options: { A: 'Ctrl+V', B: 'Ctrl+C', C: 'Ctrl+X', D: 'Ctrl+S' }, correctAnswer: 'B' },
  { qNo: 11, type: 'mcq', question: 'What is the keyboard shortcut to undo the last action?', options: { A: 'Ctrl+U', B: 'Ctrl+Y', C: 'Ctrl+Z', D: 'Ctrl+R' }, correctAnswer: 'C' },
  { qNo: 12, type: 'mcq', question: 'In the reference $A$1, the dollar signs make it a/an:', options: { A: 'Relative reference', B: 'Mixed reference', C: 'Absolute reference', D: 'Named range' }, correctAnswer: 'C' },
  { qNo: 13, type: 'mcq', question: 'Which reference type changes automatically when a formula is copied to another cell?', options: { A: 'Absolute reference', B: 'Relative reference', C: 'External reference', D: 'Fixed reference' }, correctAnswer: 'B' },
  { qNo: 14, type: 'mcq', question: 'Which function is used to look up a value in the first column of a table and return a value from another column?', options: { A: 'LOOKUP()', B: 'VLOOKUP()', C: 'FINDVALUE()', D: 'SEARCH()' }, correctAnswer: 'B' },
  { qNo: 15, type: 'mcq', question: 'What does the formula =IF(A1>50,"Pass","Fail") do?', options: { A: 'Always returns Pass', B: 'Checks if A1 is greater than 50 and returns Pass or Fail accordingly', C: 'Adds 50 to A1', D: 'Returns an error' }, correctAnswer: 'B' },
  { qNo: 16, type: 'mcq', question: 'Which feature lets you keep the header row visible while scrolling down a long sheet?', options: { A: 'Split Screen', B: 'Freeze Panes', C: 'Page Break', D: 'Group Rows' }, correctAnswer: 'B' },
  { qNo: 17, type: 'mcq', question: 'Which feature highlights cells automatically based on a rule, e.g., values above 100 shown in red?', options: { A: 'Data Validation', B: 'Conditional Formatting', C: 'AutoFormat', D: 'Cell Styling' }, correctAnswer: 'B' },
  { qNo: 18, type: 'mcq', question: 'Which chart type is generally best for showing a trend over time?', options: { A: 'Pie Chart', B: 'Line Chart', C: 'Doughnut Chart', D: 'Scatter Chart only' }, correctAnswer: 'B' },
  { qNo: 19, type: 'mcq', question: 'Which function joins text from multiple cells into one cell (e.g., first name + last name)?', options: { A: 'JOIN()', B: 'MERGE()', C: 'CONCATENATE() or the & operator', D: 'TEXTADD()' }, correctAnswer: 'C' },
  { qNo: 20, type: 'mcq', question: 'What does the function =TODAY() return?', options: { A: 'The time right now', B: 'The current date, updated automatically', C: 'A fixed date you type in', D: 'The day of the week as text' }, correctAnswer: 'B' },

  { qNo: 21, type: 'practical', question: 'Write a formula that sums the sample data range.', sampleData: '10, 20, 30, 40 (in 4 cells)' },
  { qNo: 22, type: 'practical', question: 'Write a formula that returns the average of the sample data range.', sampleData: '10, 20, 30, 40' },
  { qNo: 23, type: 'practical', question: 'Write a formula that counts how many numeric values are in the sample data range.', sampleData: '10, 20, blank, 40' },
  { qNo: 24, type: 'practical', question: 'Write an IF formula: if the sample value is greater than 50, return "Pass", otherwise "Fail".', sampleData: 'Value: 65' },
  { qNo: 25, type: 'practical', question: 'Write a formula using VLOOKUP (or INDEX/MATCH) to find the Price for "Pen" in the sample table.', sampleData: 'Item/Price table: Pen-10, Pencil-5, Eraser-3' },
  { qNo: 26, type: 'practical', question: 'Write a formula that joins the First Name and Last Name into one Full Name (with a space between).', sampleData: 'First: Aman, Last: Verma' },
  { qNo: 27, type: 'practical', question: 'Describe (in words) the exact menu steps to Freeze the top row of a worksheet.', sampleData: '' },
  { qNo: 28, type: 'practical', question: 'Describe (in words) the exact steps to apply a Filter to a data table so it can be filtered by column.', sampleData: '' },
  { qNo: 29, type: 'practical', question: "Describe (in words) the steps to sort a table by the 'Amount' column, highest to lowest.", sampleData: '' },
  { qNo: 30, type: 'practical', question: 'Describe (in words) the steps to format a range of numbers as Indian Rupee currency (e.g., ₹1,00,000).', sampleData: '' },
];

// answers: array of { qNo, selectedOption } (only MCQ entries matter here).
// Returns per-question correctness plus a correct count, derived purely
// from the stored answer key — never from anything the candidate supplies.
function gradeExcelMcq(answers) {
  const mcqQuestions = EXCEL_QUESTIONS.filter((q) => q.type === 'mcq');
  let correctCount = 0;
  const graded = mcqQuestions.map((q) => {
    const given = (answers || []).find((a) => a.qNo === q.qNo);
    const isCorrect = !!given && given.selectedOption === q.correctAnswer;
    if (isCorrect) correctCount++;
    return { qNo: q.qNo, isCorrect };
  });
  return { graded, correctCount, totalMcq: mcqQuestions.length };
}

// 12-item forced-choice DISC questionnaire — each item offers one
// word/phrase per trait (D/I/S/C); the candidate picks the ONE that
// describes them best. Scoring just tallies picks per trait across all 12
// items, so the DB-stored score is a genuine 0-100% derived straight from
// the candidate's own answers (see scoreDisc below), not a canned result.
const DISC_QUESTIONS = [
  { D: 'Direct', I: 'Enthusiastic', S: 'Patient', C: 'Precise' },
  { D: 'Decisive', I: 'Persuasive', S: 'Steady', C: 'Careful' },
  { D: 'Competitive', I: 'Talkative', S: 'Dependable', C: 'Analytical' },
  { D: 'Bold', I: 'Sociable', S: 'Calm', C: 'Systematic' },
  { D: 'Driven', I: 'Expressive', S: 'Supportive', C: 'Accurate' },
  { D: 'Blunt', I: 'Optimistic', S: 'Loyal', C: 'Reserved' },
  { D: 'Assertive', I: 'Charming', S: 'Easygoing', C: 'Methodical' },
  { D: 'Demanding', I: 'Inspiring', S: 'Consistent', C: 'Detail-oriented' },
  { D: 'Independent', I: 'Outgoing', S: 'Team-player', C: 'Logical' },
  { D: 'Results-focused', I: 'Spontaneous', S: 'Relaxed', C: 'Cautious' },
  { D: 'Confident', I: 'Friendly', S: 'Good listener', C: 'Organised' },
  { D: 'Risk-taker', I: 'Energetic', S: 'Peacemaker', C: 'Rule-follower' },
];

// answers: array of 12 single-letter picks, e.g. ['D','I','S','D',...] — one
// per DISC_QUESTIONS item, in order. Returns { scores: {D,I,S,C}, primary }.
function scoreDisc(answers) {
  const scores = { D: 0, I: 0, S: 0, C: 0 };
  (answers || []).forEach((pick) => {
    if (scores[pick] !== undefined) scores[pick]++;
  });
  const total = DISC_QUESTIONS.length || 1;
  Object.keys(scores).forEach((k) => {
    scores[k] = Math.round((scores[k] / total) * 100);
  });
  const primary = Object.keys(scores).reduce((best, k) => (scores[k] > scores[best] ? k : best), 'D');
  return { scores, primary };
}

module.exports = { EXCEL_QUESTIONS, gradeExcelMcq, DISC_QUESTIONS, scoreDisc };
