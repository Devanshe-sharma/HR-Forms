/**
 * Data layer for the AI assistant (routes/ai.js).
 *
 * Everything the model can see or query goes through here:
 *   - which collections are exposed (ALLOWED models only — auth, RBAC and
 *     mail-draft collections are never exposed),
 *   - which fields are stripped (bank / Aadhaar / PAN / passport / contact /
 *     family / document links etc. never leave the server),
 *   - read-only validation of model-written aggregation pipelines.
 *
 * The pipeline validator rejects any reference to a sensitive field, so the
 * model can't sneak one out by renaming it in a $project — result stripping
 * is a second layer on top of that, not the only one.
 */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Make sure every model is registered before we introspect mongoose.
const MODELS_DIR = path.join(__dirname, '..', 'models');
for (const file of fs.readdirSync(MODELS_DIR)) {
  if (file.endsWith('.js')) require(path.join(MODELS_DIR, file));
}

const EXCLUDED_MODELS = new Set([
  'User',
  'Counter',
  'RbacPageVisibility',
  'ConfirmationMailDraft',
  'SalaryRevisionMailDraft',
  'AiInsight',
]);

// Matched against each individual path segment (case-insensitive).
const SENSITIVE_FIELD = new RegExp(
  [
    'password', 'passwd', 'token', 'secret', 'otp', 'hash', 'salt',
    'bank', 'account_?no', 'account_?number', 'ifsc',
    '^pan$', 'pan_?card', 'pan_?no', 'aadha+r', 'passport', '^uan', 'uan_?no', 'epassbook',
    'signature', 'drive_?(link|file_?id|url)', 'folder', 'resume', 'documents?$',
    'mobile', '(^|_)phone', 'phone(_?no|_?number)?$', 'personal_?email', 'pers_?email',
    'emergency', '^family', 'address', 'birthday', '^dob$', 'blood', 'marital',
  ].join('|'),
  'i'
);

const isSensitiveSegment = (seg) => SENSITIVE_FIELD.test(seg);
const isSensitivePath = (p) => String(p).split('.').some(isSensitiveSegment);

const COLLECTION_NOTES = {
  Employee: 'Employee master list (current + archived via isArchived). NOTE: most fields are Strings, including dates (joining_date) and salary figures (annual_ctc, gross_monthly) — convert with $convert/$dateFromString using onError.',
  Onboarding: 'One record per hire: joining details, employeeCategory, managementLevel, dept, confirmation status, salary structure (Numbers) and exit fields (exitStatus, leftDate, exitType).',
  Exit: 'Resignation / exit cases and their checklist progress.',
  Confirmations: 'Probation confirmation workflow (stage, currentStatus, extensions).',
  SalaryRevision: 'Salary revision cases (due / done dates, status, increments).',
  HiringRequisition: 'Job requisitions / open positions raised by departments.',
  ApplicantRecord: 'Candidates in the recruitment pipeline, with interview rounds and outcome.',
  CandidateApplication: 'Applications submitted through the careers page.',
  Referral: 'Employee referrals of candidates.',
  Escalation: 'Escalations raised and their resolution status.',
  Grievance: 'Employee grievances and their status.',
  OutOfOffice: 'Out-of-office / leave requests with manager approval status.',
  Outing: 'Company outings / events.',
  TrainingSchedule: 'Scheduled trainings.',
  TrainingTopic: 'Training topics / suggestions.',
  EmployeeFeedback: 'Training feedback submitted by employees.',
  EmployeeAssessment: 'Capability assessments of employees.',
  ManagerEvaluation: 'Manager capability evaluations.',
  Orientation: 'Company orientation records.',
  DepartmentOrientation: 'Department orientation records.',
  RoleMaster: 'Department / designation master.',
  CtcComponent: 'CTC component configuration.',
};

function allowedModels() {
  return mongoose.modelNames()
    .filter((name) => !EXCLUDED_MODELS.has(name))
    .map((name) => mongoose.model(name));
}

function findModel(name) {
  if (!name || EXCLUDED_MODELS.has(name)) return null;
  const lower = String(name).toLowerCase();
  return allowedModels().find(
    (m) => m.modelName.toLowerCase() === lower || m.collection.name.toLowerCase() === lower
  ) || null;
}

function allowedCollectionNames() {
  return new Set(allowedModels().map((m) => m.collection.name));
}

/** Flat list of { path, type, enum? } for a model, sensitive fields removed. */
function describeFields(schema, prefix = '', depth = 0) {
  const out = [];
  schema.eachPath((p, type) => {
    if (p === '__v' || (p === '_id' && prefix)) return;
    const full = prefix + p;
    if (isSensitivePath(full)) return;
    if (type.schema && depth < 2) {
      out.push({ path: full, type: type.instance === 'Array' ? 'Array<Object>' : 'Object' });
      out.push(...describeFields(type.schema, full + '.', depth + 1));
      return;
    }
    const field = { path: full, type: type.instance === 'Array' ? `Array<${type.caster?.instance || 'Mixed'}>` : type.instance };
    const enumValues = (type.enumValues || type.caster?.enumValues || []).filter(Boolean);
    if (enumValues.length) field.enum = enumValues;
    out.push(field);
  });
  return out;
}

/** Short catalogue for the system prompt: name, count, note, top-level fields. */
async function collectionCatalogue() {
  const models = allowedModels();
  const counts = await Promise.all(models.map((m) => m.estimatedDocumentCount().catch(() => null)));
  return models.map((m, i) => {
    const fields = describeFields(m.schema)
      .map((f) => f.path)
      .filter((p) => !p.includes('.'));
    return {
      name: m.modelName,
      collection: m.collection.name,
      docs: counts[i],
      note: COLLECTION_NOTES[m.modelName] || '',
      fields: fields.slice(0, 60),
      moreFields: Math.max(0, fields.length - 60),
    };
  });
}

/** Recursively drop sensitive keys and trim long strings from query output. */
function sanitize(value, depth = 0) {
  if (value == null) return value;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof mongoose.Types.ObjectId) return String(value);
  if (Array.isArray(value)) return value.slice(0, 200).map((v) => sanitize(v, depth + 1));
  if (typeof value === 'object') {
    if (depth > 6) return '[nested]';
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (isSensitiveSegment(k)) continue;
      out[k] = sanitize(v, depth + 1);
    }
    return out;
  }
  if (typeof value === 'string' && value.length > 300) return value.slice(0, 300) + '…';
  return value;
}

async function sampleDocuments(model, n = 3) {
  const docs = await model.find({}).sort({ _id: -1 }).limit(n).lean().maxTimeMS(5000);
  return docs.map((d) => sanitize(d));
}

/* ─────────────── Pipeline validation ─────────────── */

const FORBIDDEN_OPERATORS = new Set([
  '$out', '$merge', '$function', '$accumulator', '$where',
  '$currentOp', '$collStats', '$indexStats', '$planCacheStats', '$listSessions',
  '$listLocalSessions', '$changeStream',
  // These turn field *names* into values, which would slip sensitive
  // fields past key-based stripping.
  '$objectToArray', '$getField', '$setField', '$unsetField',
]);
const FIELD_NAME_KEYS = new Set(['localField', 'foreignField', 'connectFromField', 'connectToField', 'startWith']);
const COLLECTION_REF_STAGES = ['$lookup', '$graphLookup', '$unionWith'];

// "$field.path" references (not "$$VARIABLES").
function fieldRefPath(str) {
  if (typeof str !== 'string' || !str.startsWith('$') || str.startsWith('$$')) return null;
  return str.slice(1);
}

function validatePipeline(pipeline) {
  if (!Array.isArray(pipeline)) throw new Error('pipeline must be a JSON array of stages');
  if (pipeline.length > 30) throw new Error('pipeline has too many stages (max 30)');
  const allowedColls = allowedCollectionNames();

  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (typeof node === 'string') {
      const ref = fieldRefPath(node);
      if (ref && isSensitivePath(ref)) throw new Error(`field "${ref}" is not available`);
      return;
    }
    if (!node || typeof node !== 'object' || node instanceof Date) return;
    for (const [key, val] of Object.entries(node)) {
      if (FORBIDDEN_OPERATORS.has(key)) throw new Error(`${key} is not allowed (read-only access)`);
      if (!key.startsWith('$') && isSensitivePath(key)) throw new Error(`field "${key}" is not available`);
      if (FIELD_NAME_KEYS.has(key) && typeof val === 'string' && isSensitivePath(val.replace(/^\$/, ''))) {
        throw new Error(`field "${val}" is not available`);
      }
      if (COLLECTION_REF_STAGES.includes(key)) {
        const from = typeof val === 'string' ? val : val?.from || val?.coll;
        if (!allowedColls.has(from)) throw new Error(`${key} to collection "${from}" is not allowed`);
      }
      walk(val);
    }
  };
  walk(pipeline);
}

/** JSON.parse that turns {"$date": "..."} into real Dates. */
function parsePipeline(json) {
  const parsed = typeof json === 'string' ? JSON.parse(json) : json;
  const revive = (node) => {
    if (Array.isArray(node)) return node.map(revive);
    if (node && typeof node === 'object') {
      const keys = Object.keys(node);
      if (keys.length === 1 && keys[0] === '$date') return new Date(node.$date);
      return Object.fromEntries(keys.map((k) => [k, revive(node[k])]));
    }
    return node;
  };
  return revive(parsed);
}

const MAX_ROWS = 200;

/** Validate + run a read-only aggregation. Returns sanitized rows. */
async function runAggregation(collection, pipelineJson) {
  const model = findModel(collection);
  if (!model) throw new Error(`unknown or restricted collection "${collection}"`);
  const pipeline = parsePipeline(pipelineJson);
  validatePipeline(pipeline);
  const rows = await model
    .aggregate([...pipeline, { $limit: MAX_ROWS + 1 }])
    .option({ maxTimeMS: 15000, allowDiskUse: false });
  return {
    collection: model.modelName,
    rows: rows.slice(0, MAX_ROWS).map((r) => sanitize(r)),
    truncated: rows.length > MAX_ROWS,
  };
}

module.exports = {
  findModel,
  describeFields,
  collectionCatalogue,
  sampleDocuments,
  runAggregation,
  parsePipeline,
  validatePipeline,
};
