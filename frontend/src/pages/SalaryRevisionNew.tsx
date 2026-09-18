import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  Box, Typography, Chip, CircularProgress, Alert, Modal, Tabs, Tab,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Button, TextField, Select, MenuItem, FormControl, InputLabel,
  Avatar, Stack, IconButton, Divider, Slider, Autocomplete, Switch, FormControlLabel,
  Checkbox, InputAdornment, Popover, Dialog, DialogContent, Tooltip, Badge,
} from '@mui/material';
import {
  ArrowBack      as ArrowBackIcon,
  CheckCircle    as CheckCircleIcon,
  HourglassEmpty as HourglassEmptyIcon,
  BarChart       as TrendingUpIcon,
  Block          as PauseCircleIcon,
  Add            as AddIcon,
  Close          as CloseIcon,
  History        as HistoryIcon,
  Edit           as EditIcon,
  Delete         as DeleteIcon,
  Save           as SaveIcon,
  ExpandMore     as ExpandMoreIcon,
  Visibility     as VisibilityIcon,
  MailOutline    as MailIcon,
  Settings       as SettingsIcon,
} from '@mui/icons-material';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import Navbar  from '../components/Navbar';

// ─── Types ────────────────────────────────────────────────────────────────────

type RevisionDecision = 'increment' | 'pip' | null;
type RevisionStage    = 'pending_manager' | 'pending_management' | 'pending_hr' | 'completed' | 'on_hold';
// Once a revision record exists, Status starts from the backend-computed
// cycleStatus (scoreOverallCycle in utils/salaryRevisionScoring.js) — Not
// Yet Due until the Reminder Date arrives, Pending until the stage
// reaches HR/closure, Due for as long as it's open past that, Done/Done
// Delayed once closed. "Overdue" is layered on top client-side in
// rowStatus (NOT stored in cycleStatus/cycleScore) — it overrides
// Pending/Due once the actual Due Date has passed and the revision still
// isn't done, regardless of which stage it's stuck at. Two dates per
// cycle matter for display: "Due Date" is the exact/true one (joining +
// 12 months for employees, or the intern's contract end date) — shown
// under the "Due Date" column, and what the Overdue check compares
// against. "Reminder Date" is 1 month earlier (get11MonthDate) — what
// cycleStatus itself is measured against. See rowStatus in DashboardView
// for the exact precedence and the fallback used when no revision record
// exists yet.
type Status = 'not_yet_due' | 'pending' | 'due' | 'overdue' | 'done' | 'done_delayed';

interface PmsScore { period: string; score: number; }

interface ManagerDecision {
  decision         : RevisionDecision;
  recommendedPct   : number | null;
  pipDurationMonths: number | null;
  pipNewDueDate    : string | null;
  reason           : string;
  submittedAt      : string | null;
}

interface ManagementDecision {
  finalPct    : number | null;
  pipApproved : boolean | null;
  reason      : string;
  submittedAt : string | null;
}

interface HrSubStep {
  completed  : boolean;
  completedAt: string | null;
}

interface HrSubSteps {
  letterPrepared      : HrSubStep;
  employeeInformed    : HrSubStep;
  revisionLetterShared: HrSubStep;
  documentUploaded    : HrSubStep;
}

interface HrDocument {
  fileName  : string;
  driveLink : string;
  uploadedAt: string | null;
}

interface HrDecision {
  newCtc      : number | null;
  applicableDate: string | null;
  newContractStartDate: string | null;
  newContractEndDate  : string | null;
  // Only set for PPO / intern-to-full-time conversions — see fullTimeSince
  // on SalaryRevision below.
  fullTimeSince: string | null;
  notes       : string;
  submittedAt : string | null;
  // HR's editable override of the auto-calculated salary breakdown — a
  // { componentCode: amount } map covering every active CTC Component
  // (see CTCComponentType below), computed by the formula engine
  // (evaluateCtcComponents) from whatever HR has typed into the
  // no-formula "input" components. Only present once HR has actually
  // saved it (at finalisation); null/absent means still auto-calculated.
  // See salaryComponents on hrDecisionSchema in
  // backend-node/models/SalaryRevision.js (Mixed type, same reason).
  salaryComponents?: Record<string, number> | null;
  // The 4-step HR completion checklist (a 5th "Appraisal Decision" step
  // is derived client-side from managementDecision.submittedAt, not
  // stored here — see hrDecisionSchema's comment on the backend).
  subSteps?: HrSubSteps;
  document?: HrDocument;
}

interface SalaryRevision {
  _id               : string;
  onboardingId      : string | null;
  employeeCode      : string;
  employeeName      : string;
  department        : string;
  designation       : string;
  email             : string;
  joiningDate       : string;
  contractStartDate : string | null;
  contractEndDate   : string | null;
  newContractStartDate: string | null;
  newContractEndDate  : string | null;
  category          : string;
  applicableDate    : string | null;
  previousCtc       : number;
  newCtc            : number | null;
  finalIncrementPct : number | null;
  // Set when this revision was a PPO/intern-to-full-time conversion — the
  // date the employee actually became full-time. Used to anchor next
  // year's annual review instead of the original (internship) joining
  // date. Not set for normal annual/mid-term revisions.
  fullTimeSince     : string | null;
  pmsScores         : PmsScore[];
  stage             : RevisionStage;
  managerDecision   : ManagerDecision;
  managementDecision: ManagementDecision;
  hrDecision        : HrDecision;
  reviewDate        : string | null;
  pipOutcome        : 'improved' | 'not_improved' | null;
  pipOutcomeReason  : string;
  pipOutcomeDate    : string | null;
  createdAt         : string;
  designationChanged    : boolean;
  previousDesignation   : string;
  newDesignation        : string | null;
  reportingHeadChanged  : boolean;
  previousReportingHead : string;
  newReportingHead      : string | null;
  categoryChanged       : boolean;
  previousCategory      : string;
  newCategory           : string | null;
  // Backend-computed overall-cycle status/score (scoreOverallCycle in
  // utils/salaryRevisionScoring.js) — the source of truth for the
  // dashboard Status column once a revision exists. cycleScore is null
  // while cycleStatus is 'not_yet_due' (nothing to score yet), 0 for
  // pending/due/done, and negative (days late) for done_delayed.
  cycleStatus       : Status;
  cycleScore        : number | null;
  managerRequestedAt: string | null;
  _periodStart      : Date | null;
  _periodEnd        : Date | null;
}

function formatIncrementPct(revision: SalaryRevision): string | null {
  if (revision.finalIncrementPct != null) {
    return `${revision.finalIncrementPct >= 0 ? '+' : ''}${revision.finalIncrementPct.toFixed(2).replace(/\.00$/, '')}%`;
  }

  const prev = revision.previousCtc ?? 0;
  const next = revision.newCtc ?? 0;
  if (!prev || !next) return null;

  const pct = ((next - prev) / prev) * 100;
  if (!Number.isFinite(pct)) return null;
  return `${pct >= 0 ? '+' : ''}${Math.round(pct * 100) / 100}%`;
}

interface Employee {
  _id              : string;
  employee_id      : string;
  full_name        : string;
  department       : string;
  designation      : string;
  email            : string;
  official_email   : string;
  joining_date     : string | null;
  employee_category: string;
  annual_ctc       : number;
  reporting_head?  : string;
  contract_start_date?: string | null;
  contract_end_date?  : string | null;
  contract_period_months?: number | null;
  contract_history?   : { start_date: string | null; end_date: string | null }[];
}

// CTC Components — shared across this page AND the Employee Letters page,
// both reading/writing the same backend collection, so a change made here
// is automatically visible everywhere else that fetches the same endpoint.
interface CTCComponentType {
  _id?: string;
  name: string;
  code: string;
  formula: string;
  order: number;
  is_active: boolean;
  show_in_documents: boolean;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const API_URL = process.env.REACT_APP_API_URL || process.env.REACT_APP_REACT_APP_API_BASE_URL || '/api';
const API      = `${API_URL}/salary-revisions`;
// Employees now come from Onboarding — the single source of truth — instead
// of a separate Employee collection.
const EMP_API  = `${API_URL}/onboarding/eligible-employees`;
// Same endpoint the Employee Letters page reads from — one source of
// truth for CTC component definitions, edited from either place.
const CTC_API  = `${API_URL}/ctc-components/`;

const ACCENT = '#4f46e5';

// Design tokens for the dashboard table/filter redesign — scoped as CSS custom
// properties on the DashboardView root (see ROOT_TOKENS) rather than adopted
// app-wide, since no global token system exists yet in this codebase.
const ROOT_TOKENS = {
  '--text-primary'  : '#0f172a',
  '--text-secondary': '#64748b',
  '--text-accent'   : ACCENT,
  '--surface-1'     : '#f8fafc',
  '--border'        : '#e2e8f0',
} as const;

// Table header keeps a full-strength 1px rule (reserved, per design spec, for
// the header row and card outlines only — everything else uses the thinner
// 0.5px --border rule below).
const TH = { fontWeight: 700, fontSize: 12, color: 'var(--text-secondary)', bgcolor: 'var(--surface-1)', whiteSpace: 'nowrap' as const, py: '8px', borderBottom: `1px solid var(--border)` };
// Body cell — dense but with enough vertical breathing room (>=4px), and the
// thinner non-essential-divider rule between rows.
const TD = { fontSize: 12, py: '10px', borderBottom: '0.5px solid var(--border)' };

// A visible-but-not-loud tint fill for the one chip per row allowed to "pop"
// (StatusChip) — everything else in a row is plain text or an outline badge.
const statusFill = (color: string) => `${color}26`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const initials = (n: string) => n.split(' ').map(w=>w[0]).filter(Boolean).slice(0,2).join('').toUpperCase();

const fmtDate = (d?: string|Date|null) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN',{ day:'2-digit', month:'short', year:'numeric' }); }
  catch { return String(d); }
};

const fmtCurrency = (n?: number|null) => {
  if (n==null||isNaN(n)) return '—';
  return new Intl.NumberFormat('en-IN',{ style:'currency', currency:'INR', maximumFractionDigits:0 }).format(n);
};

const get11MonthDate = (j: string): Date => {
  const d = new Date(j);
  return new Date(d.getFullYear(), d.getMonth()+11, d.getDate());
};

const anniversaryDateForYear = (j: string, year: number): Date => {
  const first = get11MonthDate(j);
  return new Date(year, first.getMonth(), first.getDate());
};

// An intern's review/PPO date — joining date + (contract months - 1),
// same "one month early" convention as get11MonthDate's annual +11 (a
// buffer before the actual contract-end anniversary). E.g. joined 1 Jan
// 2026 with a 6-month contract → review date 1 Jun 2026, one month
// ahead of the 1 Jul contract end.
const internReviewDate = (joiningDate: string, contractMonths: number): Date => {
  const d = new Date(joiningDate);
  return new Date(d.getFullYear(), d.getMonth() + (contractMonths - 1), d.getDate());
};

// Indian financial year: Apr 1 – Mar 31. Mirrors backend-node/utils/
// fiscalQuarter.js exactly, so the dashboard's quarter browsing lines up
// with the same fiscal-year definition the HR analytics endpoints use.
// "year" always means the fiscal year's START calendar year — year=2026
// is FY2026-27 (Apr 2026 – Mar 2027); Q4 (Jan–Mar) of that fiscal year
// therefore falls in calendar year 2027, not 2026.
const FISCAL_START_MONTH = 3; // April, 0-indexed

const fiscalYearOf = (d: Date | string): number => {
  const date = new Date(d);
  const m = date.getMonth(), y = date.getFullYear();
  return m >= FISCAL_START_MONTH ? y : y - 1;
};

const fiscalQuarterOf = (d: Date | string): number => {
  const date = new Date(d);
  const shifted = (date.getMonth() - FISCAL_START_MONTH + 12) % 12;
  return Math.floor(shifted / 3) + 1;
};

const fiscalQuarterStart = (year: number, quarter: number): Date =>
  new Date(year, FISCAL_START_MONTH + (quarter - 1) * 3, 1);

const fiscalQuarterEnd = (year: number, quarter: number): Date =>
  new Date(year, FISCAL_START_MONTH + quarter * 3, 0, 23, 59, 59);

const fiscalYearLabel = (year: number): string =>
  `FY ${year}-${String((year + 1) % 100).padStart(2, '0')}`;

// Does this employee's recurring annual due-date land inside [rangeStart,
// rangeEnd]? Works for both a fiscal-quarter window and an arbitrary
// custom date range — checks every calendar year the range could touch
// (a range never spans more than 2), builds that year's due-date
// occurrence, and confirms it's both on/after the employee's very first
// due date AND inside the window. Returns the matching due date itself
// (so the UI can display exactly which occurrence matched), or null.
const isDueInRange = (anchor: Date, rangeStart: Date, rangeEnd: Date): Date | null => {
  const first = get11MonthDate(anchor.toISOString());
  for (let y = rangeStart.getFullYear(); y <= rangeEnd.getFullYear(); y++) {
    const candidate = new Date(y, first.getMonth(), first.getDate());
    if (candidate >= first && candidate >= rangeStart && candidate <= rangeEnd) {
      return candidate;
    }
  }
  return null;
};

// The annual review "clock" doesn't always run from the original joining
// date. Two things reset it:
//   1. A completed revision landing in the currently-expected due month
//      (an on-time annual review) — the next cycle then runs from THAT
//      revision's date, not the original joining date.
//   2. A PPO/intern-to-full-time conversion (fullTimeSince) — this always
//      resets the anchor regardless of timing, since that's genuinely
//      when the employee's real annual cycle starts.
// A revision landing outside the expected month (a mid-term/off-cycle
// adjustment) is skipped — it must NOT push next year's due date.
const computeAnchorDate = (joiningDate: string, revisions: SalaryRevision[]): Date => {
  const completed = revisions
    .filter(r => r.stage === 'completed')
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  let anchor = new Date(joiningDate);

  for (const rev of completed) {
    if (rev.fullTimeSince) {
      anchor = new Date(rev.fullTimeSince);
      continue;
    }

    const revDate = rev.applicableDate ? new Date(rev.applicableDate) : new Date(rev.createdAt);
    const expectedMonth = get11MonthDate(anchor.toISOString()).getMonth();

    if (revDate.getMonth() === expectedMonth) {
      anchor = revDate;
    }
  }

  return anchor;
};

// A revision counts as a PPO / full-time conversion when it recorded a
// category change landing on 'Employee' from a non-permanent starting
// category. Same definition used server-side (isConversion in
// routes/salaryRevisions.js) and for the HR "Full-Time Since" field.
const PPO_SOURCE_CATEGORIES = ['Intern', 'Intern with PPO', 'Contract Based'];
const isPpoRevision = (r: SalaryRevision) =>
  !!r.categoryChanged && r.newCategory === 'Employee' && PPO_SOURCE_CATEGORIES.includes(r.previousCategory);

const avgPms = (scores?: PmsScore[]): number|null => {
  if (!scores?.length) return null;
  return Math.round(scores.reduce((s,p)=>s+p.score,0)/scores.length*10)/10;
};

const calcSalaryStructure = (annualCtc: number) => {
  const monthly  = Math.round(annualCtc / 12);
  const basic    = Math.round(monthly * 0.40);
  const hra      = Math.round(basic * 0.40);
  const convey   = 1600;
  const medical  = Math.round(monthly * 0.03);
  const special  = monthly - basic - hra - convey - medical;
  const pf       = Math.round(basic * 0.12);
  const gratuity = Math.round(basic * 0.0481);
  const gross    = basic + hra + convey + medical + Math.max(special, 0);
  return { basic, hra, convey, medical, special:Math.max(special,0), pf, gratuity, gross, monthly, annual:annualCtc };
};

// ─── CTC Formula Engine ─────────────────────────────────────────────────────
// Small recursive-descent evaluator for the Excel-style formulas HR
// writes into CtcComponent.formula on the CTC Components admin screen
// (e.g. "BASIC * 0.4", "IF(BASIC < 21000, 13580 * 0.0833, 0)",
// "GROSS_MONTHLY + ESIC + PF"). A component with a blank formula is a
// manual INPUT (its value comes from `inputs`, i.e. what HR typed); a
// component with a formula is COMPUTED and read-only. A formula
// referencing a deleted/unknown component code resolves to 0 rather than
// throwing, so one stale reference never breaks the whole sheet — same
// reasoning as a circular reference (also resolves to 0, guarded via the
// `evaluating` set below, rather than infinite-looping).
type FormulaToken = { type:'num'|'id'|'op'|'lparen'|'rparen'|'comma'; value:string };

function tokenizeFormula(src: string): FormulaToken[] {
  const tokens: FormulaToken[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === '(') { tokens.push({ type:'lparen', value:ch }); i++; continue; }
    if (ch === ')') { tokens.push({ type:'rparen', value:ch }); i++; continue; }
    if (ch === ',') { tokens.push({ type:'comma', value:ch }); i++; continue; }
    if ('<>=!'.includes(ch)) {
      if (src[i+1] === '=') { tokens.push({ type:'op', value:ch+'=' }); i+=2; }
      else { tokens.push({ type:'op', value:ch }); i++; }
      continue;
    }
    if ('+-*/'.includes(ch)) { tokens.push({ type:'op', value:ch }); i++; continue; }
    if (/[0-9.]/.test(ch)) {
      let j=i; while (j<src.length && /[0-9.]/.test(src[j])) j++;
      tokens.push({ type:'num', value:src.slice(i,j) }); i=j; continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j=i; while (j<src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      tokens.push({ type:'id', value:src.slice(i,j) }); i=j; continue;
    }
    i++; // skip any other stray character rather than throwing
  }
  return tokens;
}

type FormulaNode =
  | { kind:'num'; value:number }
  | { kind:'ref'; code:string }
  | { kind:'bin'; op:string; left:FormulaNode; right:FormulaNode }
  | { kind:'neg'; value:FormulaNode }
  | { kind:'if'; cond:FormulaNode; then:FormulaNode; else:FormulaNode };

function parseFormula(src: string): FormulaNode {
  const tokens = tokenizeFormula(src);
  let pos = 0;
  const peek = () => tokens[pos];
  const eat = (type?: string) => { const t = tokens[pos]; if (type && t?.type !== type) throw new Error(`Expected ${type}`); pos++; return t; };

  function parseAdd(): FormulaNode {
    let node = parseMul();
    while (peek() && peek().type==='op' && (peek().value==='+'||peek().value==='-')) {
      const op = eat().value; node = { kind:'bin', op, left:node, right:parseMul() };
    }
    return node;
  }
  function parseMul(): FormulaNode {
    let node = parseUnary();
    while (peek() && peek().type==='op' && (peek().value==='*'||peek().value==='/')) {
      const op = eat().value; node = { kind:'bin', op, left:node, right:parseUnary() };
    }
    return node;
  }
  function parseUnary(): FormulaNode {
    if (peek() && peek().type==='op' && peek().value==='-') { eat(); return { kind:'neg', value:parseUnary() }; }
    return parsePrimary();
  }
  function parseCompare(): FormulaNode {
    const left = parseAdd();
    if (peek() && peek().type==='op' && ['<','>','<=','>=','==','!='].includes(peek().value)) {
      const op = eat().value; const right = parseAdd();
      return { kind:'bin', op, left, right };
    }
    return left;
  }
  function parsePrimary(): FormulaNode {
    const t = peek();
    if (!t) return { kind:'num', value:0 };
    if (t.type==='num') { eat(); return { kind:'num', value:Number(t.value) }; }
    if (t.type==='lparen') { eat(); const n=parseAdd(); eat('rparen'); return n; }
    if (t.type==='id') {
      if (t.value.toUpperCase()==='IF') {
        eat(); eat('lparen');
        const cond = parseCompare(); eat('comma');
        const thenExpr = parseAdd(); eat('comma');
        const elseExpr = parseAdd(); eat('rparen');
        return { kind:'if', cond, then:thenExpr, else:elseExpr };
      }
      eat(); return { kind:'ref', code:t.value.toUpperCase() };
    }
    eat(); return { kind:'num', value:0 };
  }

  return parseAdd();
}

function evalFormulaNode(node: FormulaNode, resolve: (code:string)=>number): number {
  switch (node.kind) {
    case 'num': return node.value;
    case 'ref': return resolve(node.code);
    case 'neg': return -evalFormulaNode(node.value, resolve);
    case 'if':
      return evalFormulaNode(node.cond, resolve) ? evalFormulaNode(node.then, resolve) : evalFormulaNode(node.else, resolve);
    case 'bin': {
      const l = evalFormulaNode(node.left, resolve), r = evalFormulaNode(node.right, resolve);
      switch (node.op) {
        case '+': return l+r; case '-': return l-r; case '*': return l*r;
        case '/': return r!==0 ? l/r : 0;
        case '<': return l<r?1:0; case '>': return l>r?1:0;
        case '<=': return l<=r?1:0; case '>=': return l>=r?1:0;
        case '==': return l===r?1:0; case '!=': return l!==r?1:0;
        default: return 0;
      }
    }
  }
}

// components: every ACTIVE CtcComponent (any order). inputs: what HR has
// typed into the no-formula fields, keyed by component code. Returns
// EVERY component's resolved value, keyed by code — inputs verbatim for
// no-formula components, formula results for the rest.
function evaluateCtcComponents(components: CTCComponentType[], inputs: Record<string, number>): Record<string, number> {
  const byCode = new Map(components.map(c => [c.code, c]));
  const cache: Record<string, number> = {};
  const evaluating = new Set<string>();

  function resolve(code: string): number {
    if (cache[code] !== undefined) return cache[code];
    const comp = byCode.get(code);
    const hasFormula = !!comp?.formula?.trim();
    if (!hasFormula) return cache[code] = inputs[code] ?? 0;
    if (evaluating.has(code)) return cache[code] = 0;
    evaluating.add(code);
    let value = 0;
    try { value = evalFormulaNode(parseFormula(comp!.formula), resolve); }
    catch { value = 0; }
    evaluating.delete(code);
    return cache[code] = Math.round(value * 100) / 100;
  }

  components.forEach(c => resolve(c.code));
  return cache;
}

// Bidirectional %-to-amount conversion for the increment inputs — editing
// either the percentage slider or the target CTC amount field keeps the
// other one in sync, both derived off the same previous-CTC baseline.
const amountFromPct = (pct: number, base: number): number =>
  Math.round(base * (1 + pct / 100));

const pctFromAmount = (amount: number, base: number): number =>
  base > 0 ? Math.round(((amount - base) / base) * 1000) / 10 : 0;

// ─── Stage helpers ────────────────────────────────────────────────────────────

const stageLabel = (s: RevisionStage) =>
  s==='completed' ? 'Completed' :
  s==='on_hold'   ? 'On Hold' :
  s==='pending_manager' ? 'Pending Manager' :
  s==='pending_management' ? 'Pending Management' : 'Pending HR';

const stageColor = (s: RevisionStage) =>
  s==='completed' ? '#059669' :
  s==='on_hold'   ? '#d97706' :
  s==='pending_hr'? ACCENT :
                    '#64748b';

// ─── Small chips ──────────────────────────────────────────────────────────────

function StageChip({ stage }: { stage: RevisionStage }) {
  const color = stageColor(stage);
  const done = stage==='completed';
  return (
    <Chip size="small"
      icon={done ? <CheckCircleIcon sx={{ fontSize: 13 }}/> : <HourglassEmptyIcon sx={{ fontSize: 13 }}/>}
      label={stageLabel(stage)}
      sx={{ bgcolor: '#f8fafc', color, fontWeight: 600, fontSize: 11, border: `1px solid ${color}30`,
        '& .MuiChip-icon':{ color:'inherit', ml:'4px' } }}/>
  );
}

// isPpo marks a revision that's really an Intern/Contract-Based → Employee
// conversion — the CTC jump there is a category conversion (stipend to full
// CTC), not a real merit increment, so it must never read as "Increment"
// even though managerDecision.decision is still literally 'increment' and
// the underlying data (finalIncrementPct, newCtc, etc.) is left exactly
// as-is. Same distinction analytics/increments already applies server-side
// via isConversion — this just makes it visible here too.
function DecisionChip({ decision, isPpo }: { decision: RevisionDecision; isPpo?: boolean }) {
  if (!decision) return <Chip size="small" label="Pending" sx={{ bgcolor:'#f8fafc', color:'#94a3b8', fontSize:11 }}/>;
  if (decision==='increment' && isPpo) {
    const color = '#2563eb';
    return (
      <Chip size="small"
        label="PPO Conversion"
        sx={{ bgcolor:'#f8fafc', color, fontWeight:600, fontSize:11, border:`1px solid ${color}30` }}/>
    );
  }
  const color = decision==='increment' ? '#059669' : '#dc2626';
  return (
    <Chip size="small"
      icon={decision==='increment'?<TrendingUpIcon sx={{ fontSize: 13 }}/>:<PauseCircleIcon sx={{ fontSize: 13 }}/>}
      label={decision==='increment'?'Increment':'PIP'}
      sx={{ bgcolor:'#f8fafc', color, fontWeight:600, fontSize:11, border:`1px solid ${color}30`,
        '& .MuiChip-icon':{ color:'inherit', ml:'4px' } }}/>
  );
}

// Mirrors ESCALATION_ELIGIBLE_FROM in backend-node/utils/
// salaryRevisionEscalation.js — the same date, for the same reason:
// anything from before this predates the tracking system and was never
// something anyone was actively expected to act on.
const OVERDUE_ELIGIBLE_FROM = new Date(2026, 8, 1); // 1 Sept 2026

const STATUS_LABEL: Record<Status,string> = {
  not_yet_due: 'Not Yet Due', pending: 'Pending', due: 'Due', overdue: 'Overdue',
  done: 'Done', done_delayed: 'Done Delayed',
};
const STATUS_COLOR: Record<Status,string> = {
  not_yet_due: '#64748b', pending: '#eab308', due: '#d97706', overdue: '#dc2626',
  done: '#059669', done_delayed: '#b45309',
};

// The one chip per row allowed a strong fill — everything else nearby in the
// dashboard table is plain text or an outline-only badge, so Status is the
// single thing that visually pops.
function StatusChip({ status }: { status: Status }) {
  const color = STATUS_COLOR[status];
  return (
    <Chip size="small" label={STATUS_LABEL[status]}
      sx={{ bgcolor: statusFill(color), color, fontWeight: 700, fontSize: 11, border: 'none' }}/>
  );
}

// A quiet, no-fill badge — used for anything riding alongside StatusChip
// that would otherwise compete with it (e.g. the "Full-Time Offer" marker).
function OutlineBadge({ label, color }: { label: string; color: string }) {
  return (
    <Chip size="small" label={label} variant="outlined"
      sx={{ bgcolor: 'transparent', color, fontWeight: 600, fontSize: 9, height: 16, borderColor: `${color}55` }}/>
  );
}

function Toast({ msg, type, onClose }: { msg:string; type:'success'|'error'; onClose:()=>void }) {
  useEffect(()=>{ const t=setTimeout(onClose,3500); return ()=>clearTimeout(t); },[onClose]);
  return (
    <Box sx={{ position:'fixed', bottom:24, right:24, zIndex:9999, minWidth:280 }}>
      <Alert severity={type} onClose={onClose} sx={{ borderRadius:2 }}>{msg}</Alert>
    </Box>
  );
}

// ─── Add Revision Modal ───────────────────────────────────────────────────────

function AddRevisionModal({ open, onClose, onAdded, showToast, employees, records }: {
  open:boolean; onClose:()=>void; onAdded:(r:SalaryRevision)=>void;
  showToast:(m:string,t:'success'|'error')=>void; employees:Employee[]; records:SalaryRevision[];
}) {
  const [sel,     setSel]     = useState<Employee|null>(null);
  const [pms,     setPms]     = useState<PmsScore[]>([{ period:'', score:0 }]);
  const [appDate, setAppDate] = useState('');
  const [cat,     setCat]     = useState('Employee');
  const [saving,  setSaving]  = useState(false);

  useEffect(()=>{ if (!open){ setSel(null); setPms([{period:'',score:0}]); setAppDate(''); setCat('Employee'); } },[open]);

  const setRow=(i:number,f:keyof PmsScore,v:string|number)=>
    setPms(r=>r.map((row,idx)=>idx===i?{...row,[f]:v}:row));

  const submit=async()=>{
    if (!sel) return showToast('Select an employee','error');
    if (!sel.joining_date) return showToast('Employee has no joining date','error');
    try {
      setSaving(true);
      const { data }=await axios.post(API,{
        onboardingId:sel._id,
        employeeCode:sel.employee_id, employeeName:sel.full_name,
        department:sel.department, designation:sel.designation,
        email:sel.email, joiningDate:sel.joining_date,
        contractStartDate:sel.contract_start_date||null, contractEndDate:sel.contract_end_date||null,
        category:cat, applicableDate:appDate||null,
        previousCtc:sel.annual_ctc||0,
        previousDesignation:sel.designation,
        previousReportingHead:sel.reporting_head||'',
        previousCategory:sel.employee_category||'Employee',
        pmsScores:pms.filter(p=>p.period.trim()),
      });
      if (data.success||data._id||data.data){ showToast('Revision created','success'); onAdded(data.data||data); onClose(); }
      else showToast(data.message||'Failed','error');
    } catch(e:any){ showToast(e?.response?.data?.message||'Request failed','error'); }
    finally { setSaving(false); }
  };

  const due = sel?.joining_date
    ? get11MonthDate(computeAnchorDate(sel.joining_date, records.filter(r=>r.employeeCode===sel.employee_id)).toISOString())
    : null;
  // True/exact due date — the real anniversary, one month after the
  // reminder date above.
  const trueDue = due ? new Date(due.getFullYear(), due.getMonth()+1, due.getDate()) : null;

  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
        width:{ xs:'95vw', md:520 }, maxHeight:'88vh', overflow:'auto',
        bgcolor:'white', borderRadius:2, border: '1px solid #e2e8f0', outline:'none' }}>
        <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between',
          p:2, borderBottom:'1px solid #e2e8f0', position:'sticky', top:0, bgcolor:'white', zIndex:1 }}>
          <Typography fontSize={14} fontWeight={700}>Add Salary Revision</Typography>
          <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small"/></IconButton>
        </Box>
        <Box sx={{ p:2.5 }}>
          <Stack spacing={2.5}>
            <Box>
              <Typography fontSize={11} fontWeight={600} color="text.secondary" mb={0.75}>SELECT EMPLOYEE</Typography>
              <Autocomplete options={employees} getOptionLabel={e=>`${e.full_name} (${e.department})`}
                value={sel} onChange={(_,v)=>{ setSel(v); if(v?.employee_category) setCat(v.employee_category); }}
                renderInput={p=><TextField {...p} size="small" placeholder="Search name or department…"/>}
                renderOption={(props,e)=>(
                  <li {...props} key={e._id}>
                    <Box sx={{ display:'flex', alignItems:'center', gap:1.5, py:0.5 }}>
                      <Avatar sx={{ width:26, height:26, bgcolor:ACCENT, fontSize:10, fontWeight:700 }}>{initials(e.full_name)}</Avatar>
                      <Box>
                        <Typography fontSize={13} fontWeight={600}>{e.full_name}</Typography>
                        <Typography fontSize={11} color="text.secondary">{e.designation} · {e.department}</Typography>
                      </Box>
                    </Box>
                  </li>
                )}/>
            </Box>
            {sel && (
              <Box sx={{ p:1.5, bgcolor:'#f8fafc', borderRadius:1.5, border:'1px solid #e2e8f0' }}>
                <Typography fontSize={10} fontWeight={700} color="text.secondary" mb={1}>AUTO-FETCHED</Typography>
                <Box sx={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:1.2 }}>
                  {[['Designation',sel.designation||'—'],['Email',sel.email||'—'],
                    ['Joining Date',fmtDate(sel.joining_date)],['Previous CTC',fmtCurrency(sel.annual_ctc)],
                    ['Reminder Date',fmtDate(due?.toISOString())],
                    ['Due Date',fmtDate(trueDue?.toISOString())],
                    ['Contract Start',fmtDate(sel.contract_start_date)],['Contract End',fmtDate(sel.contract_end_date)]
                  ].map(([l,v])=>(
                    <Box key={l}><Typography fontSize={10} color="text.secondary">{l}</Typography>
                      <Typography fontSize={12} fontWeight={600}>{v}</Typography></Box>
                  ))}
                </Box>
              </Box>
            )}
            <Box sx={{ display:'flex', gap:2, flexWrap:'wrap' }}>
              <TextField label="Applicable Date" type="date" size="small" value={appDate}
                onChange={e=>setAppDate(e.target.value)} InputLabelProps={{ shrink:true }}
                sx={{ minWidth:180 }}/>
              <FormControl size="small" sx={{ minWidth:150 }}>
                <InputLabel>Category</InputLabel>
                <Select value={cat} label="Category" onChange={e=>setCat(e.target.value)}>
                  {['Employee','Consultant','Intern','Intern with PPO','Temporary Staff','Contract Based'].map(c=>(
                    <MenuItem key={c} value={c}>{c}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <Box>
              <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', mb:1 }}>
                <Typography fontSize={11} fontWeight={600} color="text.secondary">PMS SCORES</Typography>
                <Button size="small" startIcon={<AddIcon/>} onClick={()=>setPms(r=>[...r,{period:'',score:0}])}
                  sx={{ fontSize:11, textTransform:'none', color:ACCENT }}>Add Period</Button>
              </Box>
              <Stack spacing={1}>
                {pms.map((row,i)=>(
                  <Box key={i} sx={{ display:'flex', gap:1.5, alignItems:'flex-start' }}>
                    <TextField size="small" label="Period" placeholder="e.g. Q1 2024"
                      value={row.period} onChange={e=>setRow(i,'period',e.target.value)} sx={{ flex:2 }}/>
                    <TextField size="small" label="Score" type="number" value={row.score}
                      onChange={e=>setRow(i,'score',Number(e.target.value))}
                      inputProps={{ min:0, max:10, step:0.1 }} sx={{ flex:1 }}/>
                    {pms.length>1&&<IconButton size="small" onClick={()=>setPms(r=>r.filter((_,idx)=>idx!==i))}
                      sx={{ mt:0.5, color:'#dc2626' }}><CloseIcon fontSize="small"/></IconButton>}
                  </Box>
                ))}
              </Stack>
            </Box>
            <Box sx={{ display:'flex', gap:2 }}>
              <Button variant="contained" onClick={submit} disabled={saving||!sel}
                sx={{ flex:1, bgcolor:ACCENT, '&:hover':{ bgcolor:'#4338ca' }, textTransform:'none', fontWeight:600 }}>
                {saving?<CircularProgress size={20} sx={{ color:'white' }}/>:'Create Revision'}
              </Button>
              <Button variant="outlined" onClick={onClose} sx={{ textTransform:'none' }}>Cancel</Button>
            </Box>
          </Stack>
        </Box>
      </Box>
    </Modal>
  );
}

// ─── CTC Components View ───────────────────────────────────────────────────────
// Manages the same collection the Employee Letters page reads from — a
// change saved here shows up there (and anywhere else that fetches the
// same endpoint) immediately, since there's only ever one copy of this
// data. Restyled to match this page's own compact, MUI-based look
// instead of the old standalone dashboard's styling.

function CtcComponentsView({ onBack, showToast }: {
  onBack: () => void;
  showToast: (m: string, t: 'success' | 'error') => void;
}) {
  const [components, setComponents] = useState<CTCComponentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formData, setFormData] = useState<CTCComponentType>({
    name: '', code: '', formula: '0', order: 0, is_active: true, show_in_documents: true,
  });

  const fetchComponents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(CTC_API);
      const data = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setComponents(data.sort((a: CTCComponentType, b: CTCComponentType) => a.order - b.order));
    } catch (err) {
      showToast('Failed to load CTC components', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchComponents(); }, [fetchComponents]);

  const resetForm = () => {
    setEditingId(null);
    setFormOpen(false);
    setFormData({ name: '', code: '', formula: '0', order: components.length + 1, is_active: true, show_in_documents: true });
  };

  const startAdd = () => {
    setEditingId(null);
    setFormData({ name: '', code: '', formula: '0', order: components.length + 1, is_active: true, show_in_documents: true });
    setFormOpen(true);
  };

  const startEdit = (comp: CTCComponentType) => {
    if (!comp._id) return;
    setEditingId(comp._id);
    setFormData(comp);
    setFormOpen(true);
  };

  const saveComponent = async () => {
    if (saving) return;
    if (!formData.name.trim() || !formData.code.trim()) {
      showToast('Name and Code are required', 'error');
      return;
    }
    if (!editingId && components.some(c => c.code.toUpperCase() === formData.code.toUpperCase())) {
      showToast('This code already exists — choose a unique one', 'error');
      return;
    }

    setSaving(true);
    try {
      const isNew = !editingId;
      const method = isNew ? 'post' : 'patch';
      const url = isNew ? CTC_API : `${CTC_API}${editingId}/`;
      const payload = { ...formData, code: formData.code.toUpperCase().trim(), order: formData.order || components.length + 1 };

      const res = await (axios as any)[method](url, payload);
      const saved = res.data;

      if (isNew) setComponents(prev => [...prev, saved].sort((a, b) => a.order - b.order));
      else setComponents(prev => prev.map(c => (c._id === editingId ? saved : c)));

      showToast(isNew ? 'Component added' : 'Component updated', 'success');
      resetForm();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Error saving component', 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteComponent = async (id: string) => {
    if (!window.confirm('Delete this component permanently?')) return;
    try {
      await axios.delete(`${CTC_API}${id}/`);
      setComponents(prev => prev.filter(c => c._id !== id));
      showToast('Component deleted', 'success');
    } catch {
      showToast('Error deleting component', 'error');
    }
  };

  return (
    <Box sx={{ p: 2.5, maxWidth: 1300, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <IconButton onClick={onBack} size="small" sx={{ bgcolor: '#f8fafc', borderRadius: 1.5 }}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box flex={1}>
          <Typography fontSize={18} fontWeight={700} color="#0f172a">CTC Components</Typography>
          <Typography fontSize={12} color="text.secondary">
            Shared across salary revisions, employee letters and payslips
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={startAdd} size="small"
          sx={{ bgcolor: ACCENT, textTransform: 'none', fontWeight: 600, borderRadius: 1.5, '&:hover': { bgcolor: '#4338ca' } }}>
          Add Component
        </Button>
      </Box>

      {formOpen && (
        <Paper variant="outlined" sx={{ borderRadius: 2, p: 2.5, mb: 2.5, outline: `2px solid ${ACCENT}` }}>
          <Typography fontWeight={700} fontSize={13} mb={2}>
            {editingId ? 'Edit Component' : 'New Component'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField size="small" label="Name" value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Internet Allowance" sx={{ flex: '1 1 200px' }} />
            <TextField size="small" label="Code (unique)" value={formData.code}
              onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              placeholder="e.g. INTERNET" helperText="Uppercase, no spaces" sx={{ flex: '1 1 180px' }} />
            <TextField size="small" label="Formula" value={formData.formula}
              onChange={e => setFormData({ ...formData, formula: e.target.value })}
              placeholder="e.g. BASIC * 0.4" sx={{ flex: '1 1 220px' }} />
            <TextField size="small" label="Order" type="number" value={formData.order}
              onChange={e => setFormData({ ...formData, order: Number(e.target.value) || 0 })}
              sx={{ flex: '0 1 100px' }} />
          </Box>
          <Box sx={{ display: 'flex', gap: 3, mt: 2, alignItems: 'center' }}>
            <FormControlLabel
              control={<Checkbox size="small" checked={formData.is_active}
                onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                sx={{ color: ACCENT, '&.Mui-checked': { color: ACCENT } }} />}
              label={<Typography fontSize={12}>Active</Typography>} />
            <FormControlLabel
              control={<Checkbox size="small" checked={formData.show_in_documents}
                onChange={e => setFormData({ ...formData, show_in_documents: e.target.checked })}
                sx={{ color: ACCENT, '&.Mui-checked': { color: ACCENT } }} />}
              label={<Typography fontSize={12}>Show in Documents</Typography>} />
            <Box sx={{ flex: 1 }} />
            <Button size="small" onClick={resetForm} sx={{ textTransform: 'none' }}>Cancel</Button>
            <Button size="small" variant="contained" startIcon={saving ? <CircularProgress size={14} sx={{ color: 'white' }} /> : <SaveIcon sx={{ fontSize: 15 }} />}
              onClick={saveComponent} disabled={saving}
              sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#4338ca' }, textTransform: 'none', fontWeight: 600 }}>
              {editingId ? 'Update' : 'Add'}
            </Button>
          </Box>
        </Paper>
      )}

      <Box sx={{ bgcolor: 'white', borderRadius: 2, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {loading ? (
          <Box display="flex" justifyContent="center" py={6}><CircularProgress size={28} /></Box>
        ) : components.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary', fontSize: 13 }}>
            No components yet. Add one to get started.
          </Box>
        ) : (
          <TableContainer sx={{ maxHeight: 500, overflow: 'auto' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow sx={{ '& th': TH }}>
                  <TableCell>Order</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Code</TableCell>
                  <TableCell>Formula</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">In Docs</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {components.map(comp => (
                  <TableRow key={comp._id} sx={{ '&:hover': { bgcolor: '#f8fafc' }, borderBottom: '1px solid #f1f5f9' }}>
                    <TableCell sx={{ fontSize: 12 }}>{comp.order}</TableCell>
                    <TableCell sx={{ fontSize: 12, fontWeight: 600 }}>{comp.name}</TableCell>
                    <TableCell sx={{ fontSize: 11, fontFamily: 'monospace', color: 'text.secondary' }}>{comp.code}</TableCell>
                    <TableCell sx={{ fontSize: 11, fontFamily: 'monospace', color: 'text.secondary', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {comp.formula || '—'}
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={comp.is_active ? 'Active' : 'Inactive'}
                        sx={{ fontSize: 10, height: 20, bgcolor: comp.is_active ? '#f0fdf4' : '#fef2f2', color: comp.is_active ? '#059669' : '#dc2626' }} />
                    </TableCell>
                    <TableCell align="center" sx={{ fontSize: 13 }}>{comp.show_in_documents ? '✓' : '—'}</TableCell>
                    <TableCell align="center">
                      <Stack direction="row" justifyContent="center" spacing={0.5}>
                        <IconButton size="small" onClick={() => startEdit(comp)} sx={{ color: ACCENT }}>
                          <EditIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                        <IconButton size="small" onClick={() => comp._id && deleteComponent(comp._id)} sx={{ color: '#dc2626' }}>
                          <DeleteIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      <Typography fontSize={11} color="text.secondary" mt={2} textAlign="center">
        Changes here apply immediately to salary revisions, employee letters and any other page reading this same data.
      </Typography>
    </Box>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function DashboardView({ records, employees, loading, onSelect, onAdd, onOpenCtc, onRefresh }: {
  records:SalaryRevision[]; employees:Employee[]; loading:boolean;
  onSelect:(emp:Employee,rec?:SalaryRevision)=>void; onAdd:()=>void; onOpenCtc:()=>void; onRefresh:()=>void;
}) {
  const now=new Date();
  // Three tabs: 'action' (who's due/pending right now, by some date
  // window), 'interns' (plain Interns only — kept out of Action Needed
  // entirely, see allEmps/internEmps below), and 'history' (who's already
  // completed, optionally narrowed to PPO conversions).
  const [mainTab, setMainTab] = useState<'action'|'interns'|'history'>('action');
  // Within 'action': 'quarter' browses by fiscal quarter, 'custom' by an
  // explicit date range, 'all' shows every current employee regardless
  // of date. One dropdown picks between these, instead of separate
  // buttons for each.
  const [period, setPeriod] = useState<'quarter'|'custom'|'all'>('quarter');
  const [selFY, setSelFY] = useState(fiscalYearOf(now));
  const [selQ,  setSelQ]  = useState(fiscalQuarterOf(now));
  const [customFrom, setCustomFrom] = useState('');
  const [customTo,   setCustomTo]   = useState('');
  // Within 'history': narrows the completed roster down to PPO/full-time
  // conversions only.
  const [ppoOnly, setPpoOnly] = useState(false);
  const [search,   setSearch]   = useState('');
  const [dept,     setDept]     = useState('All');
  // Kept as two separate filters/columns even though Status (Not Yet Due,
  // Pending, Due, Done, Done Delayed) is now itself computed FROM the
  // Reminder Date and the workflow Stage together (see rowStatus below,
  // backed by cycleStatus in utils/salaryRevisionScoring.js) — Status
  // answers "how urgent is this," Stage answers "where exactly is it
  // stuck (Pending Manager vs Management vs HR vs On Hold)," and knowing
  // one doesn't tell you the other.
  const [status,   setStatus]   = useState('All');
  const [stageFilter, setStageFilter] = useState<'All'|RevisionStage|'no_revision'>('All');
  const [historyAnchor, setHistoryAnchor] = useState<{ el:HTMLElement; emp:Employee }|null>(null);
  // Row shown in the read-only "View" popup (Designation/Decision/Stage/CTC/
  // Contract) — replaces the old inline expand-row toggle.
  const [viewRow, setViewRow] = useState<{ emp:Employee; rec?:SalaryRevision }|null>(null);
  // TEMPORARY direct Stage editor, inside the View popup — hits the plain
  // PUT /:id route with only { stage }, which never calls any mail
  // sender (unlike /manager, /management, /hr). For quick data fixes
  // only; remove once the underlying stale-managerRequestedAt cleanup is
  // done and this is no longer needed.
  const [stageEditOpen, setStageEditOpen] = useState(false);
  const [stageEditValue, setStageEditValue] = useState<RevisionStage>('pending_manager');
  const [stageEditBusy, setStageEditBusy] = useState(false);
  const [stageEditError, setStageEditError] = useState('');
  // Period/Year/Quarter (or the custom range) live inside a popover behind
  // one compound "Period" button instead of three separate selects.
  const [periodAnchorEl, setPeriodAnchorEl] = useState<HTMLElement|null>(null);

  // Every revision an employee has ever had, newest first (records already
  // arrive sorted that way) — NOT collapsed to just the latest, because a
  // "completed" revision from a past cycle must not shadow a new cycle
  // that's now due (e.g. last year's completed revision shouldn't make an
  // employee whose annual review is due again this year look "done").
  const revisionMap = useMemo(()=>{
    const m=new Map<string,SalaryRevision[]>();
    records.forEach(r=>{
      const arr=m.get(r.employeeCode)||[];
      arr.push(r);
      m.set(r.employeeCode, arr);
    });
    return m;
  },[records]);

  // A "completed" revision that never actually went through the real
  // Manager -> Management -> HR workflow (no managerRequestedAt) is a
  // historical/imported placeholder — onboarding backfill, an old CTC
  // sheet import, a backfilled Intern-to-Employee conversion, etc. — not
  // an actual increment cycle the employee went through. Someone whose
  // only "revision" is one of these has never had a real Stage/Decision,
  // so it must never stand in for the current cycle's record (that would
  // show a real employee as "Completed" before their very first review is
  // even due). The real audit history (History tab) still shows it —
  // only the live Stage/Status lookup skips it.
  //
  // Separately, a handful of revisions turned out to have been auto-
  // created with a stale/incorrect anchor date (before this session's
  // due-date fixes) and were never real — hand-marked VOIDED in
  // hrDecision.notes (2026-09-15) rather than deleted, so the audit trail
  // stays intact. These are excluded the same way regardless of stage.
  const isBackfillBaseline = (r: SalaryRevision) =>
    (r.stage === 'completed' && !r.managerRequestedAt) ||
    !!r.hrDecision?.notes?.startsWith('VOIDED');

  // The revision (if any) that belongs to a given due-cycle year, identified
  // by when it was created. If an employee's only revision is from an
  // earlier year than the cycle being viewed, this returns undefined —
  // which the UI already renders as "No Record" / "Pending", correctly
  // prompting a fresh revision instead of showing the stale old one.
  const revisionForYear = useCallback((employeeId:string, year:number): SalaryRevision|undefined => {
    const list = revisionMap.get(employeeId) || [];
    return list.find(r => !isBackfillBaseline(r) && new Date(r.createdAt).getFullYear() === year);
  }, [revisionMap]);

  // Per-employee "cycle anchor" — normally the joining date, but reset by
  // an on-time annual revision or a PPO conversion (see computeAnchorDate).
  // Every "due"/"eligible"/"pending" check below reads this instead of the
  // raw joining date, so mid-term adjustments and intern→full-time
  // conversions no longer get misjudged against the original DOJ.
  const anchorDateMap = useMemo(() => {
    const map = new Map<string, Date>();
    employees.forEach(e => {
      if (!e.joining_date) return;
      const revs = revisionMap.get(e.employee_id) || [];
      map.set(e.employee_id, computeAnchorDate(e.joining_date, revs));
    });
    return map;
  }, [employees, revisionMap]);

  // An employee's REAL, currently-live cycle (if one exists) — an open,
  // non-voided revision with a real managerRequestedAt. That field is
  // self-healed by sendSalaryRevisionManagerRequest.js to the actual
  // annual-cycle date the moment the cycle really starts, so once it
  // exists it's strictly more trustworthy than re-deriving a due date
  // from computeAnchorDate. The two normally agree, but can diverge for
  // anyone whose "completed" history is an import/backfill with no real
  // historical applicableDate (e.g. a bulk "Imported from CTC revision
  // sheet" migration) — computeAnchorDate then has nothing valid to reset
  // from and falls back to the raw joining date, computing a stale/wrong
  // Due Date even though the live cycle itself is running correctly
  // (found 2026-09-15: Adesh Kumar Gupta, Shivharsh Dubey, Sumit Kumar).
  const realOpenRevisionMap = useMemo(() => {
    const map = new Map<string, SalaryRevision>();
    employees.forEach(e => {
      const revs = revisionMap.get(e.employee_id) || [];
      const openReal = revs.find(r =>
        r.stage !== 'completed' && !!r.managerRequestedAt && !r.hrDecision?.notes?.startsWith('VOIDED'));
      if (openReal) map.set(e.employee_id, openReal);
    });
    return map;
  }, [employees, revisionMap]);

  // Every active NON-INTERN employee with a joining date. Plain Interns
  // are handled entirely in their own tab (internEmps/internRows below) —
  // "Intern with PPO" is NOT excluded here, since that category is
  // treated like any other employee (its own annual anchor-date cycle),
  // matching the quarterly Salary Revision email's same distinction. No
  // 11-month tenure gate — "All Employees" should mean exactly that, and
  // quarter/custom-range browsing already correctly excludes anyone not
  // yet due via isDueInRange, so this gate was only ever doing anything
  // for the 'all' view, and there it was hiding people who just haven't
  // hit their first anniversary yet rather than showing every current
  // employee like the label promised.
  const allEmps = useMemo(
    ()=>employees.filter(e=>e.employee_category!=='Intern'&&!!e.joining_date),
    [employees]
  );
  // Plain Interns only — shown exclusively in the Interns tab, never in
  // Action Needed/History.
  const internEmps = useMemo(
    ()=>employees.filter(e=>e.employee_category==='Intern'),
    [employees]
  );
  // Department list covers every department that could ever show up in
  // ANY view mode — not just the currently-eligible-by-month set —
  // otherwise switching to Completed/PPO could show rows whose
  // department isn't even selectable in the filter.
  const depts=['All',...Array.from(new Set([
    ...allEmps.map(e=>e.department),
    ...internEmps.map(e=>e.department),
    ...records.map(r=>r.department),
  ].filter(Boolean)))];

  const employeeById = useMemo(() => {
    const m = new Map<string, Employee>();
    employees.forEach(e => m.set(e.employee_id, e));
    return m;
  }, [employees]);

  // One row per CURRENT employee: their single most recent COMPLETED
  // revision, full stop — no month or cycle-year gating. This is what
  // actually answers "who's done." A revision whose employeeCode isn't
  // found in `employeeById` belongs to someone who's since exited (the
  // /eligible-employees endpoint already excludes exited people) — those
  // are deliberately dropped, not shown via a reconstructed fallback row,
  // since Salary Revision should only ever surface current employees.
  const completedRows = useMemo(() => {
    const latest = new Map<string, SalaryRevision>();
    records.forEach(r => {
      if (r.stage !== 'completed') return;
      if (!employeeById.get(r.employeeCode)) return;
      const existing = latest.get(r.employeeCode);
      if (!existing || new Date(r.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
        latest.set(r.employeeCode, r);
      }
    });
    return Array.from(latest.values()).map(rec => ({
      emp: employeeById.get(rec.employeeCode)!,
      rec,
    }));
  }, [records, employeeById]);

  // "Who got a full-time offer" — found independently across EVERY
  // completed revision, not filtered from completedRows above. An
  // employee's PPO conversion is often an EARLIER completed revision that
  // a later, ordinary annual revision has since superseded as their
  // "most recent" one — filtering completedRows would silently lose
  // exactly those people (this is what was hiding PPO conversions that
  // already had a follow-up annual review).
  const ppoRows = useMemo(() => {
    const latest = new Map<string, SalaryRevision>();
    records.forEach(r => {
      if (r.stage !== 'completed' || !isPpoRevision(r)) return;
      if (!employeeById.get(r.employeeCode)) return;
      const existing = latest.get(r.employeeCode);
      if (!existing || new Date(r.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
        latest.set(r.employeeCode, r);
      }
    });
    return Array.from(latest.values()).map(rec => ({
      emp: employeeById.get(rec.employeeCode)!,
      rec,
    }));
  }, [records, employeeById]);

  // Every row (in the Action tab) carries its own resolved `dueDate` —
  // computed once here, rather than re-derived per-row at render time —
  // so quarter and custom-range browsing can each plug in their own due
  // date without the table needing to know which mode produced it.
  // Interns tab — every current plain-Intern, regardless of period/quarter
  // (there are typically few of them, and a pending PPO decision should
  // always be findable rather than scrolled out of the current window).
  const internRows = useMemo(() => internEmps.map(e => {
    const dueDate = e.joining_date && e.contract_period_months
      ? internReviewDate(e.joining_date, e.contract_period_months)
      : null;
    return { emp: e, rec: revisionForYear(e.employee_id, now.getFullYear()), dueDate };
  }), [internEmps, revisionForYear]);

  const baseRows = useMemo(() => {
    if (mainTab === 'history') {
      return (ppoOnly ? ppoRows : completedRows).map(r => ({ ...r, dueDate: null as Date | null }));
    }

    if (mainTab === 'interns') {
      return internRows;
    }

    if (period === 'all') {
      return allEmps.map(e => {
        // A real live cycle (see realOpenRevisionMap) always wins over the
        // anchor-derived guess — it's ground truth, not a re-derivation.
        const realRev = realOpenRevisionMap.get(e.employee_id);
        if (realRev) return { emp: e, rec: realRev, dueDate: new Date(realRev.managerRequestedAt!) };
        const dueDate = anchorDateMap.get(e.employee_id)
          ? anniversaryDateForYear(anchorDateMap.get(e.employee_id)!.toISOString(), now.getFullYear())
          : null;
        return { emp: e, rec: revisionForYear(e.employee_id, now.getFullYear()), dueDate };
      });
    }

    // Quarter / custom range — each employee's actual due-date occurrence
    // inside the selected window decides both whether they belong in
    // this view AND which calendar year's revision to look up. A single
    // shared "cycle year" doesn't work here: a Q4 fiscal quarter (Jan–
    // Mar) falls in a LATER calendar year than the fiscal year label
    // itself, so the right lookup year differs employee to employee
    // depending on which side of the window their due month lands in.
    const rangeStart = period === 'quarter'
      ? fiscalQuarterStart(selFY, selQ)
      : (customFrom ? new Date(customFrom) : null);
    const rangeEnd = period === 'quarter'
      ? fiscalQuarterEnd(selFY, selQ)
      : (customTo ? new Date(`${customTo}T23:59:59`) : null);

    if (!rangeStart || !rangeEnd) return [];

    return allEmps.flatMap(e => {
      // Same "real cycle wins" rule as the 'all' branch above — if a real
      // live cycle exists, its actual date decides whether this employee
      // belongs in the selected window, full stop; the anchor-derived
      // guess never overrides it.
      const realRev = realOpenRevisionMap.get(e.employee_id);
      if (realRev) {
        const realReminder = new Date(realRev.managerRequestedAt!);
        if (realReminder < rangeStart || realReminder > rangeEnd) return [];
        return [{ emp: e, rec: realRev, dueDate: realReminder }];
      }
      const anchor = anchorDateMap.get(e.employee_id);
      if (!anchor) return [];
      const due = isDueInRange(anchor, rangeStart, rangeEnd);
      if (!due) return [];
      return [{ emp: e, rec: revisionForYear(e.employee_id, due.getFullYear()), dueDate: due }];
    });
  }, [mainTab, period, ppoOnly, completedRows, ppoRows, allEmps, internRows, selFY, selQ, customFrom, customTo, anchorDateMap, realOpenRevisionMap, revisionForYear]);

  // Status is purely date-driven now — whether someone has any PRIOR
  // history (a real past review, or a backfilled onboarding baseline)
  // doesn't matter; only where today sits relative to this cycle's due
  // date decides the bucket. That's what "Due Again" got wrong: someone
  // on their very first-ever review looked identical to someone on their
  // fifth, when only the due-date math should matter here.
  //
  // Done Date is the real anniversary (dueDate + 1 month — the "-1 month
  // early" convention applies uniformly to both employees and interns,
  // so shifting dueDate forward always recovers it, no separate
  // computation needed).
  const rowStatus = useCallback((rec: SalaryRevision|undefined, dueDate: Date|null): Status => {
    // Done/Done Delayed always win — a closed revision is never "overdue".
    if (rec?.cycleStatus === 'done' || rec?.cycleStatus === 'done_delayed') return rec.cycleStatus;
    // Overdue is computed here, not stored in cycleStatus — it overrides
    // Pending/Due (from the backend OR the no-rec fallback below) the
    // moment the actual Due Date (dueDate here is the Reminder Date; the
    // true Due Date is 1 month later — same "-1 month early" convention
    // used everywhere else) has passed and the revision still isn't
    // done, no matter which stage it's stuck at.
    //
    // Exception: a Reminder Date before OVERDUE_ELIGIBLE_FROM predates
    // this tracking system entirely (same cutoff as ESCALATION_ELIGIBLE_FROM
    // in utils/salaryRevisionEscalation.js on the backend, used for the
    // exact same reason — Mail 5/6 already refuse to escalate this same
    // legacy backlog). Flagging it Overdue now would just be stale-data
    // noise nobody was ever tracking as active, so it reads as Not Yet
    // Due instead.
    if (dueDate) {
      const trueDueDate = new Date(dueDate.getFullYear(), dueDate.getMonth()+1, dueDate.getDate());
      if (now > trueDueDate) return dueDate < OVERDUE_ELIGIBLE_FROM ? 'not_yet_due' : 'overdue';
    }
    // Once a revision exists (and isn't overdue), the backend is the
    // source of truth — cycleStatus is computed server-side
    // (scoreOverallCycle) from the Reminder Date and the actual workflow
    // stage, not just dates, so it can't be reproduced from dueDate alone
    // here.
    if (rec?.cycleStatus) return rec.cycleStatus;
    // No revision yet for this cycle (nothing for the auto-trigger cron
    // to have created, or it simply hasn't run yet today) — the only
    // thing knowable from dates alone is whether the Reminder Date has
    // arrived.
    if (!dueDate) return 'not_yet_due';
    return now < dueDate ? 'not_yet_due' : 'pending';
  }, [now]);

  // Everything EXCEPT the Status filter itself — this is what the stat
  // cards below count, so clicking one to narrow the table down to (say)
  // just Due doesn't also collapse every other card's count to 0. They
  // always show the true distribution across search/dept/stage.
  const preStatusFiltered=useMemo(()=>baseRows.filter(({ emp, rec })=>{
    const searchOk=!search||emp.full_name.toLowerCase().includes(search.toLowerCase());
    const deptOk=dept==='All'||emp.department===dept;
    const stageOk=mainTab==='history'
      ? true
      : (stageFilter==='All'?true:stageFilter==='no_revision'?!rec:rec?.stage===stageFilter);
    return searchOk&&deptOk&&stageOk;
  }),[baseRows,mainTab,search,dept,stageFilter]);

  const filtered=useMemo(()=>preStatusFiltered.filter(({rec,dueDate})=>{
    const statusOk=mainTab==='history'
      ? true
      : (status==='All'?true:rowStatus(rec,dueDate)===status);
    return statusOk;
  }),[preStatusFiltered,mainTab,status,rowStatus]);

  const stats={
    total:preStatusFiltered.length,
    notYetDue:preStatusFiltered.filter(({rec,dueDate})=>rowStatus(rec,dueDate)==='not_yet_due').length,
    pending:preStatusFiltered.filter(({rec,dueDate})=>rowStatus(rec,dueDate)==='pending').length,
    due:preStatusFiltered.filter(({rec,dueDate})=>rowStatus(rec,dueDate)==='due').length,
    overdue:preStatusFiltered.filter(({rec,dueDate})=>rowStatus(rec,dueDate)==='overdue').length,
    done:preStatusFiltered.filter(({rec,dueDate})=>{
      const s=rowStatus(rec,dueDate);
      return s==='done'||s==='done_delayed';
    }).length,
  };

  const periodLabel = period==='all' ? 'All Time'
    : period==='custom' ? (customFrom&&customTo ? `${fmtDate(customFrom)} – ${fmtDate(customTo)}` : 'Custom Range')
    : `Q${selQ} ${fiscalYearLabel(selFY)}`;

  const compactFieldSx = { bgcolor:'white', '& .MuiInputBase-root':{ height:34, fontSize:12 }, '& .MuiSelect-select':{ display:'flex', alignItems:'center' } };

  return (
    <Box sx={{ px:2.5, pt:1, pb:2.5, maxWidth:1300, mx:'auto', ...ROOT_TOKENS }}>
      <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', mb:2, flexWrap:'wrap', gap:1.5 }}>
        <Box>
          <Typography fontSize={18} fontWeight={700} color="var(--text-primary)">Salary Revision</Typography>
          <Typography fontSize={12} color="var(--text-secondary)">
            {mainTab==='history'?(ppoOnly?'Every intern/contract employee who got a full-time offer':'Every employee whose revision is completed'):
             mainTab==='interns'?'Every current intern, pending PPO review':
             period==='all'?'All active employees':
             period==='custom'?(customFrom&&customTo?`Due between ${fmtDate(customFrom)} and ${fmtDate(customTo)}`:'Pick a date range below'):
             `Due in Q${selQ} ${fiscalYearLabel(selFY)} (${fmtDate(fiscalQuarterStart(selFY,selQ))} – ${fmtDate(fiscalQuarterEnd(selFY,selQ))})`}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <CompanyMailButton/>
          <Button variant="outlined" startIcon={<SettingsIcon/>} onClick={onOpenCtc} size="small"
            sx={{ textTransform:'none', fontWeight:600, borderRadius:1.5,
              borderColor:'var(--border)', color:'var(--text-primary)', bgcolor:'white' }}>
            CTC Components
          </Button>
          <Button variant="contained" startIcon={<AddIcon/>} onClick={onAdd} size="small"
            sx={{ bgcolor:ACCENT, textTransform:'none', fontWeight:600, borderRadius: 1.5, '&:hover':{ bgcolor:'#4338ca' } }}>
            Add Revision
          </Button>
        </Stack>
      </Box>

      <Box sx={{ borderBottom:'0.5px solid var(--border)', mb:2.5 }}>
        <Tabs value={mainTab} onChange={(_,v)=>setMainTab(v)} sx={{
          '& .MuiTab-root':{ fontSize:13, textTransform:'none', fontWeight:600, minHeight:40 },
          '& .MuiTabs-indicator':{ bgcolor:ACCENT },
          '& .Mui-selected':{ color:`${ACCENT} !important` },
        }}>
          <Tab label="Action Needed" value="action"/>
          <Tab label="Interns" value="interns"/>
          <Tab label="History" value="history"/>
        </Tabs>
      </Box>

      {mainTab!=='history'&&(
        <Box sx={{ display:'flex', gap:1.5, mb:2.5 }}>
          {[
            { label: 'Total', value: 'All' as const, count: stats.total, color: '#334155' },
            { label: 'Not Yet Due', value: 'not_yet_due' as const, count: stats.notYetDue, color: '#64748b' },
            { label: 'Pending', value: 'pending' as const, count: stats.pending, color: '#eab308' },
            { label: 'Due', value: 'due' as const, count: stats.due, color: '#d97706' },
            { label: 'Overdue', value: 'overdue' as const, count: stats.overdue, color: '#dc2626' },
            { label: 'Done', value: 'done' as const, count: stats.done, color: '#059669' },
          ].map(s=>{
            // Selected = this is the currently-applied Status filter (or
            // "Total" when no filter is applied at all) — border colour +
            // checkmark mark it, no background fill.
            const selected = status===s.value;
            return (
              <Box key={s.label} onClick={()=>setStatus(selected?'All':s.value)}
                sx={{ cursor:'pointer', flex:1, px:2, py:1.25, borderRadius:1.5,
                  display:'flex', alignItems:'center', justifyContent:'space-between', gap:1,
                  border: `1px solid ${selected?s.color:'var(--border)'}`,
                  transition:'border-color .15s',
                  '&:hover':{ borderColor:s.color },
                }}>
                <Box>
                  <Typography fontSize={20} fontWeight={700} color={s.color} lineHeight={1}>{s.count}</Typography>
                  <Typography fontSize={11} color="var(--text-secondary)" mt={0.3}>{s.label}</Typography>
                </Box>
                {selected && <CheckCircleIcon sx={{ fontSize:18, color:s.color }}/>}
              </Box>
            );
          })}
        </Box>
      )}

      {mainTab==='history'&&(
        <Box sx={{ display:'flex', gap:3, mb:2.5, flexWrap:'wrap', pb: 2, borderBottom: '0.5px solid var(--border)' }}>
          <Box>
            <Typography fontSize={20} fontWeight={700} color="var(--text-primary)" lineHeight={1}>{completedRows.length}</Typography>
            <Typography fontSize={11} color="var(--text-secondary)" mt={0.3}>Total Completed</Typography>
          </Box>
          <Box>
            <Typography fontSize={20} fontWeight={700} color="#059669" lineHeight={1}>{ppoRows.length}</Typography>
            <Typography fontSize={11} color="var(--text-secondary)" mt={0.3}>PPO Conversions</Typography>
          </Box>
        </Box>
      )}

      {mainTab!=='history'&&(
        <Box sx={{ mb:2 }}>
          <Box sx={{ display:'flex', alignItems:'center', gap:1, flexWrap:'wrap',
            bgcolor:'var(--surface-1)', borderRadius:1.5, px:1.5, py:0.75 }}>
            {mainTab==='action'&&(
              <Button
                size="small" variant="outlined" onClick={e=>setPeriodAnchorEl(e.currentTarget)}
                endIcon={<ExpandMoreIcon sx={{ fontSize:16 }}/>}
                sx={{ height:34, textTransform:'none', fontSize:12, fontWeight:600,
                  borderColor:'var(--border)', color:'var(--text-primary)', bgcolor:'white',
                  '&:hover':{ borderColor:'var(--text-accent)', bgcolor:'white' } }}>
                {periodLabel}
              </Button>
            )}

            <TextField size="small" placeholder="Search name…" value={search}
              onChange={e=>setSearch(e.target.value)} sx={{ minWidth:170, ...compactFieldSx }}/>

            <FormControl size="small" sx={{ minWidth:140, ...compactFieldSx }}>
              <Select value={dept} onChange={e=>setDept(e.target.value)}>
                {depts.map(d=><MenuItem key={d} value={d} sx={{ fontSize:12 }}>{d==='All'?'All Departments':d}</MenuItem>)}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth:150, ...compactFieldSx }}>
              <Select value={status} onChange={e=>setStatus(e.target.value)}>
                {[['All','All Statuses'],['not_yet_due','Not Yet Due'],['pending','Pending'],
                  ['due','Due'],['overdue','Overdue'],['done','Done'],['done_delayed','Done Delayed'],
                ].map(([v,l])=><MenuItem key={v} value={v} sx={{ fontSize:12 }}>{l}</MenuItem>)}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth:170, ...compactFieldSx }}>
              <Select value={stageFilter} onChange={e=>setStageFilter(e.target.value as typeof stageFilter)}>
                {[['All','All Stages'],['no_revision','No Revision'],
                  ['pending_manager','Pending Manager'],['pending_management','Pending Management'],
                  ['pending_hr','Pending HR'],['on_hold','On Hold'],['completed','Completed'],
                ].map(([v,l])=><MenuItem key={v} value={v} sx={{ fontSize:12 }}>{l}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>

          {mainTab==='action'&&(
            <Popover
              open={!!periodAnchorEl}
              anchorEl={periodAnchorEl}
              onClose={()=>setPeriodAnchorEl(null)}
              anchorOrigin={{ vertical:'bottom', horizontal:'left' }}
            >
              <Box sx={{ p:2, minWidth:250 }}>
                <FormControl size="small" fullWidth sx={{ mb: period!=='all' ? 1.5 : 0 }}>
                  <InputLabel sx={{ fontSize:12 }}>Period</InputLabel>
                  <Select value={period} label="Period" onChange={e=>setPeriod(e.target.value as typeof period)} sx={{ fontSize:12 }}>
                    <MenuItem value="quarter" sx={{ fontSize:12 }}>This Quarter</MenuItem>
                    <MenuItem value="all" sx={{ fontSize:12 }}>All Time</MenuItem>
                    <MenuItem value="custom" sx={{ fontSize:12 }}>Custom Range</MenuItem>
                  </Select>
                </FormControl>
                {period==='quarter'&&(
                  <Box sx={{ display:'flex', gap:1.5 }}>
                    <FormControl size="small" sx={{ minWidth:130 }}>
                      <InputLabel sx={{ fontSize:12 }}>Year</InputLabel>
                      <Select value={selFY} label="Year" onChange={e=>setSelFY(Number(e.target.value))} sx={{ fontSize:12 }}>
                        {Array.from({ length:6 }, (_,i)=>fiscalYearOf(now)-4+i).map(fy=>(
                          <MenuItem key={fy} value={fy} sx={{ fontSize:12 }}>{fiscalYearLabel(fy)}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth:100 }}>
                      <InputLabel sx={{ fontSize:12 }}>Quarter</InputLabel>
                      <Select value={selQ} label="Quarter" onChange={e=>setSelQ(Number(e.target.value))} sx={{ fontSize:12 }}>
                        {[1,2,3,4].map(q=><MenuItem key={q} value={q} sx={{ fontSize:12 }}>{`Q${q}`}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Box>
                )}
                {period==='custom'&&(
                  <Box sx={{ display:'flex', gap:1.5 }}>
                    <TextField label="From" type="date" size="small" value={customFrom}
                      onChange={e=>setCustomFrom(e.target.value)} InputLabelProps={{ shrink:true }} sx={{ minWidth:150 }}/>
                    <TextField label="To" type="date" size="small" value={customTo}
                      onChange={e=>setCustomTo(e.target.value)} InputLabelProps={{ shrink:true }} sx={{ minWidth:150 }}/>
                  </Box>
                )}
              </Box>
            </Popover>
          )}
        </Box>
      )}

      {mainTab==='history'&&(
        <Box sx={{ display:'flex', alignItems:'center', gap:1.5, mb:2, flexWrap:'wrap',
          bgcolor:'var(--surface-1)', borderRadius:1.5, px:1.5, py:0.75 }}>
          <TextField size="small" placeholder="Search name…" value={search}
            onChange={e=>setSearch(e.target.value)} sx={{ minWidth:170, ...compactFieldSx }}/>
          <FormControl size="small" sx={{ minWidth:140, ...compactFieldSx }}>
            <Select value={dept} onChange={e=>setDept(e.target.value)}>
              {depts.map(d=><MenuItem key={d} value={d} sx={{ fontSize:12 }}>{d==='All'?'All Departments':d}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControlLabel
            control={<Checkbox size="small" checked={ppoOnly} onChange={e=>setPpoOnly(e.target.checked)}
              sx={{ color:'var(--text-accent)', '&.Mui-checked':{ color:'var(--text-accent)' } }}/>}
            label={<Typography fontSize={12} color="var(--text-secondary)">PPO conversions only</Typography>}/>
        </Box>
      )}

      <Box sx={{ bgcolor:'white', borderRadius:2, border:'1px solid var(--border)', overflow:'hidden' }}>
        {loading?<Box display="flex" justifyContent="center" py={6}><CircularProgress size={28}/></Box>:(
          <TableContainer sx={{ maxHeight:460, overflow:'auto' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow sx={{ '& th':TH }}>
                  <TableCell>Employee</TableCell>
                  <TableCell>Department</TableCell>
                  <TableCell>DOJ</TableCell>
                  {mainTab==='history'&&<TableCell>Completed On</TableCell>}
                  {mainTab!=='history'&&<TableCell>Due Date</TableCell>}
                  <TableCell>Status</TableCell>
                  {mainTab!=='history'&&<TableCell>Stage</TableCell>}
                  {mainTab!=='history'&&<TableCell>Score</TableCell>}
                  <TableCell align="center">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.length===0&&(
                  <TableRow><TableCell colSpan={mainTab==='history'?6:8} align="center" sx={{ py:6, color:'var(--text-secondary)', fontSize:13 }}>
                    {mainTab==='history'?(ppoOnly?'No full-time conversions yet':'No completed revisions yet'):
                     mainTab==='interns'?'No interns found':
                     period==='all'?'No employees found':
                     period==='custom'?(customFrom&&customTo?'No employees due in this range':'Pick a From and To date above'):
                     `No employees due in Q${selQ} ${fiscalYearLabel(selFY)}`}
                  </TableCell></TableRow>
                )}
                {filtered.map(({ emp, rec, dueDate })=>{
                  // Highlight if the resolved due date falls in the
                  // CURRENT fiscal quarter — same "needs attention now"
                  // signal the old bold-if-this-month highlight gave,
                  // just aligned to fiscal quarters instead of months.
                  const isThisQuarter = !!dueDate
                    && fiscalQuarterOf(dueDate) === fiscalQuarterOf(now)
                    && fiscalYearOf(dueDate) === fiscalYearOf(now);
                  const completedOn = rec?.applicableDate || rec?.createdAt;
                  // The exact/true due date — the real anniversary or
                  // contract end, one month after the reminder date shown
                  // in the previous column (same "-1 month early" offset
                  // used everywhere else in this file).
                  const trueDueDate = dueDate
                    ? new Date(dueDate.getFullYear(), dueDate.getMonth()+1, dueDate.getDate())
                    : null;
                  const st = mainTab==='history' ? ('done' as Status) : rowStatus(rec,dueDate);
                  const isDoneStatus = st==='done' || st==='done_delayed';
                  return (
                    <React.Fragment key={emp._id}>
                      <TableRow onClick={()=>onSelect(emp,rec)}
                        sx={{ cursor:'pointer', '&:hover':{ bgcolor:'var(--surface-1)' },
                          borderBottom: '0.5px solid var(--border)' }}>
                        <TableCell sx={TD}>
                          <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
                            <Avatar sx={{ width:26, height:26, bgcolor:'var(--text-accent)', fontSize:10, fontWeight:700 }}>{initials(emp.full_name)}</Avatar>
                            <Typography fontSize={12} fontWeight={600} color="var(--text-primary)">{emp.full_name}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ ...TD, color:'var(--text-secondary)' }}>{emp.department||'—'}</TableCell>
                        <TableCell sx={{ ...TD, color:'var(--text-secondary)' }}>{fmtDate(emp.joining_date)}</TableCell>
                        {mainTab==='history'&&(
                          <TableCell sx={TD}>
                            <Box>
                              <Typography component="span" fontSize={12} fontWeight={600} color="var(--text-primary)">{fmtDate(completedOn)}</Typography>
                              {rec && isPpoRevision(rec) && (
                                <Box mt={0.4}><OutlineBadge label="Full-Time Offer" color="#059669"/></Box>
                              )}
                            </Box>
                          </TableCell>
                        )}
                        {/* Reminder Date is still computed (dueDate/isThisQuarter
                            below, and feeds Status/Due Date) and saved on the
                            revision — it's just not shown as its own column here. */}
                        {mainTab!=='history'&&(
                          <TableCell sx={TD}>
                            <Typography component="span" fontSize={12} fontWeight={isThisQuarter?700:400} color="var(--text-secondary)">
                              {trueDueDate?fmtDate(trueDueDate.toISOString()):'—'}
                            </Typography>
                          </TableCell>
                        )}
                        <TableCell sx={TD}>
                          <StatusChip status={st}/>
                        </TableCell>
                        {mainTab!=='history'&&(
                          <TableCell sx={TD}>
                            {rec ? <StageChip stage={rec.stage}/> : <Typography fontSize={12} color="var(--text-secondary)">—</Typography>}
                          </TableCell>
                        )}
                        {mainTab!=='history'&&(
                          <TableCell sx={TD}>
                            {rec?.cycleScore!=null ? (
                              <Typography component="span" fontSize={12} fontWeight={700}
                                color={rec.cycleScore<0?'#dc2626':'var(--text-secondary)'}>
                                {rec.cycleScore}
                              </Typography>
                            ) : <Typography fontSize={12} color="var(--text-secondary)">—</Typography>}
                          </TableCell>
                        )}
                        <TableCell sx={{ ...TD, textAlign:'center' }}>
                          <Box sx={{ display:'flex', alignItems:'center', justifyContent:'center', gap:0.5 }}>
                            <Tooltip title="View">
                              <IconButton size="small" onClick={e=>{ e.stopPropagation(); setViewRow({ emp, rec }); }}
                                sx={{ p:0.5, bgcolor:'#eef2ff', color:'#4f46e5', '&:hover':{ bgcolor:'#e0e7ff' } }}>
                                <VisibilityIcon sx={{ fontSize:14 }}/>
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Update">
                              <IconButton size="small" onClick={e=>{ e.stopPropagation(); onSelect(emp,rec); }}
                                sx={{ p:0.5, bgcolor:'#f8fafc', color:'#64748b', border:'1px solid #e2e8f0', '&:hover':{ bgcolor:'#f1f5f9' } }}>
                                <EditIcon sx={{ fontSize:14 }}/>
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      <Popover
        open={!!historyAnchor}
        anchorEl={historyAnchor?.el}
        onClose={()=>setHistoryAnchor(null)}
        anchorOrigin={{ vertical:'bottom', horizontal:'left' }}
        onClick={(e)=>e.stopPropagation()}
      >
        <Box sx={{ p:2, minWidth:260, maxWidth:340 }}>
          <Typography fontSize={12} fontWeight={700} mb={1}>
            {historyAnchor?.emp.full_name} — Contract History
          </Typography>
          <Stack spacing={0.75}>
            {(historyAnchor?.emp.contract_history||[]).map((p,i,arr)=>{
              const isLatest=i===arr.length-1;
              return (
                <Box key={i} sx={{ display:'flex', justifyContent:'space-between', gap:2, p:0.75,
                  bgcolor:isLatest?'#f0fdf4':'var(--surface-1)', borderRadius:1 }}>
                  <Typography fontSize={11} color={isLatest?'#059669':'text.secondary'} fontWeight={isLatest?600:400}>
                    Contract {i+1}{isLatest?' (current)':''}
                  </Typography>
                  <Typography fontSize={11} fontWeight={500} textAlign="right">
                    {fmtDate(p.start_date)} → {p.end_date?fmtDate(p.end_date):'Ongoing'}
                  </Typography>
                </Box>
              );
            })}
          </Stack>
        </Box>
      </Popover>

      {/* Read-only "View" popup — replaces the old inline expand-row toggle,
          same fields (Designation/Decision/Stage/CTC/Contract) as before. */}
      <Modal open={!!viewRow} onClose={()=>{ setViewRow(null); setStageEditOpen(false); setStageEditError(''); }}>
        <Box sx={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
          width:{ xs:'95vw', md:560 }, maxHeight:'85vh', overflow:'auto',
          bgcolor:'white', borderRadius:2, border:'1px solid #e2e8f0', outline:'none' }}>
          {viewRow && (()=>{
            const { emp, rec } = viewRow;
            const isDoneStatus = rec ? ['completed'].includes(rec.stage) : false;
            return (
              <>
                <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                  p:2, borderBottom:'1px solid #e2e8f0', position:'sticky', top:0, bgcolor:'white', zIndex:1 }}>
                  <Box sx={{ display:'flex', alignItems:'center', gap:1.25 }}>
                    <Avatar sx={{ width:30, height:30, bgcolor:'var(--text-accent)', fontSize:12, fontWeight:700 }}>{initials(emp.full_name)}</Avatar>
                    <Box>
                      <Typography fontSize={13} fontWeight={700}>{emp.full_name}</Typography>
                      <Typography fontSize={11} color="text.secondary">{emp.designation} · {emp.department}</Typography>
                    </Box>
                  </Box>
                  <IconButton size="small" onClick={()=>{ setViewRow(null); setStageEditOpen(false); setStageEditError(''); }}><CloseIcon fontSize="small"/></IconButton>
                </Box>
                <Box sx={{ p:2.5, display:'flex', flexDirection:'column', gap:2 }}>
                  <Box>
                    <Typography fontSize={10} fontWeight={700} color="var(--text-secondary)" mb={0.6}>DESIGNATION</Typography>
                    <Box sx={{ display:'flex', alignItems:'center', gap:0.7, flexWrap:'wrap' }}>
                      <Typography fontSize={12} fontWeight={600} color="var(--text-secondary)">{emp.designation||'—'}</Typography>
                      {rec?.designationChanged && <OutlineBadge label="changed" color={ACCENT}/>}
                    </Box>
                  </Box>

                  <Divider sx={{ borderColor:'var(--border)' }}/>

                  <Box>
                    <Typography fontSize={10} fontWeight={700} color="var(--text-secondary)" mb={0.6}>DECISION &amp; STAGE</Typography>
                    {rec ? (
                      <>
                        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                          <DecisionChip decision={rec.managerDecision?.decision} isPpo={isPpoRevision(rec)}/>
                          {stageEditOpen ? (
                            <>
                              <FormControl size="small" sx={{ minWidth:170 }}>
                                <Select value={stageEditValue} onChange={e=>setStageEditValue(e.target.value as RevisionStage)}
                                  sx={{ fontSize:12, height:30 }}>
                                  <MenuItem value="pending_manager" sx={{ fontSize:12 }}>Pending Manager</MenuItem>
                                  <MenuItem value="pending_management" sx={{ fontSize:12 }}>Pending Management</MenuItem>
                                  <MenuItem value="pending_hr" sx={{ fontSize:12 }}>Pending HR</MenuItem>
                                  <MenuItem value="on_hold" sx={{ fontSize:12 }}>On Hold</MenuItem>
                                  <MenuItem value="completed" sx={{ fontSize:12 }}>Completed</MenuItem>
                                </Select>
                              </FormControl>
                              <IconButton size="small" disabled={stageEditBusy} onClick={async ()=>{
                                setStageEditBusy(true); setStageEditError('');
                                try {
                                  const { data } = await axios.put(`${API}/${rec._id}`, { stage: stageEditValue });
                                  if (!data.success) throw new Error(data.message || 'Save failed');
                                  setViewRow({ emp, rec: { ...rec, ...data.data } });
                                  setStageEditOpen(false);
                                  onRefresh();
                                } catch (err: any) {
                                  setStageEditError(err?.response?.data?.message || err?.message || 'Save failed');
                                } finally {
                                  setStageEditBusy(false);
                                }
                              }}>
                                {stageEditBusy ? <CircularProgress size={14}/> : <CheckCircleIcon sx={{ fontSize:16, color:'#059669' }}/>}
                              </IconButton>
                              <IconButton size="small" disabled={stageEditBusy}
                                onClick={()=>{ setStageEditOpen(false); setStageEditError(''); }}>
                                <CloseIcon sx={{ fontSize:16 }}/>
                              </IconButton>
                            </>
                          ) : (
                            <>
                              <StageChip stage={rec.stage}/>
                              <IconButton size="small" sx={{ p:0.3 }}
                                onClick={()=>{ setStageEditValue(rec.stage); setStageEditOpen(true); setStageEditError(''); }}>
                                <EditIcon sx={{ fontSize:14, color:'var(--text-secondary)' }}/>
                              </IconButton>
                            </>
                          )}
                        </Stack>
                        {stageEditOpen && (
                          <Typography fontSize={10} color="var(--text-secondary)" mt={0.5}>
                            Temporary direct edit — updates the stage only, no mail is sent.
                          </Typography>
                        )}
                        {stageEditError && (
                          <Typography fontSize={11} color="#dc2626" mt={0.5}>{stageEditError}</Typography>
                        )}
                      </>
                    ) : <Typography fontSize={12} color="var(--text-secondary)">No revision record</Typography>}
                  </Box>

                  <Divider sx={{ borderColor:'var(--border)' }}/>

                  <Box>
                    <Typography fontSize={10} fontWeight={700} color="var(--text-secondary)" mb={0.6}>PREV. CTC → NEW CTC</Typography>
                    <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
                      <Typography fontSize={12} color="var(--text-secondary)">{fmtCurrency(rec?.previousCtc ?? emp.annual_ctc)}</Typography>
                      <Typography fontSize={11} color="var(--text-secondary)">→</Typography>
                      <Typography fontSize={13} fontWeight={700} color={isDoneStatus?'#059669':'var(--text-primary)'}>
                        {rec?fmtCurrency(rec.newCtc):'—'}
                      </Typography>
                    </Box>
                  </Box>

                  <Divider sx={{ borderColor:'var(--border)' }}/>

                  <Box>
                    <Typography fontSize={10} fontWeight={700} color="var(--text-secondary)" mb={0.6}>CONTRACT</Typography>
                    {emp.contract_start_date ? (
                      <>
                        <Typography fontSize={12} color="var(--text-secondary)">
                          {fmtDate(emp.contract_start_date)} → {emp.contract_end_date?fmtDate(emp.contract_end_date):'Ongoing'}
                        </Typography>
                        {(emp.contract_history?.length||0)>1 && (
                          <Typography component="span" onClick={(e)=>{ e.stopPropagation(); setHistoryAnchor({ el:e.currentTarget, emp }); }}
                            sx={{ display:'block', fontSize:11, color:'var(--text-accent)', cursor:'pointer', fontWeight:600, mt:0.3, '&:hover':{ textDecoration:'underline' } }}>
                            Previous Contract
                          </Typography>
                        )}
                      </>
                    ) : <Typography fontSize={12} color="var(--text-secondary)">—</Typography>}
                  </Box>
                </Box>
              </>
            );
          })()}
        </Box>
      </Modal>
    </Box>
  );
}

// ─── Mail Queue ───────────────────────────────────────────────────────────────
// Every Salary Revision mail (Mail 1-6, HR notify, the quarterly digest)
// lands as an editable draft instead of sending itself — see
// utils/salaryRevisionMailQueue.js and each sender in emails/senders/ on
// the backend. There's no separate queue screen — each mail shows up
// inline on the exact step of the revision detail view it belongs to
// (RevisionMailButtons below, embedded in the Manager/Management/HR
// cards in RevisionDetailView). A "Send Mail" button appears there once a
// draft exists, and disappears for good the moment it's actually sent —
// drafts are one-shot, never resendable from here. Only Admin/HR ever
// see this at all, per "only HR can send them via dashboard" (2026-09-15).

const MAIL_TYPE_LABEL: Record<string,string> = {
  managerRequest: 'Request Manager',
  managementApproval: 'Management Approval',
  pipHold: 'PIP Hold Notice',
  hrNotify: 'HR Notify',
  managerEscalation: 'Reminder to Manager',
  finalEscalation: 'Escalate Delay to Management',
  employeeConfirmation: 'Employee Confirmation',
  quarterlyDigest: 'Quarterly Due Digest',
};

interface MailDraft {
  _id: string;
  revisionId: string | null;
  mailType: string;
  employeeName: string;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  html: string;
  status: 'draft'|'sent'|'discarded';
  createdAt: string;
  sentAt: string | null;
  sentBy: string;
}

const DRAFTS_API = `${API_URL}/salary-revision-mail-drafts`;

// Every recurring mail that isn't about any single employee's revision —
// currently just the quarterly "due this quarter" digest to Management
// (revisionId: null). Mirrors the cron schedule in emails/scheduler.js
// exactly ('0 9 1 4,7,10,1 *' — 9am on the 1st of Apr/Jul/Oct/Jan) so the
// "next fires" date shown here can never drift from what the backend
// actually does. A future monthly mail would just add a second entry
// here with its own computeNext.
const COMPANY_MAIL_SCHEDULE: { mailType: string; label: string; computeNext: (from: Date) => Date }[] = [
  {
    mailType: 'quarterlyDigest',
    label: 'Quarterly Due Digest',
    computeNext: (from) => {
      const fireMonths = [3, 6, 9, 0]; // Apr, Jul, Oct, Jan (0-indexed)
      const candidates: Date[] = [];
      for (const yr of [from.getFullYear(), from.getFullYear() + 1]) {
        for (const m of fireMonths) candidates.push(new Date(yr, m, 1, 9, 0, 0));
      }
      candidates.sort((a, b) => a.getTime() - b.getTime());
      return candidates.find(d => d > from)!;
    },
  },
];

// Button for company-wide mail — mail that isn't tied to any single
// employee's revision, so it has nowhere to show up on a per-revision
// card. Always visible for Admin/HR (never for anyone else), even with
// nothing queued yet — it lists every known recurring mail type and its
// next scheduled fire date, not just what's already a draft, so it
// doubles as "what's coming up" rather than only "what's actionable now".
function CompanyMailButton() {
  const role = localStorage.getItem('role') || '';
  const canSeeMail = role === 'Admin' || role === 'HR';

  const [drafts, setDrafts] = useState<MailDraft[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MailDraft|null>(null);
  const [editTo, setEditTo] = useState('');
  const [editCc, setEditCc] = useState('');
  const [editBcc, setEditBcc] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [editHtml, setEditHtml] = useState('');
  const bodyEditorRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!canSeeMail) return;
    try {
      const { data } = await axios.get(`${DRAFTS_API}?unassigned=true&status=draft`);
      setDrafts(data.data || []);
    } catch { /* quiet — a failed fetch just means the list falls back to schedule-only rows */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSeeMail]);

  useEffect(() => { load(); }, [load]);

  if (!canSeeMail) return null;

  const openEdit = (d: MailDraft) => {
    setEditing(d);
    setEditTo(d.to); setEditCc(d.cc || ''); setEditBcc(d.bcc || '');
    setEditSubject(d.subject); setEditHtml(d.html);
    setError('');
  };

  const sendMail = async () => {
    if (!editing) return;
    setBusy(true);
    setError('');
    try {
      const html = bodyEditorRef.current?.innerHTML ?? editHtml;
      const saveRes = await axios.put(`${DRAFTS_API}/${editing._id}`, {
        to: editTo, cc: editCc, bcc: editBcc, subject: editSubject, html,
      });
      if (!saveRes.data.success) throw new Error(saveRes.data.message || 'Save failed');

      const sendRes = await axios.post(`${DRAFTS_API}/${editing._id}/send`);
      if (!sendRes.data.success) throw new Error(sendRes.data.message || 'Send failed');

      setEditing(null);
      load();
    } catch (e:any) { setError(e?.response?.data?.message || e?.message || 'Send failed'); }
    finally { setBusy(false); }
  };

  return (
    <>
      <Badge badgeContent={drafts.length} color="error">
        <Button size="small" variant="outlined" startIcon={<MailIcon sx={{ fontSize:16 }}/>}
          onClick={()=>setOpen(true)}
          sx={{ textTransform:'none', fontWeight:600, fontSize:12, borderRadius:1.5,
            borderColor:'var(--border)', color:'var(--text-primary)', bgcolor:'white' }}>
          Company Mail
        </Button>
      </Badge>

      <Modal open={open} onClose={()=>{ if (!busy) { setOpen(false); setEditing(null); } }}>
        <Box sx={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
          width:{ xs:'95vw', md:640 }, maxHeight:'85vh', overflow:'auto',
          bgcolor:'white', borderRadius:2, border:'1px solid #e2e8f0', outline:'none', p:2.5 }}>
          {!editing ? (
            <>
              <Typography fontSize={14} fontWeight={700} mb={2}>Company-Wide Mail</Typography>
              <Stack spacing={1}>
                {COMPANY_MAIL_SCHEDULE.map(sched => {
                  const draft = drafts.find(d => d.mailType === sched.mailType);
                  return (
                    <Box key={sched.mailType} sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:1,
                      p:1.25, border:'1px solid #e2e8f0', borderRadius:1.5 }}>
                      <Box>
                        <Typography fontSize={12} fontWeight={600}>{MAIL_TYPE_LABEL[sched.mailType] || sched.label}</Typography>
                        <Typography fontSize={11} color="text.secondary">
                          {draft ? draft.subject : `Not queued yet — next fires ${fmtDate(sched.computeNext(new Date()).toISOString())}`}
                        </Typography>
                      </Box>
                      {draft ? (
                        <Button size="small" variant="outlined" onClick={()=>openEdit(draft)}
                          sx={{ textTransform:'none', fontSize:11, py:0.2, px:1, minWidth:0, borderColor:ACCENT, color:ACCENT }}>
                          Send Mail
                        </Button>
                      ) : (
                        <Chip size="small" label="Scheduled" sx={{ fontSize:10, height:20, bgcolor:'#f8fafc', color:'#94a3b8' }}/>
                      )}
                    </Box>
                  );
                })}
              </Stack>
            </>
          ) : (
            <Stack spacing={2}>
              <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
                <IconButton size="small" onClick={()=>setEditing(null)} disabled={busy}><ArrowBackIcon fontSize="small"/></IconButton>
                <Typography fontSize={14} fontWeight={700}>{MAIL_TYPE_LABEL[editing.mailType] || editing.mailType}</Typography>
              </Box>
              {error && <Alert severity="error" sx={{ fontSize:12 }} onClose={()=>setError('')}>{error}</Alert>}
              <TextField label="To" size="small" fullWidth value={editTo} onChange={e=>setEditTo(e.target.value)} disabled={busy}/>
              <TextField label="Cc" size="small" fullWidth value={editCc} onChange={e=>setEditCc(e.target.value)} disabled={busy}/>
              <TextField label="Bcc" size="small" fullWidth value={editBcc} onChange={e=>setEditBcc(e.target.value)} disabled={busy}/>
              <TextField label="Subject" size="small" fullWidth value={editSubject} onChange={e=>setEditSubject(e.target.value)} disabled={busy}/>
              <Box>
                <Typography fontSize={12} color="text.secondary" mb={0.5}>Body</Typography>
                <Box
                  key={editing._id}
                  ref={bodyEditorRef}
                  contentEditable={!busy}
                  suppressContentEditableWarning
                  dangerouslySetInnerHTML={{ __html: editHtml }}
                  sx={{
                    border:'1px solid #cbd5e1', borderRadius:1, p:1.5, minHeight:200, maxHeight:380,
                    overflow:'auto', fontSize:13, lineHeight:1.6, bgcolor: busy?'#f8fafc':'#fff',
                    '&:focus':{ outline:`2px solid ${ACCENT}`, outlineOffset:-1 },
                  }}
                />
              </Box>
              <Box sx={{ display:'flex', gap:1.5 }}>
                <Button variant="contained" onClick={sendMail} disabled={busy}
                  sx={{ bgcolor:'#059669', '&:hover':{ bgcolor:'#047857' }, textTransform:'none', fontWeight:600 }}>
                  {busy?<CircularProgress size={18} sx={{ color:'white' }}/>:'Send Mail'}
                </Button>
                <Button variant="outlined" onClick={()=>setEditing(null)} disabled={busy} sx={{ textTransform:'none' }}>Cancel</Button>
              </Box>
            </Stack>
          )}
        </Box>
      </Modal>
    </>
  );
}

// Inline "Send Mail" control for one revision's relevant mail types — used
// three times in RevisionDetailView's Decision tab (Manager/Management/HR
// cards), each passed only the mail type(s) that belong to that step. A
// draft shows a "Send Mail" button; once actually sent it flips to a
// plain "Sent" badge and the button is gone for good — no re-send path
// exists from here. Renders nothing at all for a non-Admin/HR viewer (a
// Manager looking at their own revision sees no mail UI whatsoever), and
// the backend's requireRole on every one of these routes enforces the
// exact same restriction independently.
function RevisionMailButtons({ revisionId, mailTypes }: { revisionId?: string; mailTypes: string[] }) {
  const role = localStorage.getItem('role') || '';
  const canSeeMail = role === 'Admin' || role === 'HR';
  const mailTypesKey = mailTypes.join(',');

  const [drafts, setDrafts] = useState<MailDraft[]>([]);
  const [editing, setEditing] = useState<MailDraft|null>(null);
  const [editTo, setEditTo] = useState('');
  const [editCc, setEditCc] = useState('');
  const [editBcc, setEditBcc] = useState('');
  const [editSubject, setEditSubject] = useState('');
  // Same convention as the old Mail Queue's editor — the visible body is
  // the RENDERED contentEditable div, editHtml only a fallback.
  const [editHtml, setEditHtml] = useState('');
  const bodyEditorRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!canSeeMail || !revisionId) return;
    try {
      const { data } = await axios.get(`${DRAFTS_API}?status=all&revisionId=${revisionId}`);
      const all: MailDraft[] = data.data || [];
      // Fixed sequence order (Request Manager -> Reminder to Manager ->
      // Escalate Delay to Management), not creation-time order — the
      // `wanted` array's own order IS that sequence, since callers always
      // pass mailTypes in the order the step actually happens.
      const wanted = mailTypesKey.split(',');
      setDrafts(
        all
          .filter(d => wanted.includes(d.mailType))
          .sort((a, b) => wanted.indexOf(a.mailType) - wanted.indexOf(b.mailType))
      );
    } catch { /* secondary panel — a failed load here shouldn't block the revision UI */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revisionId, canSeeMail, mailTypesKey]);

  useEffect(() => { load(); }, [load]);

  if (!canSeeMail || !revisionId || !drafts.length) return null;

  const openEdit = (d: MailDraft) => {
    setEditing(d);
    setEditTo(d.to); setEditCc(d.cc || ''); setEditBcc(d.bcc || '');
    setEditSubject(d.subject); setEditHtml(d.html);
    setError('');
  };

  // One action, not two — edits are saved and the mail is dispatched in
  // the same click, under the same loader, rather than a separate
  // Save-then-Send flow.
  const sendMail = async () => {
    if (!editing) return;
    setBusy(true);
    setError('');
    try {
      const html = bodyEditorRef.current?.innerHTML ?? editHtml;
      const saveRes = await axios.put(`${DRAFTS_API}/${editing._id}`, {
        to: editTo, cc: editCc, bcc: editBcc, subject: editSubject, html,
      });
      if (!saveRes.data.success) throw new Error(saveRes.data.message || 'Save failed');

      const sendRes = await axios.post(`${DRAFTS_API}/${editing._id}/send`);
      if (!sendRes.data.success) throw new Error(sendRes.data.message || 'Send failed');

      setEditing(null);
      load();
    } catch (e:any) { setError(e?.response?.data?.message || e?.message || 'Send failed'); }
    finally { setBusy(false); }
  };

  return (
    <Box sx={{ mt:1.5, pt:1.5, borderTop:'1px dashed #e2e8f0' }}>
      <Stack spacing={0.75}>
        {drafts.map(d=>(
          <Box key={d._id} sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:1 }}>
            <Typography fontSize={11} color="text.secondary">{MAIL_TYPE_LABEL[d.mailType] || d.mailType}</Typography>
            {d.status==='draft' ? (
              <Button size="small" variant="outlined" onClick={()=>openEdit(d)}
                sx={{ textTransform:'none', fontSize:11, py:0.2, px:1, minWidth:0, borderColor:ACCENT, color:ACCENT }}>
                Send Mail
              </Button>
            ) : d.status==='sent' ? (
              <Chip size="small" icon={<CheckCircleIcon sx={{ fontSize:'12px !important' }}/>}
                label={`Sent${d.sentBy?` · ${d.sentBy}`:''}`}
                sx={{ fontSize:10, height:20, bgcolor:'#f0fdf4', color:'#059669', '& .MuiChip-icon':{ color:'inherit' } }}/>
            ) : (
              <Chip size="small" label="Discarded" sx={{ fontSize:10, height:20, bgcolor:'#f8fafc', color:'#94a3b8' }}/>
            )}
          </Box>
        ))}
      </Stack>

      <Modal open={!!editing} onClose={()=>{ if (!busy) setEditing(null); }}>
        <Box sx={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
          width:{ xs:'95vw', md:640 }, maxHeight:'85vh', overflow:'auto',
          bgcolor:'white', borderRadius:2, border:'1px solid #e2e8f0', outline:'none', p:2.5 }}>
          <Typography fontSize={14} fontWeight={700} mb={2}>
            {editing ? (MAIL_TYPE_LABEL[editing.mailType] || editing.mailType) : ''}
          </Typography>
          {editing && (
            <Stack spacing={2}>
              {error && <Alert severity="error" sx={{ fontSize:12 }} onClose={()=>setError('')}>{error}</Alert>}
              <TextField label="To" size="small" fullWidth value={editTo} onChange={e=>setEditTo(e.target.value)} disabled={busy}/>
              <TextField label="Cc" size="small" fullWidth value={editCc} onChange={e=>setEditCc(e.target.value)} disabled={busy}/>
              <TextField label="Bcc" size="small" fullWidth value={editBcc} onChange={e=>setEditBcc(e.target.value)} disabled={busy}/>
              <TextField label="Subject" size="small" fullWidth value={editSubject} onChange={e=>setEditSubject(e.target.value)} disabled={busy}/>
              <Box>
                <Typography fontSize={12} color="text.secondary" mb={0.5}>Body</Typography>
                <Box
                  key={editing._id}
                  ref={bodyEditorRef}
                  contentEditable={!busy}
                  suppressContentEditableWarning
                  dangerouslySetInnerHTML={{ __html: editHtml }}
                  sx={{
                    border:'1px solid #cbd5e1', borderRadius:1, p:1.5, minHeight:200, maxHeight:380,
                    overflow:'auto', fontSize:13, lineHeight:1.6, bgcolor: busy?'#f8fafc':'#fff',
                    '&:focus':{ outline:`2px solid ${ACCENT}`, outlineOffset:-1 },
                  }}
                />
              </Box>
              <Box sx={{ display:'flex', gap:1.5 }}>
                <Button variant="contained" onClick={sendMail} disabled={busy}
                  sx={{ bgcolor:'#059669', '&:hover':{ bgcolor:'#047857' }, textTransform:'none', fontWeight:600 }}>
                  {busy?<CircularProgress size={18} sx={{ color:'white' }}/>:'Send Mail'}
                </Button>
                <Button variant="outlined" onClick={()=>setEditing(null)} disabled={busy} sx={{ textTransform:'none' }}>Cancel</Button>
              </Box>
            </Stack>
          )}
        </Box>
      </Modal>
    </Box>
  );
}

// ─── History panel ────────────────────────────────────────────────────────────

function HistoryPanel({ employeeCode }: { employeeCode: string }) {
  const [history, setHistory] = useState<SalaryRevision[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRevision, setSelectedRevision] = useState<SalaryRevision | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editValues, setEditValues] = useState<any>({
    applicableDate: '',
    previousCtc: '',
    newCtc: '',
    finalIncrementPct: '',
    stage: 'pending_manager',
    designationChanged: false,
    previousDesignation: '',
    newDesignation: '',
    reportingHeadChanged: false,
    previousReportingHead: '',
    newReportingHead: '',
    managerDecision: {
      decision: 'increment',
      recommendedPct: '',
      reason: '',
      pipDurationMonths: '',
      pipNewDueDate: '',
    },
    managementDecision: {
      finalPct: '',
      reason: '',
      pipApproved: true,
    },
    hrDecision: {
      newContractStartDate: '',
      newContractEndDate: '',
      notes: '',
    },
  });
  const [editError, setEditError] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);

  useEffect(() => {
    if (!selectedRevision) return;
    setEditMode(false);
    setEditError(null);
    setEditValues({
      applicableDate: selectedRevision.applicableDate ? new Date(selectedRevision.applicableDate).toISOString().split('T')[0] : '',
      previousCtc: selectedRevision.previousCtc != null ? String(selectedRevision.previousCtc) : '',
      newCtc: selectedRevision.newCtc != null ? String(selectedRevision.newCtc) : '',
      finalIncrementPct: selectedRevision.finalIncrementPct != null ? String(selectedRevision.finalIncrementPct) : '',
      stage: selectedRevision.stage,
      designationChanged: selectedRevision.designationChanged,
      previousDesignation: selectedRevision.previousDesignation || '',
      newDesignation: selectedRevision.newDesignation || '',
      reportingHeadChanged: selectedRevision.reportingHeadChanged,
      previousReportingHead: selectedRevision.previousReportingHead || '',
      newReportingHead: selectedRevision.newReportingHead || '',
      managerDecision: {
        decision: selectedRevision.managerDecision?.decision || 'increment',
        recommendedPct: selectedRevision.managerDecision?.recommendedPct != null ? String(selectedRevision.managerDecision.recommendedPct) : '',
        reason: selectedRevision.managerDecision?.reason || '',
        pipDurationMonths: selectedRevision.managerDecision?.pipDurationMonths != null ? String(selectedRevision.managerDecision.pipDurationMonths) : '',
        pipNewDueDate: selectedRevision.managerDecision?.pipNewDueDate ? new Date(selectedRevision.managerDecision.pipNewDueDate).toISOString().split('T')[0] : '',
      },
      managementDecision: {
        finalPct: selectedRevision.managementDecision?.finalPct != null ? String(selectedRevision.managementDecision.finalPct) : '',
        reason: selectedRevision.managementDecision?.reason || '',
        pipApproved: selectedRevision.managementDecision?.pipApproved ?? true,
      },
      hrDecision: {
        newContractStartDate: selectedRevision.hrDecision?.newContractStartDate ? new Date(selectedRevision.hrDecision.newContractStartDate).toISOString().split('T')[0] : '',
        newContractEndDate: selectedRevision.hrDecision?.newContractEndDate ? new Date(selectedRevision.hrDecision.newContractEndDate).toISOString().split('T')[0] : '',
        notes: selectedRevision.hrDecision?.notes || '',
      },
    });
  }, [selectedRevision]);

  // Add this as a NEW useEffect, after the existing one


  const savePastIncrement = async () => {
    if (!selectedRevision) return;
    setEditError(null);
    const payload: any = {
      applicableDate: editValues.applicableDate || null,
      previousCtc: editValues.previousCtc !== '' ? Number(editValues.previousCtc) : undefined,
      newCtc: editValues.newCtc !== '' ? Number(editValues.newCtc) : undefined,
      finalIncrementPct: editValues.finalIncrementPct !== '' ? Number(editValues.finalIncrementPct) : undefined,
      stage: editValues.stage,
      designationChanged: editValues.designationChanged,
      previousDesignation: editValues.previousDesignation,
      newDesignation: editValues.newDesignation,
      reportingHeadChanged: editValues.reportingHeadChanged,
      previousReportingHead: editValues.previousReportingHead,
      newReportingHead: editValues.newReportingHead,
      managerDecision: {
        decision: editValues.managerDecision.decision,
        recommendedPct: editValues.managerDecision.recommendedPct !== '' ? Number(editValues.managerDecision.recommendedPct) : null,
        reason: editValues.managerDecision.reason,
        pipDurationMonths: editValues.managerDecision.pipDurationMonths !== '' ? Number(editValues.managerDecision.pipDurationMonths) : null,
        pipNewDueDate: editValues.managerDecision.pipNewDueDate || null,
      },
      managementDecision: {
        finalPct: editValues.managementDecision.finalPct !== '' ? Number(editValues.managementDecision.finalPct) : null,
        reason: editValues.managementDecision.reason,
        pipApproved: editValues.managementDecision.pipApproved,
      },
      hrDecision: {
        newContractStartDate: editValues.hrDecision.newContractStartDate || null,
        newContractEndDate: editValues.hrDecision.newContractEndDate || null,
        notes: editValues.hrDecision.notes || '',
      },
    };

    if (payload.previousCtc != null && Number.isNaN(payload.previousCtc)) {
      setEditError('Enter a valid previous CTC amount.');
      return;
    }
    if (payload.newCtc != null && Number.isNaN(payload.newCtc)) {
      setEditError('Enter a valid new CTC amount.');
      return;
    }
    if (payload.finalIncrementPct != null && Number.isNaN(payload.finalIncrementPct)) {
      setEditError('Enter a valid increment percentage.');
      return;
    }
    if (payload.managerDecision.recommendedPct != null && Number.isNaN(payload.managerDecision.recommendedPct)) {
      setEditError('Enter a valid manager recommended percentage.');
      return;
    }
    if (payload.managementDecision.finalPct != null && Number.isNaN(payload.managementDecision.finalPct)) {
      setEditError('Enter a valid management final percentage.');
      return;
    }

    setSaveBusy(true);
    try {
      const { data } = await axios.put(`${API}/${selectedRevision._id}`, payload);
      if (!data.success) {
        throw new Error(data.message || 'Save failed');
      }

      const updatedRevision = { ...selectedRevision, ...data.data } as SalaryRevision;
      setSelectedRevision(updatedRevision);
      setHistory((prev) => prev.map((item) => item._id === updatedRevision._id ? updatedRevision : item));
      setEditMode(false);
    } catch (err: any) {
      setEditError(err?.response?.data?.message || err?.message || 'Save failed');
    } finally {
      setSaveBusy(false);
    }
  };

  const cancelEdit = () => {
    setEditMode(false);
    if (selectedRevision) {
      setEditValues((prev: any) => ({
        ...prev,
        applicableDate: selectedRevision.applicableDate ? new Date(selectedRevision.applicableDate).toISOString().split('T')[0] : '',
        previousCtc: selectedRevision.previousCtc != null ? String(selectedRevision.previousCtc) : '',
        newCtc: selectedRevision.newCtc != null ? String(selectedRevision.newCtc) : '',
        finalIncrementPct: selectedRevision.finalIncrementPct != null ? String(selectedRevision.finalIncrementPct) : '',
        stage: selectedRevision.stage,
        designationChanged: selectedRevision.designationChanged,
        previousDesignation: selectedRevision.previousDesignation || '',
        newDesignation: selectedRevision.newDesignation || '',
        reportingHeadChanged: selectedRevision.reportingHeadChanged,
        previousReportingHead: selectedRevision.previousReportingHead || '',
        newReportingHead: selectedRevision.newReportingHead || '',
        managerDecision: {
          decision: selectedRevision.managerDecision?.decision || 'increment',
          recommendedPct: selectedRevision.managerDecision?.recommendedPct != null ? String(selectedRevision.managerDecision.recommendedPct) : '',
          reason: selectedRevision.managerDecision?.reason || '',
          pipDurationMonths: selectedRevision.managerDecision?.pipDurationMonths != null ? String(selectedRevision.managerDecision.pipDurationMonths) : '',
          pipNewDueDate: selectedRevision.managerDecision?.pipNewDueDate ? new Date(selectedRevision.managerDecision.pipNewDueDate).toISOString().split('T')[0] : '',
        },
        managementDecision: {
          finalPct: selectedRevision.managementDecision?.finalPct != null ? String(selectedRevision.managementDecision.finalPct) : '',
          reason: selectedRevision.managementDecision?.reason || '',
          pipApproved: selectedRevision.managementDecision?.pipApproved ?? true,
        },
        hrDecision: {
          newContractStartDate: selectedRevision.hrDecision?.newContractStartDate ? new Date(selectedRevision.hrDecision.newContractStartDate).toISOString().split('T')[0] : '',
          newContractEndDate: selectedRevision.hrDecision?.newContractEndDate ? new Date(selectedRevision.hrDecision.newContractEndDate).toISOString().split('T')[0] : '',
          notes: selectedRevision.hrDecision?.notes || '',
        },
      }));
      setEditError(null);
    }
  };

  useEffect(() => {
    setLoading(true);
    // Fetch revisions and the onboarding record so we can compute the
    // effective contract period for each revision. We prefer HR-finalised
    // dates, then any revision-level dates, then fall back to the
    // onboarding `contractHistory` entry that covered the revision's
    // `createdAt` timestamp. Finally sort by that effective start date
    // descending so the newest contract period appears first.
    Promise.all([
      axios.get(`${API}/history/${employeeCode}`),
      axios.get(`${API_URL}/onboarding/${employeeCode}`),
    ])
      .then(([revRes, onbRes]) => {
        const items = revRes.data?.data ?? [];
        const onb = onbRes.data?.data || null;
        const hist = Array.isArray(onb?.contractHistory) ? onb.contractHistory.map((p: any) => ({
          start: p.startDate ? new Date(p.startDate) : null,
          end: p.endDate ? new Date(p.endDate) : null,
        })) : [];

        const findHistoryForDate = (d: Date | null) => {
          if (!d) return null;
          for (let i = hist.length - 1; i >= 0; i--) {
            const entry = hist[i];
            if (!entry.start) continue;
            if (entry.start <= d && (!entry.end || entry.end >= d)) return entry;
          }
          return hist[hist.length - 1] ?? null;
        };

        const enriched = items.map((it: any) => {
          const created = it.createdAt ? new Date(it.createdAt) : null;
          const hrStart = it.hrDecision?.newContractStartDate ? new Date(it.hrDecision.newContractStartDate) : null;
          const hrEnd   = it.hrDecision?.newContractEndDate ? new Date(it.hrDecision.newContractEndDate) : null;
          const revStart = it.newContractStartDate ? new Date(it.newContractStartDate) : (it.contractStartDate ? new Date(it.contractStartDate) : null);
          const revEnd   = it.newContractEndDate ? new Date(it.newContractEndDate) : (it.contractEndDate ? new Date(it.contractEndDate) : null);

          const histMatch = findHistoryForDate(created);
          const periodStart = hrStart || revStart || histMatch?.start || (it.applicableDate ? new Date(it.applicableDate) : null) || created;
          const periodEnd   = hrEnd   || revEnd   || histMatch?.end || null;

          return { ...it, _periodStart: periodStart, _periodEnd: periodEnd };
        });

        enriched.sort((a: any, b: any) => {
          const aT = a._periodStart ? new Date(a._periodStart).getTime() : 0;
          const bT = b._periodStart ? new Date(b._periodStart).getTime() : 0;
          return bT - aT;
        });

        setHistory(enriched as SalaryRevision[]);
      })
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [employeeCode]);

  if (loading) return <Box display="flex" justifyContent="center" py={4}><CircularProgress size={24}/></Box>;
  if (!history.length) return <Typography fontSize={12} color="text.secondary">No past revisions for this employee.</Typography>;

  return (
    <>
      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': TH }}>
                <TableCell>Contract Period</TableCell>
                <TableCell>Decision</TableCell>
                <TableCell>Designation</TableCell>
                <TableCell>Reporting Head</TableCell>
                <TableCell>CTC</TableCell>
                <TableCell>Stage</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {history.map((h, i) => {
                const contractStart = h._periodStart || (h.newContractStartDate ? new Date(h.newContractStartDate) : (h.contractStartDate ? new Date(h.contractStartDate) : null));
                const contractEnd = h._periodEnd || (h.newContractEndDate ? new Date(h.newContractEndDate) : (h.contractEndDate ? new Date(h.contractEndDate) : null));
                return (
                  <TableRow key={h._id}
                    onClick={() => setSelectedRevision(h)}
                    sx={{ cursor: 'pointer', bgcolor: i === 0 ? '#f8fafc' : 'transparent', '&:hover': { bgcolor: '#eef2ff' } }}>
                    <TableCell sx={{ fontSize: 12 }}>
                      {contractStart
                        ? <>{fmtDate(contractStart)} → {contractEnd ? fmtDate(contractEnd) : 'Ongoing'}</>
                        : <span style={{ color: '#94a3b8' }}>—</span>}
                      {i === 0 && <Chip label="Latest" size="small" sx={{ ml: 0.7, fontSize: 9, height: 16, bgcolor: '#eef2ff', color: ACCENT }}/> }
                    </TableCell>
                    <TableCell><DecisionChip decision={h.managerDecision?.decision} isPpo={isPpoRevision(h)}/></TableCell>
                    <TableCell sx={{ fontSize: 12 }}>
                      {h.designationChanged
                        ? <>{h.previousDesignation} → <strong>{h.newDesignation}</strong></>
                        : <span style={{ color: '#94a3b8' }}>No change</span>}
                    </TableCell>
                  <TableCell sx={{ fontSize: 12 }}>
                    {h.reportingHeadChanged
                      ? <>{h.previousReportingHead || '—'} → <strong>{h.newReportingHead}</strong></>
                      : <span style={{ color: '#94a3b8' }}>No change</span>}
                  </TableCell>
                  <TableCell sx={{ fontSize: 12 }}>
                    {fmtCurrency(h.previousCtc)} → <strong style={{ color: '#059669' }}>{fmtCurrency(h.newCtc)}</strong>
                    {formatIncrementPct(h) && (
                      <Typography component="span" sx={{ display: 'block', fontSize: 11, color: '#475569', mt: 0.3 }}>
                        {formatIncrementPct(h)}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell><StageChip stage={h.stage}/></TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Modal open={!!selectedRevision} onClose={() => setSelectedRevision(null)}>
        <Box sx={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:{ xs:'95vw', sm:640 }, maxHeight:'85vh', overflowY:'auto', bgcolor:'white', borderRadius:2, p:3, outline:'none' }}>
          <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'center', mb:2 }}>
            <Box>
              <Typography fontSize={16} fontWeight={700}>Past Contract Details</Typography>
              <Typography fontSize={12} color="text.secondary">Click outside or the close button to dismiss.</Typography>
            </Box>
            <IconButton size="small" onClick={() => setSelectedRevision(null)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
          {selectedRevision && (
            <Stack spacing={1.25}>
              <Box sx={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:1.5, mb:1 }}>
                <Box>
                  <Typography fontSize={11} color="text.secondary">Contract Period</Typography>
                  <Typography fontSize={13} fontWeight={600}>
                    {selectedRevision._periodStart ? fmtDate(selectedRevision._periodStart as any as string) : '—'} → {selectedRevision._periodEnd ? fmtDate(selectedRevision._periodEnd as any as string) : 'Ongoing'}
                  </Typography>
                </Box>
                <Box>
                  <Typography fontSize={11} color="text.secondary">Applicable Date</Typography>
                  <Typography fontSize={13} fontWeight={600}>{fmtDate(selectedRevision.applicableDate)}</Typography>
                </Box>
              </Box>

              <Box sx={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:1.5 }}>
                <Box>
                  <Typography fontSize={11} color="text.secondary">Previous CTC</Typography>
                  <Typography fontSize={13} fontWeight={600}>{fmtCurrency(selectedRevision.previousCtc)}</Typography>
                </Box>
                <Box>
                  <Typography fontSize={11} color="text.secondary">New CTC</Typography>
                  <Typography fontSize={13} fontWeight={600}>{fmtCurrency(selectedRevision.newCtc)}</Typography>
                </Box>
              </Box>

              {editMode ? (
                <Box sx={{ mt: 1, display: 'grid', gap: 1 }}> 
                  <TextField
                    label="Applicable Date"
                    size="small"
                    type="date"
                    value={editValues.applicableDate}
                    onChange={(e) => setEditValues((prev:any) => ({ ...prev, applicableDate: e.target.value }))}
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    label="Previous CTC"
                    size="small"
                    value={editValues.previousCtc}
                    onChange={(e) => setEditValues((prev:any) => ({ ...prev, previousCtc: e.target.value }))}
                    inputProps={{ inputMode: 'numeric' }}
                  />
                  <TextField
                    label="New CTC"
                    size="small"
                    value={editValues.newCtc}
                    onChange={(e) => setEditValues((prev:any) => ({ ...prev, newCtc: e.target.value }))}
                    inputProps={{ inputMode: 'numeric' }}
                  />
                  <TextField
                    label="Increment %"
                    size="small"
                    value={editValues.finalIncrementPct}
                    onChange={(e) => setEditValues((prev:any) => ({ ...prev, finalIncrementPct: e.target.value }))}
                    inputProps={{ inputMode: 'decimal' }}
                  />
                  <TextField
                    label="New Designation"
                    size="small"
                    value={editValues.newDesignation}
                    onChange={(e) => setEditValues((prev:any) => ({ ...prev, newDesignation: e.target.value, designationChanged: true }))}
                  />
                  <TextField
                    label="New Reporting Head"
                    size="small"
                    value={editValues.newReportingHead}
                    onChange={(e) => setEditValues((prev:any) => ({ ...prev, newReportingHead: e.target.value, reportingHeadChanged: true }))}
                  />
                  <TextField
                    label="HR Contract Start"
                    size="small"
                    type="date"
                    value={editValues.hrDecision.newContractStartDate}
                    onChange={(e) => setEditValues((prev:any) => ({ ...prev, hrDecision: { ...prev.hrDecision, newContractStartDate: e.target.value } }))}
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    label="HR Contract End"
                    size="small"
                    type="date"
                    value={editValues.hrDecision.newContractEndDate}
                    onChange={(e) => setEditValues((prev:any) => ({ ...prev, hrDecision: { ...prev.hrDecision, newContractEndDate: e.target.value } }))}
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    label="HR Notes"
                    size="small"
                    multiline
                    rows={3}
                    value={editValues.hrDecision.notes}
                    onChange={(e) => setEditValues((prev:any) => ({ ...prev, hrDecision: { ...prev.hrDecision, notes: e.target.value } }))}
                  />
                  {editError && <Typography fontSize={12} color="error">{editError}</Typography>}
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button size="small" variant="contained" onClick={savePastIncrement} disabled={saveBusy}>
                      Save
                    </Button>
                    <Button size="small" variant="outlined" onClick={cancelEdit} disabled={saveBusy}>
                      Cancel
                    </Button>
                  </Box>
                </Box>
              ) : (
                formatIncrementPct(selectedRevision) && (
                  <Box sx={{ mt: 1 }}>
                    <Typography fontSize={11} color="text.secondary">Increment %</Typography>
                    <Typography fontSize={13} fontWeight={600} color="#059669">
                      {formatIncrementPct(selectedRevision)}
                    </Typography>
                  </Box>
                )
              )}

              <Divider />

              <Box sx={{ display:'flex', gap:1, flexWrap:'wrap', alignItems:'center' }}>
                <Typography fontSize={11} color="text.secondary">Decision</Typography>
                <Typography fontSize={13} fontWeight={600}>{selectedRevision.managerDecision?.decision ? selectedRevision.managerDecision.decision.toUpperCase() : 'Pending'}</Typography>
                <Button size="small" variant="outlined" onClick={() => setEditMode(true)}>
                  Edit Increment
                </Button>
              </Box>
              {selectedRevision.managerDecision?.reason && (
                <Typography fontSize={12} color="text.secondary">Reason: {selectedRevision.managerDecision.reason}</Typography>
              )}

              <Box>
                <Typography fontSize={11} color="text.secondary">Stage</Typography>
                <StageChip stage={selectedRevision.stage} />
              </Box>

              <Divider />

              <Box>
                <Typography fontSize={11} color="text.secondary">Designation Change</Typography>
                {selectedRevision.designationChanged ? (
                  <Typography fontSize={13} fontWeight={600}>{selectedRevision.previousDesignation || '—'} → {selectedRevision.newDesignation || '—'}</Typography>
                ) : (
                  <Typography fontSize={12} color="text.secondary">No change</Typography>
                )}
              </Box>

              <Box>
                <Typography fontSize={11} color="text.secondary">Reporting Head Change</Typography>
                {selectedRevision.reportingHeadChanged ? (
                  <Typography fontSize={13} fontWeight={600}>{selectedRevision.previousReportingHead || '—'} → {selectedRevision.newReportingHead || '—'}</Typography>
                ) : (
                  <Typography fontSize={12} color="text.secondary">No change</Typography>
                )}
              </Box>

              <Divider />

              <Box>
                <Typography fontSize={11} color="text.secondary">HR Contract Dates</Typography>
                <Typography fontSize={13} fontWeight={600}>Start: {fmtDate(selectedRevision.hrDecision?.newContractStartDate)}</Typography>
                <Typography fontSize={13} fontWeight={600}>End: {fmtDate(selectedRevision.hrDecision?.newContractEndDate)}</Typography>
              </Box>

              <Box>
                <Typography fontSize={11} color="text.secondary">HR Notes</Typography>
                <Typography fontSize={12} color="text.secondary">{selectedRevision.hrDecision?.notes || '—'}</Typography>
              </Box>

              <Box>
                <Typography fontSize={11} color="text.secondary">Created On</Typography>
                <Typography fontSize={13} fontWeight={600}>{fmtDate(selectedRevision.createdAt)}</Typography>
              </Box>
            </Stack>
          )}
        </Box>
      </Modal>
    </>
  );
}

// ─── Revision Detail / Action View ───────────────────────────────────────────────────────────

function RevisionDetailView({ emp, rec, onBack, onRecordChange, showToast }: {
  emp          : Employee;
  rec          : SalaryRevision | undefined;
  onBack       : () => void;
  onRecordChange:(r: SalaryRevision) => void;
  showToast    : (m:string,t:'success'|'error')=>void;
}) {
  const [tab, setTab] = useState(0);

  // Computed once up front — both the % and $ increment inputs below need
  // this same baseline to stay in sync with each other.
  const prevCtc = rec?.previousCtc ?? emp.annual_ctc ?? 0;

  const [applicableDate, setApplicableDate] = useState(rec?.applicableDate
    ? new Date(rec.applicableDate).toISOString().split('T')[0] : '');
  const [category, setCategory] = useState(rec?.category||emp.employee_category||'Employee');
  const [pmsRows,  setPmsRows]  = useState<PmsScore[]>(
    rec?.pmsScores?.length ? rec.pmsScores : [{ period:'', score:0 }]
  );

  const [mgrDecision,   setMgrDecision]   = useState<'increment'|'pip'>(rec?.managerDecision?.decision||'increment');
  const [mgrPct,        setMgrPct]        = useState(rec?.managerDecision?.recommendedPct??10);
  const [mgrReason,     setMgrReason]     = useState(rec?.managerDecision?.reason||'');
  const [pipMonths,     setPipMonths]     = useState(rec?.managerDecision?.pipDurationMonths??3);
  const [pipDueDate,    setPipDueDate]    = useState(
    rec?.managerDecision?.pipNewDueDate
      ? new Date(rec.managerDecision.pipNewDueDate).toISOString().split('T')[0] : '');

  // Target CTC amount — a second, equally-editable way to express the same
  // increment as mgrPct/mgmtPct. Editing either one recalculates the
  // other off the same previous-CTC baseline; the percentage remains the
  // single value actually sent to the backend (recommendedPct/finalPct),
  // this amount field is purely a convenience alternative for entering it.
  const [mgrAmount, setMgrAmount] = useState<number>(
    amountFromPct(rec?.managerDecision?.recommendedPct ?? mgrPct, prevCtc)
  );

  const handleMgrPctChange = (pct: number) => {
    setMgrPct(pct);
    setMgrAmount(amountFromPct(pct, prevCtc));
  };
  const handleMgrAmountChange = (amount: number) => {
    setMgrAmount(amount);
    setMgrPct(pctFromAmount(amount, prevCtc));
  };

  const [changeDesignation, setChangeDesignation] = useState(rec?.designationChanged ?? false);
  const [newDesignation,    setNewDesignation]    = useState(rec?.newDesignation || '');

  const [changeHead, setChangeHead] = useState(rec?.reportingHeadChanged ?? false);
  const [newHead,    setNewHead]    = useState(rec?.newReportingHead || '');

  const [mgmtPct,       setMgmtPct]       = useState(rec?.managementDecision?.finalPct??mgrPct);
  const [mgmtReason,    setMgmtReason]    = useState(rec?.managementDecision?.reason||'');
  const [pipApproved,   setPipApproved]   = useState(rec?.managementDecision?.pipApproved??true);

  const [mgmtAmount, setMgmtAmount] = useState<number>(
    amountFromPct(rec?.managementDecision?.finalPct ?? mgmtPct, prevCtc)
  );

  const handleMgmtPctChange = (pct: number) => {
    setMgmtPct(pct);
    setMgmtAmount(amountFromPct(pct, prevCtc));
  };
  const handleMgmtAmountChange = (amount: number) => {
    setMgmtAmount(amount);
    setMgmtPct(pctFromAmount(amount, prevCtc));
  };

  const [hrNotes,       setHrNotes]       = useState(rec?.hrDecision?.notes||'');
  const [hrAppDate,     setHrAppDate]     = useState(
    rec?.hrDecision?.applicableDate
      ? new Date(rec.hrDecision.applicableDate).toISOString().split('T')[0]
      : applicableDate);
  const [hrNewContractStart, setHrNewContractStart] = useState(
    rec?.hrDecision?.newContractStartDate
      ? new Date(rec.hrDecision.newContractStartDate).toISOString().split('T')[0]
      : '');
  const [hrNewContractEnd,   setHrNewContractEnd]   = useState(
    rec?.hrDecision?.newContractEndDate
      ? new Date(rec.hrDecision.newContractEndDate).toISOString().split('T')[0]
      : '');
  const [hrFullTimeSince,    setHrFullTimeSince]     = useState(
    rec?.hrDecision?.fullTimeSince
      ? new Date(rec.hrDecision.fullTimeSince).toISOString().split('T')[0]
      : '');

  // Only relevant when this revision is a PPO / intern-to-full-time
  // conversion — i.e. the category actually changed and the new category
  // is a full-time Employee, converting from Intern/Contract Based.
  const isPpoConversion = !!rec?.categoryChanged && rec?.newCategory === 'Employee'
    && PPO_SOURCE_CATEGORIES.includes(rec?.previousCategory || '');

  const [pipOutcomeChoice, setPipOutcomeChoice] = useState<'improved'|'not_improved'>('improved');
  const [pipOutcomeReason, setPipOutcomeReason] = useState('');

  const [busy, setBusy] = useState(false);

  // TEMPORARY direct edit of an ALREADY-SUBMITTED manager/management
  // decision — same convention as the Stage editor in DashboardView's
  // View popup: hits the plain PUT /:id route with only the one field
  // being corrected, which never calls any mail sender (unlike the
  // /manager and /management routes' PUT handlers, which both submit a
  // fresh decision AND queue the next mail in the chain). For fixing a
  // typo'd percentage or reason after the fact without reopening the
  // whole workflow or generating mail. Remove once no longer needed.
  const [mgrDecisionEditOpen, setMgrDecisionEditOpen] = useState(false);
  const [mgrEditDecision, setMgrEditDecision] = useState<'increment'|'pip'>('increment');
  const [mgrEditPct, setMgrEditPct] = useState(0);
  const [mgrEditAmount, setMgrEditAmount] = useState(0);
  const [mgrEditPipMonths, setMgrEditPipMonths] = useState(3);
  const [mgrEditPipDueDate, setMgrEditPipDueDate] = useState('');
  const [mgrEditReason, setMgrEditReason] = useState('');
  const [mgrEditBusy, setMgrEditBusy] = useState(false);
  const [mgrEditError, setMgrEditError] = useState('');

  const handleMgrEditPctChange = (pct: number) => {
    setMgrEditPct(pct);
    setMgrEditAmount(amountFromPct(pct, prevCtc));
  };
  const handleMgrEditAmountChange = (amount: number) => {
    setMgrEditAmount(amount);
    setMgrEditPct(pctFromAmount(amount, prevCtc));
  };

  const openMgrDecisionEdit = () => {
    setMgrEditDecision(rec?.managerDecision?.decision || 'increment');
    const pct = rec?.managerDecision?.recommendedPct ?? 0;
    setMgrEditPct(pct);
    setMgrEditAmount(amountFromPct(pct, prevCtc));
    setMgrEditPipMonths(rec?.managerDecision?.pipDurationMonths ?? 3);
    setMgrEditPipDueDate(rec?.managerDecision?.pipNewDueDate ? new Date(rec.managerDecision.pipNewDueDate).toISOString().split('T')[0] : '');
    setMgrEditReason(rec?.managerDecision?.reason || '');
    setMgrEditError('');
    setMgrDecisionEditOpen(true);
  };
  const saveMgrDecisionEdit = async () => {
    if (!rec) return;
    setMgrEditBusy(true); setMgrEditError('');
    try {
      const { data } = await axios.put(`${API}/${rec._id}`, {
        managerDecision: {
          decision: mgrEditDecision,
          recommendedPct: mgrEditDecision==='increment' ? mgrEditPct : null,
          pipDurationMonths: mgrEditDecision==='pip' ? mgrEditPipMonths : null,
          pipNewDueDate: mgrEditDecision==='pip' ? (mgrEditPipDueDate||null) : null,
          reason: mgrEditReason,
        },
      });
      if (!data.success) throw new Error(data.message || 'Save failed');
      onRecordChange(data.data);
      setMgrDecisionEditOpen(false);
    } catch (e:any) { setMgrEditError(e?.response?.data?.message || e?.message || 'Save failed'); }
    finally { setMgrEditBusy(false); }
  };

  const [mgmtDecisionEditOpen, setMgmtDecisionEditOpen] = useState(false);
  const [mgmtEditPct, setMgmtEditPct] = useState(0);
  const [mgmtEditAmount, setMgmtEditAmount] = useState(0);
  const [mgmtEditPipApproved, setMgmtEditPipApproved] = useState(true);
  const [mgmtEditReason, setMgmtEditReason] = useState('');
  const [mgmtEditBusy, setMgmtEditBusy] = useState(false);
  const [mgmtEditError, setMgmtEditError] = useState('');

  const handleMgmtEditPctChange = (pct: number) => {
    setMgmtEditPct(pct);
    setMgmtEditAmount(amountFromPct(pct, prevCtc));
  };
  const handleMgmtEditAmountChange = (amount: number) => {
    setMgmtEditAmount(amount);
    setMgmtEditPct(pctFromAmount(amount, prevCtc));
  };

  const openMgmtDecisionEdit = () => {
    const pct = rec?.managementDecision?.finalPct ?? 0;
    setMgmtEditPct(pct);
    setMgmtEditAmount(amountFromPct(pct, prevCtc));
    setMgmtEditPipApproved(rec?.managementDecision?.pipApproved ?? true);
    setMgmtEditReason(rec?.managementDecision?.reason || '');
    setMgmtEditError('');
    setMgmtDecisionEditOpen(true);
  };
  const saveMgmtDecisionEdit = async () => {
    if (!rec) return;
    setMgmtEditBusy(true); setMgmtEditError('');
    try {
      const { data } = await axios.put(`${API}/${rec._id}`, {
        managementDecision: {
          finalPct: rec?.managerDecision?.decision==='increment' ? mgmtEditPct : null,
          pipApproved: rec?.managerDecision?.decision==='pip' ? mgmtEditPipApproved : null,
          reason: mgmtEditReason,
        },
      });
      if (!data.success) throw new Error(data.message || 'Save failed');
      onRecordChange(data.data);
      setMgmtDecisionEditOpen(false);
    } catch (e:any) { setMgmtEditError(e?.response?.data?.message || e?.message || 'Save failed'); }
    finally { setMgmtEditBusy(false); }
  };

  useEffect(()=>{
    if (mgrDecision==='pip') {
      const d=new Date(); d.setMonth(d.getMonth()+pipMonths);
      setPipDueDate(d.toISOString().split('T')[0]);
    }
  },[pipMonths,mgrDecision]);

  const stage       = rec?.stage || 'pending_manager';
  const isMgr       = stage==='pending_manager';
  const isMgmt      = stage==='pending_management';
  const isHr        = stage==='pending_hr';
  const isCompleted = stage==='completed';
  const isOnHold    = stage==='on_hold';

  // The single "currently effective" percentage for each decision, computed
  // once so the same number can't ever show inconsistently in two spots:
  // while still being edited (isMgr/isMgmt) this is the live slider value;
  // once submitted, it's the actually-recorded value (falling back to the
  // live value only as a defensive default).
  const displayMgrPct  = rec?.managerDecision?.recommendedPct ?? mgrPct;
  const displayMgmtPct = rec?.managementDecision?.finalPct ?? mgmtPct;
  const effectivePct   = isMgr ? displayMgrPct : displayMgmtPct;

  const newCtc      = mgrDecision==='increment'
    ? Math.round(prevCtc*(1+effectivePct/100))
    : prevCtc;

  const avg = avgPms(pmsRows.filter(r=>r.period.trim()));

  // Every ACTIVE CTC Component (admin-configured on the CTC Components
  // screen) — fetched once so both the editable HR card and the
  // read-only Salary Structure tab share the exact same list/order.
  const [ctcComponents, setCtcComponents] = useState<CTCComponentType[]>([]);
  useEffect(() => {
    axios.get(CTC_API).then(res => {
      const data: CTCComponentType[] = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setCtcComponents(data.filter(c=>c.is_active).sort((a,b)=>a.order-b.order));
    }).catch(()=>{});
  }, []);

  // ─── HR card: editable salary-structure override ───────────────────────
  // `hrSalaryComponents` holds only what HR actually TYPES — the
  // no-formula "input" components (Basic Salary, Telephone Allowance,
  // etc.). Every component's real value — inputs verbatim, formula
  // results for the rest — comes from evaluateCtcComponents below, which
  // re-runs live as the inputs or the component list change, the same
  // instant recalculation a spreadsheet gives you. A saved HR override
  // (rec?.hrDecision?.salaryComponents) seeds the inputs when reopening
  // an already-worked-on revision; otherwise Basic Salary starts from the
  // same 40%-of-monthly estimate the old fixed-field calculator used,
  // purely as a helpful starting point — HR can freely overwrite it, and
  // everything downstream (HRA, Bonus, ESIC, Monthly/Annual CTC, ...)
  // recalculates from whatever it's actually set to.
  const [hrSalaryComponents, setHrSalaryComponents] = useState<Record<string, number>>(() => {
    const saved = rec?.hrDecision?.salaryComponents;
    if (saved && Object.keys(saved).length) return { ...saved };
    return { BASIC: calcSalaryStructure(newCtc).basic };
  });
  const computedComponents = useMemo(
    () => evaluateCtcComponents(ctcComponents, hrSalaryComponents),
    [ctcComponents, hrSalaryComponents]
  );

  // ─── HR card: 5-step completion checklist ───────────────────────────────
  // Step 1 (Appraisal Decision) is derived, not stored — it's just
  // "has Management already decided," which is exactly what put this
  // revision into 'pending_hr' in the first place.
  const appraisalStepDone = !!rec?.managementDecision?.submittedAt;
  const emptyHrStep: HrSubStep = { completed:false, completedAt:null };
  // Steps 2-4 are saved incrementally (PUT /:id) the moment each is
  // marked complete — a multi-day HR process shouldn't lose progress
  // just because the dialog was closed and reopened. Step 5's completion
  // comes from the upload route itself (see uploadHrDocument below).
  const [hrSubSteps, setHrSubSteps] = useState<HrSubSteps>(() => ({
    letterPrepared      : rec?.hrDecision?.subSteps?.letterPrepared       ?? emptyHrStep,
    employeeInformed    : rec?.hrDecision?.subSteps?.employeeInformed     ?? emptyHrStep,
    revisionLetterShared: rec?.hrDecision?.subSteps?.revisionLetterShared ?? emptyHrStep,
    documentUploaded    : rec?.hrDecision?.subSteps?.documentUploaded     ?? emptyHrStep,
  }));
  const [hrDocument, setHrDocument] = useState<HrDocument | null>(rec?.hrDecision?.document?.driveLink ? rec.hrDecision.document : null);
  const [hrStepBusy, setHrStepBusy] = useState<keyof HrSubSteps | null>(null);
  const [hrDocUploading, setHrDocUploading] = useState(false);
  const [hrChecklistError, setHrChecklistError] = useState('');

  const HR_STEP_ORDER: (keyof HrSubSteps)[] = ['letterPrepared', 'employeeInformed', 'revisionLetterShared', 'documentUploaded'];
  const HR_STEP_LABELS: Record<keyof HrSubSteps, string> = {
    letterPrepared: 'Letter Prepared/Shared',
    employeeInformed: 'Employee Informed',
    revisionLetterShared: 'Revision Letter Shared',
    documentUploaded: 'Document Uploaded',
  };
  const allHrStepsDone = appraisalStepDone && HR_STEP_ORDER.every(k => hrSubSteps[k].completed);

  const markHrStepComplete = async (key: Exclude<keyof HrSubSteps, 'documentUploaded'>) => {
    if (!rec) return;
    setHrStepBusy(key);
    setHrChecklistError('');
    try {
      const nextSubSteps = { ...hrSubSteps, [key]: { completed:true, completedAt:new Date().toISOString() } };
      const { data } = await axios.put(`${API}/${rec._id}`, { hrDecision: { subSteps: nextSubSteps } });
      if (!data.success) throw new Error(data.message || 'Save failed');
      setHrSubSteps(nextSubSteps);
      onRecordChange(data.data);
    } catch (err: any) {
      setHrChecklistError(err?.response?.data?.message || err?.message || 'Failed to save — try again.');
    } finally {
      setHrStepBusy(null);
    }
  };

  const uploadHrDocument = async (file: File) => {
    if (!rec) return;
    setHrDocUploading(true);
    setHrChecklistError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await axios.post(`${API}/${rec._id}/upload-document`, formData);
      if (!data.success) throw new Error(data.message || 'Upload failed');
      const updated: SalaryRevision = data.data;
      setHrDocument(updated.hrDecision?.document || null);
      setHrSubSteps(s => ({ ...s, documentUploaded: updated.hrDecision?.subSteps?.documentUploaded || { completed:true, completedAt:new Date().toISOString() } }));
      onRecordChange(updated);
    } catch (err: any) {
      setHrChecklistError(err?.response?.data?.message || err?.message || 'Upload failed — try again.');
    } finally {
      setHrDocUploading(false);
    }
  };

  const postManager = async () => {
    if (!mgrReason.trim()) return showToast('Provide a reason', 'error');
    setBusy(true);
    try {
      let revisionId = rec?._id;
      if (!revisionId) {
        const createRes = await axios.post(API, {
          onboardingId  : emp._id,
          employeeCode  : emp.employee_id,
          employeeName  : emp.full_name,
          department    : emp.department,
          designation   : emp.designation,
          email         : emp.email,
          joiningDate   : emp.joining_date,
          contractStartDate: emp.contract_start_date||null,
          contractEndDate  : emp.contract_end_date||null,
          category,
          applicableDate: applicableDate || null,
          previousCtc   : emp.annual_ctc || 0,
          previousDesignation: emp.designation,
          previousReportingHead: (emp as any).reporting_head || '',
          previousCategory: emp.employee_category || 'Employee',
          pmsScores     : pmsRows.filter(r => r.period.trim()),
        });
        const created = createRes.data?.data || createRes.data;
        if (!created?._id) { showToast('Failed to initialise revision record', 'error'); return; }
        revisionId = created._id;
        onRecordChange(created);
      }

      const payload: any = {
        reason        : mgrReason,
        applicableDate: applicableDate || null,
        category,
        decision      : mgrDecision,
        pmsScores     : pmsRows.filter(r => r.period.trim()),
        newDesignation: changeDesignation ? newDesignation : null,
        newReportingHead: changeHead ? newHead : null,
      };
      if (mgrDecision === 'increment') payload.recommendedPct = mgrPct;
      else { payload.pipDurationMonths = pipMonths; payload.pipNewDueDate = pipDueDate || null; }

      const { data } = await axios.put(`${API}/${revisionId}/manager`, payload);
      if (data.success) { showToast('Manager decision saved', 'success'); onRecordChange(data.data); }
      else showToast(data.message || 'Failed', 'error');
    } catch (e: any) { showToast(e?.response?.data?.message || 'Failed', 'error'); }
    finally { setBusy(false); }
  };

  const postManagement=async()=>{
    if (!mgmtReason.trim()) return showToast('Provide a reason','error');
    if (!rec) return;
    setBusy(true);
    try {
      const payload: any={ reason:mgmtReason };
      if (rec.managerDecision?.decision==='increment') payload.finalPct=mgmtPct;
      else payload.pipApproved=pipApproved;
      const { data }=await axios.put(`${API}/${rec._id}/management`,payload);
      if (data.success){ showToast('Management decision saved','success'); onRecordChange(data.data); }
      else showToast(data.message||'Failed','error');
    } catch(e:any){ showToast(e?.response?.data?.message||'Failed','error'); }
    finally { setBusy(false); }
  };

  const postHr=async()=>{
    if (!rec) return;
    if (!allHrStepsDone) return showToast('Complete all checklist steps above first', 'error');
    setBusy(true);
    try {
      const payload={
        notes:hrNotes, applicableDate:hrAppDate||null, newCtc,
        newContractStartDate:hrNewContractStart||null, newContractEndDate:hrNewContractEnd||null,
        fullTimeSince: isPpoConversion ? (hrFullTimeSince||null) : null,
        // The full resolved snapshot (inputs + formula results for every
        // component), not just what HR typed — a completed revision's
        // record should be self-contained, not require re-running the
        // formula engine later to know what GROSS_MONTHLY/ANNUAL_CTC etc.
        // actually were at finalisation time.
        salaryComponents: computedComponents,
      };
      const { data }=await axios.put(`${API}/${rec._id}/hr`,payload);
      if (data.success){ showToast('HR decision saved — revision completed, Onboarding updated','success'); onRecordChange(data.data); }
      else showToast(data.message||'Failed','error');
    } catch(e:any){ showToast(e?.response?.data?.message||'Failed','error'); }
    finally { setBusy(false); }
  };

  // Lets HR kick off an additional revision for this same employee even
  // though a completed one already exists for this cycle — needed when an
  // off-cycle/contract-linked increment comes up separately from the
  // annual review that's already been finalised. The old completed
  // revision stays exactly as-is in History; this just creates a new one.
  const startNewRevision = async () => {
    if (!window.confirm('Start a new salary revision for this employee? The completed one stays in history.')) return;
    setBusy(true);
    try {
      const { data } = await axios.post(API, {
        onboardingId: emp._id,
        employeeCode: emp.employee_id,
        employeeName: emp.full_name,
        department: emp.department,
        designation: emp.designation,
        email: emp.email,
        joiningDate: emp.joining_date,
        contractStartDate: emp.contract_start_date || null,
        contractEndDate: emp.contract_end_date || null,
        category: emp.employee_category || 'Employee',
        applicableDate: null,
        previousCtc: emp.annual_ctc || 0,
        previousDesignation: emp.designation,
        previousReportingHead: (emp as any).reporting_head || '',
        previousCategory: emp.employee_category || 'Employee',
        pmsScores: [],
      });
      const created = data?.data || data;
      if (created?._id) { showToast('New revision started', 'success'); onRecordChange(created); }
      else showToast(data.message || 'Failed to start new revision', 'error');
    } catch (e: any) { showToast(e?.response?.data?.message || 'Failed', 'error'); }
    finally { setBusy(false); }
  };

  const postPipOutcome = async () => {
    if (!pipOutcomeReason.trim()) return showToast('Provide a reason', 'error');
    if (!rec) return;
    setBusy(true);
    try {
      const { data } = await axios.put(`${API}/${rec._id}/pip-outcome`, {
        outcome: pipOutcomeChoice, reason: pipOutcomeReason,
      });
      if (data.success) { showToast('PIP outcome recorded', 'success'); onRecordChange(data.data); }
      else showToast(data.message || 'Failed', 'error');
    } catch (e: any) { showToast(e?.response?.data?.message || 'Failed', 'error'); }
    finally { setBusy(false); }
  };

  const FlowBanner=()=>{
    if (isCompleted && rec?.pipOutcome) {
      return (
        <Alert severity={rec.pipOutcome==='improved'?'success':'error'} sx={{ mb:2, fontSize:12 }}>
          PIP closed out — {rec.pipOutcome==='improved'?'employee improved':'employee did not improve'}
          {rec.pipOutcomeDate?` on ${fmtDate(rec.pipOutcomeDate)}`:''}.
        </Alert>
      );
    }
    if (isCompleted) return <Alert severity="success" sx={{ mb:2, fontSize:12 }}>Revision completed. Final CTC: {fmtCurrency(rec?.newCtc)}. Onboarding record updated.</Alert>;
    if (isOnHold)    return <Alert severity="warning" sx={{ mb:2, fontSize:12 }}>On hold (PIP). Review opens on {fmtDate(rec?.reviewDate)}.</Alert>;
    if (isMgr)       return <Alert severity="info"    sx={{ mb:2, fontSize:12 }}>Step 1 of 3 — awaiting Manager decision.</Alert>;
    if (isMgmt)      return <Alert severity="info"    sx={{ mb:2, fontSize:12 }}>Step 2 of 3 — awaiting Management decision.</Alert>;
    if (isHr)        return <Alert severity="info"    sx={{ mb:2, fontSize:12 }}>Step 3 of 3 — awaiting HR to finalise.</Alert>;
    return null;
  };

  return (
    <Box sx={{ p:2.5, maxWidth:1300, mx:'auto' }}>
      <Box sx={{ display:'flex', alignItems:'center', gap:1.5, mb:2, flexWrap:'wrap' }}>
        <IconButton onClick={onBack} size="small" sx={{ bgcolor:'#f8fafc', borderRadius:1.5 }}>
          <ArrowBackIcon fontSize="small"/>
        </IconButton>
        <Avatar sx={{ width:38, height:38, bgcolor:ACCENT, fontWeight:700, fontSize:14 }}>{initials(emp.full_name)}</Avatar>
        <Box flex={1}>
          <Typography fontWeight={700} fontSize="0.95rem">{emp.full_name}</Typography>
          <Typography fontSize={12} color="text.secondary">{emp.designation} · {emp.department}</Typography>
        </Box>
        {!rec&&<Typography fontSize={12} color="text.secondary">No revision record</Typography>}
      </Box>

      <FlowBanner/>

      {isCompleted&&(
        <Button size="small" onClick={startNewRevision} disabled={busy}
          sx={{ display:'block', mb:2, p:0, minWidth:0, textTransform:'none', fontSize:12, fontWeight:600,
            color: ACCENT, '&:hover':{ textDecoration:'underline', bgcolor:'transparent' } }}>
          {busy?'Starting…':'Start New Revision'}
        </Button>
      )}

      {isOnHold && (
        <Paper variant="outlined" sx={{ borderRadius:2, p:2.5, mb:2.5, borderColor:'#fde68a', bgcolor:'#fffbeb' }}>
          <Typography fontWeight={700} fontSize={13} mb={1.5}>Close Out PIP</Typography>
          <Stack spacing={1.5}>
            <Box sx={{ display:'flex', gap:1.5 }}>
              <Button variant={pipOutcomeChoice==='improved'?'contained':'outlined'} size="small"
                onClick={()=>setPipOutcomeChoice('improved')}
                sx={{ textTransform:'none', bgcolor:pipOutcomeChoice==='improved'?'#059669':'transparent',
                  color:pipOutcomeChoice==='improved'?'white':'#059669', borderColor:'#059669' }}>Improved</Button>
              <Button variant={pipOutcomeChoice==='not_improved'?'contained':'outlined'} size="small"
                onClick={()=>setPipOutcomeChoice('not_improved')}
                sx={{ textTransform:'none', bgcolor:pipOutcomeChoice==='not_improved'?'#dc2626':'transparent',
                  color:pipOutcomeChoice==='not_improved'?'white':'#dc2626', borderColor:'#dc2626' }}>Not Improved</Button>
            </Box>
            <TextField label="Reason / Comments *" multiline rows={2} size="small"
              value={pipOutcomeReason} onChange={e=>setPipOutcomeReason(e.target.value)} fullWidth/>
            <Box>
              <Button variant="contained" onClick={postPipOutcome} disabled={busy||!pipOutcomeReason.trim()}
                sx={{ bgcolor:ACCENT, '&:hover':{ bgcolor:'#4338ca' }, textTransform:'none', fontWeight:600 }}>
                {busy?<CircularProgress size={20} sx={{ color:'white' }}/>:'Submit PIP Outcome'}
              </Button>
            </Box>
          </Stack>
        </Paper>
      )}

      <Box sx={{ display:'flex', alignItems:'center', mb:2.5, px:0.5 }}>
        {[
          { label:'Manager', stage:'pending_manager', done:!isMgr },
          { label:'Management', stage:'pending_management', done:isHr||isCompleted },
          { label:'HR Final', stage:'pending_hr', done:isCompleted },
        ].map((step,i,arr)=>{
          const isActive = stage===step.stage;
          const isDone   = step.done&&!isActive;
          const circleColor = isActive?ACCENT:isDone?'#059669':'#cbd5e1';
          return (
            <React.Fragment key={i}>
              <Box sx={{ display:'flex', alignItems:'center', gap:0.75 }}>
                <Box sx={{ width:18, height:18, borderRadius:'50%', bgcolor:circleColor, flexShrink:0,
                  display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {isDone
                    ? <CheckCircleIcon sx={{ fontSize:13, color:'white' }}/>
                    : <Typography fontSize={10} fontWeight={700} color="white">{i+1}</Typography>}
                </Box>
                <Typography fontSize={12} fontWeight={isActive?700:600}
                  color={isActive?ACCENT:isDone?'#059669':'#94a3b8'}>
                  {step.label}
                </Typography>
              </Box>
              {i<arr.length-1 && <Box sx={{ flex:1, height:'1px', bgcolor:'#e2e8f0', mx:1.5 }}/>}
            </React.Fragment>
          );
        })}
      </Box>

      <Box sx={{ borderBottom:'1px solid #e2e8f0', mb:2 }}>
        <Tabs value={tab} onChange={(_,v)=>setTab(v)} sx={{
          '& .MuiTab-root':{ fontSize:12, textTransform:'none', minHeight:36, py:0 },
          '& .MuiTabs-indicator':{ bgcolor:ACCENT },
          '& .Mui-selected':{ color:`${ACCENT} !important`, fontWeight:700 },
        }}>
          <Tab label="Employee Details" value={0}/>
          <Tab label="Decision" value={1}/>
          <Tab label="Salary Structure" value={2} disabled={mgrDecision!=='increment'}/>
          <Tab label="History" value={3} icon={<HistoryIcon sx={{ fontSize:14 }}/>} iconPosition="end"/>
        </Tabs>
      </Box>

      {tab===0&&(
        <Box sx={{ display:'flex', gap:2.5, flexWrap:'wrap' }}>
          <Paper variant="outlined" sx={{ flex:'1 1 300px', borderRadius:2, p:2.5 }}>
            <Typography fontWeight={700} fontSize={13} mb={1.5}>Auto-Fetched Info</Typography>
            <Box sx={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:1.2 }}>
              {[
                ['Employee Code', emp.employee_id],
                ['Full Name',     emp.full_name],
                ['Email',         emp.email||rec?.email||'—'],
                ['Department',    emp.department||rec?.department||'—'],
                ['Current Designation',   emp.designation||rec?.designation||'—'],
                ['Reporting Head', (emp as any).reporting_head || '—'],
                ['Joining Date',  fmtDate(emp.joining_date||rec?.joiningDate)],
                ['Previous CTC',  fmtCurrency(prevCtc)],
                ['Contract Start', fmtDate(emp.contract_start_date||rec?.contractStartDate)],
                ['Contract End',   fmtDate(emp.contract_end_date||rec?.contractEndDate)],
              ].map(([l,v])=>(
                <Box key={l}>
                  <Typography fontSize={12} color="text.secondary">{l}</Typography>
                  <Typography fontSize={12} fontWeight={500}>{v}</Typography>
                </Box>
              ))}
            </Box>
          </Paper>

          <Paper variant="outlined" sx={{ flex:'1 1 260px', borderRadius:2, p:2.5 }}>
            <Typography fontWeight={700} fontSize={13} mb={1.5}>Contract History</Typography>
            {(emp.contract_history && emp.contract_history.length>0) ? (
              <Stack spacing={1}>
                {emp.contract_history.map((p,i)=>{
                  const isLatest = i===emp.contract_history!.length-1;
                  return (
                    <Box key={i} sx={{ display:'flex', justifyContent:'space-between', gap:2, p:0.75,
                      bgcolor: isLatest?'#f0fdf4':'#f8fafc', borderRadius:1 }}>
                      <Typography fontSize={12} color={isLatest?'#059669':'text.secondary'} fontWeight={isLatest?600:400}>
                        Contract {i+1}{isLatest?' (current)':''}
                      </Typography>
                      <Typography fontSize={12} fontWeight={500} textAlign="right">
                        {fmtDate(p.start_date)} → {p.end_date?fmtDate(p.end_date):'Ongoing'}
                      </Typography>
                    </Box>
                  );
                })}
              </Stack>
            ) : (
              <Typography fontSize={12} color="text.secondary">No contract history on record.</Typography>
            )}
          </Paper>

          <Paper variant="outlined" sx={{ flex:'1 1 260px', borderRadius:2, p:2.5 }}>
            <Typography fontWeight={700} fontSize={13} mb={1.5}>Designation & Reporting Head</Typography>
            <Stack spacing={2}>
              <Box>
                <FormControlLabel
                  control={<Switch size="small" checked={changeDesignation}
                    onChange={e=>setChangeDesignation(e.target.checked)} disabled={!isMgr}
                    sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: ACCENT }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: ACCENT } }}/>}
                  label={<Typography fontSize={12} fontWeight={600}>Change Designation</Typography>}/>
                {changeDesignation && (
                  <TextField size="small" fullWidth placeholder={`Current: ${emp.designation}`}
                    value={newDesignation} onChange={e=>setNewDesignation(e.target.value)}
                    disabled={!isMgr} sx={{ mt: 1 }}/>
                )}
                {!isMgr && rec?.designationChanged && (
                  <Typography fontSize={12} color={ACCENT} mt={0.5}>
                    {rec.previousDesignation} → <strong>{rec.newDesignation}</strong>
                  </Typography>
                )}
              </Box>

              <Divider/>

              <Box>
                <FormControlLabel
                  control={<Switch size="small" checked={changeHead}
                    onChange={e=>setChangeHead(e.target.checked)} disabled={!isMgr}
                    sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: ACCENT }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: ACCENT } }}/>}
                  label={<Typography fontSize={12} fontWeight={600}>Change Reporting Head</Typography>}/>
                {changeHead && (
                  <TextField size="small" fullWidth placeholder={`Current: ${(emp as any).reporting_head || 'None set'}`}
                    value={newHead} onChange={e=>setNewHead(e.target.value)}
                    disabled={!isMgr} sx={{ mt: 1 }}/>
                )}
                {!isMgr && rec?.reportingHeadChanged && (
                  <Typography fontSize={12} color={ACCENT} mt={0.5}>
                    {rec.previousReportingHead || '—'} → <strong>{rec.newReportingHead}</strong>
                  </Typography>
                )}
              </Box>
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ flex:'1 1 260px', borderRadius:2, p:2.5 }}>
            <Typography fontWeight={700} fontSize={13} mb={1.5}>Review Inputs</Typography>
            <Stack spacing={2}>
              <Box>
                <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', mb:1 }}>
                  <Typography fontSize={12} fontWeight={700} color="text.secondary">PMS SCORES</Typography>
                  {isMgr&&<Button size="small" startIcon={<AddIcon/>}
                    onClick={()=>setPmsRows(r=>[...r,{period:'',score:0}])}
                    sx={{ fontSize:11, textTransform:'none', color:ACCENT }}>Add</Button>}
                </Box>
                <Stack spacing={1}>
                  {pmsRows.map((row,i)=>(
                    <Box key={i} sx={{ display:'flex', gap:1, alignItems:'center' }}>
                      <TextField size="small" label="Period" value={row.period}
                        onChange={e=>setPmsRows(r=>r.map((x,idx)=>idx===i?{...x,period:e.target.value}:x))}
                        disabled={!isMgr} sx={{ flex:2 }}/>
                      <TextField size="small" label="Score" type="number" value={row.score}
                        onChange={e=>setPmsRows(r=>r.map((x,idx)=>idx===i?{...x,score:Number(e.target.value)}:x))}
                        inputProps={{ min:0, max:10, step:0.1 }} disabled={!isMgr} sx={{ flex:1 }}/>
                      {isMgr&&pmsRows.length>1&&(
                        <IconButton size="small" onClick={()=>setPmsRows(r=>r.filter((_,idx)=>idx!==i))}
                          sx={{ color:'#dc2626' }}><CloseIcon fontSize="small"/></IconButton>
                      )}
                    </Box>
                  ))}
                </Stack>
                {avg!=null&&(
                  <Typography fontSize={12} color="text.secondary" mt={1}>Avg PMS: <strong>{avg}</strong></Typography>
                )}
              </Box>

              <TextField label="Applicable Date" type="date" size="small"
                value={applicableDate} onChange={e=>setApplicableDate(e.target.value)}
                InputLabelProps={{ shrink:true }} disabled={!isMgr} fullWidth/>
              <FormControl size="small" fullWidth>
                <InputLabel>Category</InputLabel>
                <Select value={category} label="Category" onChange={e=>setCategory(e.target.value)} disabled={!isMgr}>
                  {['Employee','Consultant','Intern','Intern with PPO','Contract Based','Part Time','Temporary Staffing'].map(c=>(
                    <MenuItem key={c} value={c}>{c}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </Paper>
        </Box>
      )}

      {tab===1&&(
        <Box sx={{ display:'flex', gap:2.5, flexWrap:'wrap' }}>

          <Paper variant="outlined" sx={{ flex:'1 1 300px', borderRadius:2, p:2.5,
            outline:isMgr?`2px solid ${ACCENT}`:'none' }}>
            <Box sx={{ display:'flex', alignItems:'center', gap:1, mb:2 }}>
              <Box sx={{ width:22, height:22, borderRadius:'50%', bgcolor:isMgr?ACCENT:!isMgr?'#059669':'#e2e8f0',
                display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Typography fontSize={11} color="white" fontWeight={700}>{!isMgr?'✓':'1'}</Typography>
              </Box>
              <Typography fontWeight={700} fontSize={13}>Manager Decision</Typography>
            </Box>

            <RevisionMailButtons revisionId={rec?._id} mailTypes={['managerRequest','managerEscalation','finalEscalation']}/>

            <Stack spacing={2}>
              <Box>
                <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', mb:1 }}>
                  <Typography fontSize={11} fontWeight={700} color="text.secondary">DECISION</Typography>
                  {!isMgr && !mgrDecisionEditOpen && (
                    <Tooltip title="Temporary direct edit — no mail is sent">
                      <IconButton size="small" onClick={openMgrDecisionEdit} sx={{ p:0.3 }}>
                        <EditIcon sx={{ fontSize:14, color:'var(--text-secondary)' }}/>
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
                <Box sx={{ display:'flex', gap:1.5 }}>
                  {(['increment','pip'] as const).map(opt=>(
                    <Button key={opt} variant={mgrDecision===opt?'contained':'outlined'}
                      startIcon={opt==='increment'?<TrendingUpIcon/>:<PauseCircleIcon/>}
                      onClick={()=>isMgr&&setMgrDecision(opt)}
                      disabled={!isMgr}
                      sx={{ textTransform:'none', fontWeight:600, fontSize:12,
                        bgcolor:mgrDecision===opt?(opt==='increment'?'#059669':'#dc2626'):'transparent',
                        borderColor:opt==='increment'?'#059669':'#dc2626',
                        color:mgrDecision===opt?'white':(opt==='increment'?'#059669':'#dc2626') }}>
                      {opt==='increment'?'Increment':'PIP'}
                    </Button>
                  ))}
                </Box>
              </Box>

              {!isMgr && mgrDecisionEditOpen ? (
                <Box sx={{ p:1.5, bgcolor:'#fffbeb', borderRadius:1.5, border:'1px solid #fde68a' }}>
                  <Stack spacing={1.5}>
                    <Box sx={{ display:'flex', gap:1 }}>
                      {(['increment','pip'] as const).map(opt=>(
                        <Button key={opt} size="small" variant={mgrEditDecision===opt?'contained':'outlined'}
                          onClick={()=>setMgrEditDecision(opt)}
                          sx={{ textTransform:'none', fontSize:11,
                            bgcolor:mgrEditDecision===opt?(opt==='increment'?'#059669':'#dc2626'):'transparent',
                            borderColor:opt==='increment'?'#059669':'#dc2626',
                            color:mgrEditDecision===opt?'white':(opt==='increment'?'#059669':'#dc2626') }}>
                          {opt==='increment'?'Increment':'PIP'}
                        </Button>
                      ))}
                    </Box>
                    {mgrEditDecision==='increment' ? (
                      <Box sx={{ display:'flex', gap:1.5, flexWrap:'wrap' }}>
                        <TextField size="small" label="Recommended %" type="number" value={mgrEditPct}
                          onChange={e=>handleMgrEditPctChange(Number(e.target.value)||0)} sx={{ width:140 }}/>
                        <TextField size="small" label="New CTC Amount" type="number" value={mgrEditAmount}
                          onChange={e=>handleMgrEditAmountChange(Number(e.target.value)||0)} sx={{ width:180 }}
                          InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}/>
                      </Box>
                    ) : (
                      <Box sx={{ display:'flex', gap:1.5, flexWrap:'wrap' }}>
                        <TextField size="small" label="PIP Months" type="number" value={mgrEditPipMonths}
                          onChange={e=>setMgrEditPipMonths(Number(e.target.value)||1)} sx={{ width:120 }}/>
                        <TextField size="small" label="New Due Date" type="date" value={mgrEditPipDueDate}
                          onChange={e=>setMgrEditPipDueDate(e.target.value)} InputLabelProps={{ shrink:true }} sx={{ width:170 }}/>
                      </Box>
                    )}
                    <TextField size="small" label="Reason" multiline rows={2} value={mgrEditReason}
                      onChange={e=>setMgrEditReason(e.target.value)}/>
                    {mgrEditError && <Typography fontSize={11} color="#dc2626">{mgrEditError}</Typography>}
                    <Typography fontSize={10} color="text.secondary">
                      Temporary direct edit — updates the manager's decision only, no mail is sent.
                    </Typography>
                    <Box sx={{ display:'flex', gap:1 }}>
                      <Button size="small" variant="contained" onClick={saveMgrDecisionEdit} disabled={mgrEditBusy}
                        sx={{ bgcolor:'#059669', '&:hover':{ bgcolor:'#047857' }, textTransform:'none' }}>
                        {mgrEditBusy?<CircularProgress size={14} sx={{ color:'white' }}/>:'Save'}
                      </Button>
                      <Button size="small" variant="outlined" disabled={mgrEditBusy}
                        onClick={()=>{ setMgrDecisionEditOpen(false); setMgrEditError(''); }}
                        sx={{ textTransform:'none' }}>Cancel</Button>
                    </Box>
                  </Stack>
                </Box>
              ) : (
                <>
                  {mgrDecision==='increment'&&(
                    <Box>
                      <Typography fontSize={12} fontWeight={600} mb={1}>
                        Manager Recommendation: <strong style={{ color:'#059669' }}>{displayMgrPct}%</strong>
                      </Typography>
                      {isMgr?(
                        <>
                          <Slider value={mgrPct} onChange={(_,v)=>handleMgrPctChange(v as number)}
                            min={0} max={50} step={0.5} valueLabelDisplay="auto"
                            valueLabelFormat={v=>`${v}%`} sx={{ color:'#059669', maxWidth:340 }}/>
                          <TextField
                            size="small" label="Or enter New CTC Amount" type="number"
                            value={mgrAmount}
                            onChange={e=>handleMgrAmountChange(Number(e.target.value)||0)}
                            sx={{ mt: 1.5, maxWidth: 220 }}
                            InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                          />
                          <Typography fontSize={11} color="text.secondary" mt={0.5}>
                            From {fmtCurrency(prevCtc)} to {fmtCurrency(mgrAmount)}
                          </Typography>
                        </>
                      ):(
                        <Box sx={{ p:1.5, bgcolor:'#f8fafc', borderRadius:1.5, border:'1px solid #e2e8f0' }}>
                          <Typography fontSize={12} color="#059669" fontWeight={600}>
                            {displayMgrPct}% increment recommended
                            {' '}({fmtCurrency(amountFromPct(displayMgrPct, prevCtc))})
                          </Typography>
                          <Typography fontSize={11} color="text.secondary" mt={0.5}>{rec?.managerDecision?.reason}</Typography>
                        </Box>
                      )}
                    </Box>
                  )}

                  {mgrDecision==='pip'&&(
                    <Box sx={{ display:'flex', gap:2, flexWrap:'wrap' }}>
                      <TextField label="Duration (months)" type="number" size="small"
                        value={pipMonths} onChange={e=>setPipMonths(Math.max(1,Math.min(12,Number(e.target.value)||1)))}
                        inputProps={{ min:1, max:12 }} disabled={!isMgr} sx={{ width:160 }}/>
                      <TextField label="New Due Date" type="date" size="small"
                        value={pipDueDate} onChange={e=>setPipDueDate(e.target.value)}
                        InputLabelProps={{ shrink:true }} disabled={!isMgr} sx={{ width:180 }}/>
                    </Box>
                  )}

                  <TextField label="Reason / Comments *" multiline rows={3} size="small"
                    value={mgrReason} onChange={e=>setMgrReason(e.target.value)}
                    placeholder="Manager's reasoning…" disabled={!isMgr} fullWidth/>
                </>
              )}

              {isMgr&&(
                <Button variant="contained" onClick={postManager} disabled={busy||!mgrReason.trim()}
                  sx={{ bgcolor:'#059669', '&:hover':{ bgcolor:'#047857' }, textTransform:'none', fontWeight:600 }}>
                  {busy?<CircularProgress size={20} sx={{ color:'white' }}/>:'Submit Manager Decision'}
                </Button>
              )}
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ flex:'1 1 300px', borderRadius:2, p:2.5,
            outline:isMgmt?`2px solid ${ACCENT}`:'none' }}>
            <Box sx={{ display:'flex', alignItems:'center', gap:1, mb:2 }}>
              <Box sx={{ width:22, height:22, borderRadius:'50%',
                bgcolor:isMgmt?ACCENT:(isHr||isCompleted)?'#059669':'#e2e8f0',
                display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Typography fontSize={11} color="white" fontWeight={700}>{(isHr||isCompleted)?'✓':'2'}</Typography>
              </Box>
              <Typography fontWeight={700} fontSize={13}>Management Decision</Typography>
            </Box>

            <RevisionMailButtons revisionId={rec?._id} mailTypes={['managementApproval']}/>

            {isMgr&&<Alert severity="warning" sx={{ fontSize:11, mb:2 }}>Waiting for manager to submit first.</Alert>}

            {!isMgr&&(
              <Stack spacing={2}>
                {!isMgmt && !mgmtDecisionEditOpen && (
                  <Box sx={{ display:'flex', justifyContent:'flex-end' }}>
                    <Tooltip title="Temporary direct edit — no mail is sent">
                      <IconButton size="small" onClick={openMgmtDecisionEdit} sx={{ p:0.3 }}>
                        <EditIcon sx={{ fontSize:14, color:'var(--text-secondary)' }}/>
                      </IconButton>
                    </Tooltip>
                  </Box>
                )}

                {!isMgmt && mgmtDecisionEditOpen ? (
                  <Box sx={{ p:1.5, bgcolor:'#fffbeb', borderRadius:1.5, border:'1px solid #fde68a' }}>
                    <Stack spacing={1.5}>
                      {rec?.managerDecision?.decision==='increment' ? (
                        <Box sx={{ display:'flex', gap:1.5, flexWrap:'wrap' }}>
                          <TextField size="small" label="Final %" type="number" value={mgmtEditPct}
                            onChange={e=>handleMgmtEditPctChange(Number(e.target.value)||0)} sx={{ width:140 }}/>
                          <TextField size="small" label="New CTC Amount" type="number" value={mgmtEditAmount}
                            onChange={e=>handleMgmtEditAmountChange(Number(e.target.value)||0)} sx={{ width:180 }}
                            InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}/>
                        </Box>
                      ) : (
                        <Box sx={{ display:'flex', gap:1.5 }}>
                          <Button size="small" variant={mgmtEditPipApproved?'contained':'outlined'}
                            onClick={()=>setMgmtEditPipApproved(true)}
                            sx={{ textTransform:'none', bgcolor:mgmtEditPipApproved?'#dc2626':'transparent',
                              color:mgmtEditPipApproved?'white':'#dc2626', borderColor:'#dc2626' }}>Approve PIP</Button>
                          <Button size="small" variant={!mgmtEditPipApproved?'contained':'outlined'}
                            onClick={()=>setMgmtEditPipApproved(false)}
                            sx={{ textTransform:'none', bgcolor:!mgmtEditPipApproved?'#059669':'transparent',
                              color:!mgmtEditPipApproved?'white':'#059669', borderColor:'#059669' }}>Re-evaluate</Button>
                        </Box>
                      )}
                      <TextField size="small" label="Reason" multiline rows={2} value={mgmtEditReason}
                        onChange={e=>setMgmtEditReason(e.target.value)}/>
                      {mgmtEditError && <Typography fontSize={11} color="#dc2626">{mgmtEditError}</Typography>}
                      <Typography fontSize={10} color="text.secondary">
                        Temporary direct edit — updates the management decision only, no mail is sent.
                      </Typography>
                      <Box sx={{ display:'flex', gap:1 }}>
                        <Button size="small" variant="contained" onClick={saveMgmtDecisionEdit} disabled={mgmtEditBusy}
                          sx={{ bgcolor:ACCENT, '&:hover':{ bgcolor:'#4338ca' }, textTransform:'none' }}>
                          {mgmtEditBusy?<CircularProgress size={14} sx={{ color:'white' }}/>:'Save'}
                        </Button>
                        <Button size="small" variant="outlined" disabled={mgmtEditBusy}
                          onClick={()=>{ setMgmtDecisionEditOpen(false); setMgmtEditError(''); }}
                          sx={{ textTransform:'none' }}>Cancel</Button>
                      </Box>
                    </Stack>
                  </Box>
                ) : (
                  <>
                    {rec?.managerDecision?.decision==='increment'?(
                      <Box>
                        <Typography fontSize={12} fontWeight={600} mb={1}>
                          Management Final: <strong style={{ color:ACCENT }}>{displayMgmtPct}%</strong>
                          {rec?.managerDecision?.recommendedPct!=null&&(
                            <span style={{ fontSize:11, color:'#94a3b8', marginLeft:8 }}>(Mgr: {rec.managerDecision.recommendedPct}%)</span>
                          )}
                        </Typography>
                        {isMgmt?(
                          <>
                            <Slider value={mgmtPct} onChange={(_,v)=>handleMgmtPctChange(v as number)}
                              min={0} max={50} step={0.5} valueLabelDisplay="auto"
                              valueLabelFormat={v=>`${v}%`} sx={{ color:ACCENT, maxWidth:340 }}/>
                            <TextField
                              size="small" label="Or enter New CTC Amount" type="number"
                              value={mgmtAmount}
                              onChange={e=>handleMgmtAmountChange(Number(e.target.value)||0)}
                              sx={{ mt: 1.5, maxWidth: 220 }}
                              InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                            />
                            <Typography fontSize={11} color="text.secondary" mt={0.5}>
                              From {fmtCurrency(prevCtc)} to {fmtCurrency(mgmtAmount)}
                            </Typography>
                          </>
                        ):(
                          <Box sx={{ p:1.5, bgcolor:'#f8fafc', borderRadius:1.5, border:'1px solid #e2e8f0' }}>
                            <Typography fontSize={12} color={ACCENT} fontWeight={600}>
                              {displayMgmtPct}% — final management decision
                              {' '}({fmtCurrency(amountFromPct(displayMgmtPct, prevCtc))})
                            </Typography>
                          </Box>
                        )}
                        {mgrDecision==='increment'&&(
                          <Box sx={{ mt:1.5, p:1.5, bgcolor:'#f0fdf4', borderRadius:1.5, border:'1px solid #bbf7d0' }}>
                            <Box sx={{ display:'flex', gap:2, alignItems:'center', flexWrap:'wrap' }}>
                              <Typography fontSize={12}>{fmtCurrency(prevCtc)}</Typography>
                              <Typography fontSize={11} color="text.secondary">→</Typography>
                              <Typography fontSize={14} fontWeight={700} color="#059669">{fmtCurrency(newCtc)}</Typography>
                            </Box>
                          </Box>
                        )}
                      </Box>
                    ):(
                      <Box>
                        <Typography fontSize={12} fontWeight={600} mb={1}>Approve PIP?</Typography>
                        <Box sx={{ display:'flex', gap:1.5 }}>
                          <Button variant={pipApproved?'contained':'outlined'} size="small"
                            onClick={()=>isMgmt&&setPipApproved(true)} disabled={!isMgmt}
                            sx={{ textTransform:'none', bgcolor:pipApproved?'#dc2626':'transparent',
                              color:pipApproved?'white':'#dc2626', borderColor:'#dc2626' }}>Approve PIP</Button>
                          <Button variant={!pipApproved?'contained':'outlined'} size="small"
                            onClick={()=>isMgmt&&setPipApproved(false)} disabled={!isMgmt}
                            sx={{ textTransform:'none', bgcolor:!pipApproved?'#059669':'transparent',
                              color:!pipApproved?'white':'#059669', borderColor:'#059669' }}>Re-evaluate</Button>
                        </Box>
                      </Box>
                    )}

                    <TextField label="Reason / Comments *" multiline rows={3} size="small"
                      value={mgmtReason} onChange={e=>setMgmtReason(e.target.value)}
                      disabled={!isMgmt} fullWidth/>
                  </>
                )}

                {isMgmt&&(
                  <Button variant="contained" onClick={postManagement} disabled={busy||!mgmtReason.trim()}
                    sx={{ bgcolor:ACCENT, '&:hover':{ bgcolor:'#4338ca' }, textTransform:'none', fontWeight:600 }}>
                    {busy?<CircularProgress size={20} sx={{ color:'white' }}/>:'Submit Management Decision'}
                  </Button>
                )}
              </Stack>
            )}
          </Paper>

          <Paper variant="outlined" sx={{ flex:'1 1 260px', borderRadius:2, p:2.5,
            outline:isHr?`2px solid ${ACCENT}`:'none' }}>
            <Box sx={{ display:'flex', alignItems:'center', gap:1, mb:2 }}>
              <Box sx={{ width:22, height:22, borderRadius:'50%',
                bgcolor:isHr?ACCENT:isCompleted?'#059669':'#e2e8f0',
                display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Typography fontSize={11} color="white" fontWeight={700}>{isCompleted?'✓':'3'}</Typography>
              </Box>
              <Typography fontWeight={700} fontSize={13}>HR Final Action</Typography>
            </Box>

            <RevisionMailButtons revisionId={rec?._id} mailTypes={['hrNotify','pipHold','employeeConfirmation']}/>

            {(isMgr||isMgmt)&&<Alert severity="warning" sx={{ fontSize:11, mb:2 }}>Waiting for manager & management first.</Alert>}

            {(isHr||isCompleted)&&(
              <Stack spacing={2}>
                <Box sx={{ p:1.5, bgcolor:'#f8fafc', borderRadius:1.5, border:'1px solid #e2e8f0' }}>
                  <Typography fontSize={11} color="text.secondary">Management approved</Typography>
                  {rec?.managerDecision?.decision==='increment'?(
                    <Typography fontSize={13} fontWeight={700} color={ACCENT}>
                      {rec?.managementDecision?.finalPct}% increment → {fmtCurrency(newCtc)}
                    </Typography>
                  ):(
                    <Typography fontSize={13} fontWeight={700} color="#dc2626">PIP approved</Typography>
                  )}
                </Box>

                {rec?.managerDecision?.decision==='increment' && (
                  <Box>
                    <Typography fontSize={11} fontWeight={700} color="text.secondary" mb={1}>
                      SALARY STRUCTURE{isHr?' (EDITABLE)':''}
                    </Typography>
                    <Stack spacing={0.75}>
                      {ctcComponents.map(comp=>{
                        const hasFormula = !!comp.formula?.trim();
                        const isTotal = comp.code==='GROSS_MONTHLY' || comp.code==='MONTHLY_CTC' || comp.code==='ANNUAL_CTC';
                        return (
                          <Box key={comp.code} sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:1 }}>
                            <Typography fontSize={12} color={isTotal?'text.primary':'text.secondary'} fontWeight={isTotal?700:400}>
                              {comp.name}
                            </Typography>
                            {hasFormula ? (
                              <Tooltip title={comp.formula} arrow>
                                <Typography fontSize={12} fontWeight={isTotal?700:600} color={isTotal?ACCENT:'text.primary'}>
                                  {fmtCurrency(computedComponents[comp.code] ?? 0)}
                                </Typography>
                              </Tooltip>
                            ) : (
                              <TextField size="small" type="number" value={hrSalaryComponents[comp.code] ?? 0}
                                onChange={e=>setHrSalaryComponents(s=>({ ...s, [comp.code]: Number(e.target.value)||0 }))}
                                disabled={!isHr} sx={{ width:130 }}
                                InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}/>
                            )}
                          </Box>
                        );
                      })}
                    </Stack>
                  </Box>
                )}

                <TextField label="Applicable Date" type="date" size="small"
                  value={hrAppDate} onChange={e=>setHrAppDate(e.target.value)}
                  InputLabelProps={{ shrink:true }} disabled={!isHr} fullWidth/>

                <TextField label="New Contract Start Date" type="date" size="small"
                  value={hrNewContractStart} onChange={e=>setHrNewContractStart(e.target.value)}
                  InputLabelProps={{ shrink:true }} disabled={!isHr} fullWidth/>

                <TextField label="New Contract End Date" type="date" size="small"
                  value={hrNewContractEnd} onChange={e=>setHrNewContractEnd(e.target.value)}
                  InputLabelProps={{ shrink:true }} disabled={!isHr} fullWidth/>

                {isPpoConversion&&(
                  <TextField label="Full-Time Since (PPO conversion)" type="date" size="small"
                    value={hrFullTimeSince} onChange={e=>setHrFullTimeSince(e.target.value)}
                    helperText="Date this intern/contract employee actually became full-time — next year's review is anchored from here, not their original joining date."
                    InputLabelProps={{ shrink:true }} disabled={!isHr} fullWidth/>
                )}

                <TextField label="HR Notes" multiline rows={3} size="small"
                  value={hrNotes} onChange={e=>setHrNotes(e.target.value)}
                  disabled={!isHr} fullWidth/>

                <Box>
                  <Typography fontSize={11} fontWeight={700} color="text.secondary" mb={1}>
                    HR COMPLETION CHECKLIST
                  </Typography>
                  <Stack spacing={1}>
                    {/* Step 1 — derived from Management having already decided; no action here. */}
                    <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
                      <Box sx={{ width:18, height:18, borderRadius:'50%', flexShrink:0,
                        bgcolor: appraisalStepDone?'#059669':'#cbd5e1',
                        display:'flex', alignItems:'center', justifyContent:'center' }}>
                        {appraisalStepDone && <CheckCircleIcon sx={{ fontSize:13, color:'white' }}/>}
                      </Box>
                      <Typography fontSize={12} fontWeight={600} sx={{ flex:1 }}>1. Appraisal Decision</Typography>
                      {rec?.managementDecision?.submittedAt && (
                        <Typography fontSize={10} color="text.secondary">{fmtDate(rec.managementDecision.submittedAt)}</Typography>
                      )}
                    </Box>

                    {/* Steps 2-4 — simple sequential "Mark complete" buttons. */}
                    {HR_STEP_ORDER.filter(k=>k!=='documentUploaded').map((key,idx)=>{
                      const step = hrSubSteps[key];
                      const prevDone = idx===0 ? appraisalStepDone : hrSubSteps[HR_STEP_ORDER[idx-1]].completed;
                      return (
                        <Box key={key} sx={{ display:'flex', alignItems:'center', gap:1 }}>
                          <Box sx={{ width:18, height:18, borderRadius:'50%', flexShrink:0,
                            bgcolor: step.completed?'#059669':'#cbd5e1',
                            display:'flex', alignItems:'center', justifyContent:'center' }}>
                            {step.completed && <CheckCircleIcon sx={{ fontSize:13, color:'white' }}/>}
                          </Box>
                          <Typography fontSize={12} fontWeight={600} sx={{ flex:1 }}>{idx+2}. {HR_STEP_LABELS[key]}</Typography>
                          {step.completed ? (
                            <Typography fontSize={10} color="text.secondary">{fmtDate(step.completedAt)}</Typography>
                          ) : isHr && (
                            <Tooltip title={!prevDone?'Complete the previous step first':''} arrow disableHoverListener={prevDone}>
                              <span>
                                <Button size="small" variant="outlined" disabled={!prevDone||hrStepBusy===key}
                                  onClick={()=>markHrStepComplete(key)}
                                  sx={{ textTransform:'none', fontSize:11, py:0.2, minWidth:0 }}>
                                  {hrStepBusy===key?<CircularProgress size={12}/>:'Mark complete'}
                                </Button>
                              </span>
                            </Tooltip>
                          )}
                        </Box>
                      );
                    })}

                    {/* Step 5 — document upload instead of a plain button. */}
                    <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
                      <Box sx={{ width:18, height:18, borderRadius:'50%', flexShrink:0,
                        bgcolor: hrSubSteps.documentUploaded.completed?'#059669':'#cbd5e1',
                        display:'flex', alignItems:'center', justifyContent:'center' }}>
                        {hrSubSteps.documentUploaded.completed && <CheckCircleIcon sx={{ fontSize:13, color:'white' }}/>}
                      </Box>
                      <Typography fontSize={12} fontWeight={600} sx={{ flex:1 }}>5. Document Uploaded</Typography>
                      {hrSubSteps.documentUploaded.completed && (
                        <Typography fontSize={10} color="text.secondary">{fmtDate(hrSubSteps.documentUploaded.completedAt)}</Typography>
                      )}
                    </Box>
                    <Box sx={{ ml:3.25 }}>
                      {hrDocument?.driveLink ? (
                        <Typography component="a" href={hrDocument.driveLink} target="_blank" rel="noopener"
                          sx={{ fontSize:11, color:ACCENT, textDecoration:'none', '&:hover':{ textDecoration:'underline' } }}>
                          📄 {hrDocument.fileName}
                        </Typography>
                      ) : isHr && (
                        <Tooltip title={!hrSubSteps.revisionLetterShared.completed?'Complete the previous step first':''} arrow
                          disableHoverListener={hrSubSteps.revisionLetterShared.completed}>
                          <span>
                            <Button size="small" variant="outlined" component="label"
                              disabled={!hrSubSteps.revisionLetterShared.completed||hrDocUploading}
                              sx={{ textTransform:'none', fontSize:11, py:0.2 }}>
                              {hrDocUploading?<CircularProgress size={12}/>:'Upload document'}
                              <input type="file" hidden accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                onChange={e=>{ const f=e.target.files?.[0]; e.target.value=''; if (f) uploadHrDocument(f); }}/>
                            </Button>
                          </span>
                        </Tooltip>
                      )}
                    </Box>
                    {hrChecklistError && <Typography fontSize={11} color="#dc2626">{hrChecklistError}</Typography>}
                  </Stack>
                </Box>

                {isHr&&(
                  <Box>
                    <Button variant="contained" onClick={postHr} disabled={busy||!allHrStepsDone} fullWidth
                      sx={{ bgcolor:'#2563eb', '&:hover':{ bgcolor:'#1d4ed8' }, textTransform:'none', fontWeight:600 }}>
                      {busy?<CircularProgress size={20} sx={{ color:'white' }}/>:'Finalise & Complete Revision'}
                    </Button>
                    {!allHrStepsDone && (
                      <Typography fontSize={11} color="text.secondary" mt={0.5} textAlign="center">
                        Complete all steps above to finalise
                      </Typography>
                    )}
                  </Box>
                )}

                {isCompleted&&(
                  <Box sx={{ p:1.5, bgcolor:'#f0fdf4', borderRadius:1.5, border:'1px solid #bbf7d0' }}>
                    <Typography fontSize={12} fontWeight={700} color="#059669">Revision Completed</Typography>
                    <Typography fontSize={11} color="text.secondary" mt={0.5}>
                      Applicable from {fmtDate(rec?.hrDecision?.applicableDate||rec?.applicableDate)}. Onboarding record updated with latest values.
                    </Typography>
                    {rec?.hrDecision?.newContractStartDate&&(
                      <Typography fontSize={11} color="text.secondary" mt={0.5}>
                        New contract: {fmtDate(rec?.hrDecision?.newContractStartDate)} – {fmtDate(rec?.hrDecision?.newContractEndDate)}
                      </Typography>
                    )}
                    {rec?.hrDecision?.fullTimeSince&&(
                      <Typography fontSize={11} color="text.secondary" mt={0.5}>
                        Full-time since: {fmtDate(rec?.hrDecision?.fullTimeSince)} — next annual review anchored from here.
                      </Typography>
                    )}
                  </Box>
                )}
              </Stack>
            )}
          </Paper>
        </Box>
      )}

      {tab===2&&mgrDecision==='increment'&&(
        <Box>
          <Box sx={{ display:'flex', gap:2, mb:3, flexWrap:'wrap' }}>
            {[
              ['Previous CTC', fmtCurrency(prevCtc), '#64748b'],
              ['Increment %',  `+${effectivePct}%`, '#d97706'],
              ['New Annual CTC', fmtCurrency(newCtc), '#059669'],
              ['Monthly CTC',   fmtCurrency(computedComponents['MONTHLY_CTC'] ?? 0), ACCENT],
            ].map(([l,v,c])=>(
              <Box key={l} sx={{ flex:'1 1 150px', p:2, bgcolor:'white', borderRadius:2, border:'1px solid #e2e8f0' }}>
                <Typography fontSize={11} color="text.secondary">{l}</Typography>
                <Typography fontSize={17} fontWeight={700} color={c}>{v}</Typography>
              </Box>
            ))}
          </Box>

          <Paper variant="outlined" sx={{ borderRadius:2, overflow:'hidden' }}>
            <Box sx={{ p:2, bgcolor:'#f8fafc', borderBottom:'1px solid #e2e8f0' }}>
              <Typography fontWeight={700} fontSize={13}>Salary Structure</Typography>
              <Typography fontSize={11} color="text.secondary" mt={0.3}>
                {rec?.hrDecision?.salaryComponents && Object.keys(rec.hrDecision.salaryComponents).length
                  ? 'As finalised by HR' : 'Live preview — HR can still adjust this at finalisation'}
              </Typography>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th':TH }}>
                    <TableCell>Component</TableCell>
                    <TableCell>Formula</TableCell>
                    <TableCell align="right">Amount (₹)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {ctcComponents.map(comp=>{
                    const isTotal = comp.code==='GROSS_MONTHLY' || comp.code==='MONTHLY_CTC' || comp.code==='ANNUAL_CTC';
                    return (
                      <TableRow key={comp.code} sx={isTotal?{ bgcolor:'#f8fafc' }:undefined}>
                        <TableCell sx={{ fontSize:12, fontWeight:isTotal?700:500 }}>{comp.name}</TableCell>
                        <TableCell sx={{ fontSize:11, color:'text.secondary', fontFamily:'monospace' }}>{comp.formula || '— (manual entry)'}</TableCell>
                        <TableCell sx={{ fontSize:12, fontWeight:isTotal?700:600, textAlign:'right', color:isTotal?ACCENT:undefined }}>
                          {fmtCurrency(computedComponents[comp.code] ?? 0)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      )}

      {tab===3&&<HistoryPanel employeeCode={emp.employee_id}/>}
    </Box>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

type View = 'dashboard' | 'detail' | 'ctc';


export default function SalaryRevisionPage() {
  const [records,   setRecords]   = useState<SalaryRevision[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selEmp,    setSelEmp]    = useState<Employee|null>(null);
  const [selRec,    setSelRec]    = useState<SalaryRevision|undefined>(undefined);
  const [view,      setView]      = useState<View>('dashboard');
  const [loading,   setLoading]   = useState(true);
  // Distinct from `loading` — only true before the very first fetch has
  // ever resolved. Every later refresh (e.g. closing the "Update" dialog
  // calls loadData again) also flips `loading` briefly, but must NOT
  // trigger the full-page spinner below: that swap unmounts DashboardView
  // entirely, which was wiping out every filter (search/dept/status/
  // stage/period) the user had set, the moment they closed the dialog.
  const [initialLoad, setInitialLoad] = useState(true);
  const [showAdd,   setShowAdd]   = useState(false);
  const [toast,     setToast]     = useState<{ msg:string; type:'success'|'error' }|null>(null);

  const showToast=(msg:string,type:'success'|'error'='success')=>setToast({ msg, type });
  const [contact, setContact] = useState<{
  official_email: string;
  personal_email: string;
  mobile:         string;
  reporting_manager: string;
} | null>(null);

  const loadData=useCallback(async()=>{
    try {
      setLoading(true);
      // scope=mine narrows the employee roster to the caller's own reports
      // when they're logged in as Manager — no effect for other roles, see
      // the eligible-employees route for why.
      const [rRes,eRes]=await Promise.all([axios.get(API),axios.get(`${EMP_API}?scope=mine`)]);
      const rData=Array.isArray(rRes.data)?rRes.data:rRes.data?.data||[];
      const eData=Array.isArray(eRes.data)?eRes.data:eRes.data?.data||[];
      setRecords(rData);
      setEmployees(eData);
    } catch { showToast('Failed to load data','error'); }
    finally { setLoading(false); setInitialLoad(false); }
  },[]);

  useEffect(()=>{ loadData(); },[loadData]);

  const handleSelect=(emp:Employee,rec?:SalaryRevision)=>{ setSelEmp(emp); setSelRec(rec); setView('detail'); };

  const handleRecordChange=(updated:SalaryRevision)=>{
    setRecords(prev=>{
      const exists = prev.some(r=>r._id===updated._id);
      return exists ? prev.map(r=>r._id===updated._id?updated:r) : [updated, ...prev];
    });
    setSelRec(updated);
  };

  const handleAdded=(newRec:SalaryRevision)=>{
    setRecords(prev=>[newRec,...prev]);
    const matchedEmp=employees.find(e=>e.employee_id===newRec.employeeCode);
    if (matchedEmp){ setSelEmp(matchedEmp); setSelRec(newRec); setView('detail'); }
  };

  if (loading&&initialLoad) return (
    <div className="flex min-h-screen bg-gray-50/70">
      <Sidebar/><div className="flex-1 flex flex-col"><Navbar/>
        <main className="flex-1 flex items-center justify-center  ">
          <CircularProgress size={40}/>
        </main>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar/>
      <div className="flex-1 flex flex-col">
        <Navbar/>
        <main className="flex-1 overflow-hidden pt-16 md:pt-12">
          <Box sx={{ maxWidth:1300, mx:'auto', width:'100%', height:'100%', overflow:'auto' }}>
            {toast&&<Toast msg={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}

            {view==='ctc' ? (
              <CtcComponentsView onBack={()=>setView('dashboard')} showToast={showToast}/>
            ) : (
              <DashboardView records={records} employees={employees} loading={loading}
                onSelect={handleSelect} onAdd={()=>setShowAdd(true)} onOpenCtc={()=>setView('ctc')} onRefresh={loadData}/>
            )}
          </Box>
        </main>
      </div>

      {/* "Update" popup — was previously a full-page view swap; now overlays
          the dashboard instead so the list stays put behind it. */}
      <Dialog open={view==='detail' && !!selEmp}
        onClose={()=>{ setView('dashboard'); setSelEmp(null); setSelRec(undefined); loadData(); }}
        maxWidth="lg" fullWidth
        PaperProps={{ sx:{ height:'92vh', maxHeight:'92vh', borderRadius:2 } }}>
        <DialogContent sx={{ p:0, overflow:'auto' }}>
          {selEmp && (
            <RevisionDetailView
              key={`${selEmp._id}_${selRec?._id||'new'}`}
              emp={selEmp}
              rec={selRec}
              onBack={()=>{ setView('dashboard'); setSelEmp(null); setSelRec(undefined); loadData(); }}
              onRecordChange={handleRecordChange}
              showToast={showToast}/>
          )}
        </DialogContent>
      </Dialog>

      <AddRevisionModal open={showAdd} onClose={()=>setShowAdd(false)}
        onAdded={handleAdded} showToast={showToast} employees={employees} records={records}/>
    </div>
  );
}
