/**
 * AI assistant (Gemini) — ask questions about HR data in plain English and
 * get answers + charts built from live, read-only MongoDB aggregations.
 *
 *   POST   /api/ai/chat                 { message, history? } → { answer, charts[] }
 *   GET    /api/ai/insights             pinned charts for the current user (with fresh data)
 *   POST   /api/ai/insights             pin a chart returned by /chat
 *   DELETE /api/ai/insights/:id
 *
 * Access: logged-in users whose role is in AI_ALLOWED_ROLES (default
 * Admin, HR, Management) — the assistant can read across modules, so it
 * bypasses per-page visibility and is limited to roles that see everything.
 * Sensitive fields are stripped / rejected in utils/aiData.js.
 */
const express = require('express');
const moment = require('moment-timezone');
const router = express.Router();
const { authenticate } = require('../middleware/authenticate');
const { generateContent, geminiConfigured } = require('../utils/gemini');
const AiInsight = require('../models/AiInsight');
const {
  findModel, describeFields, collectionCatalogue, sampleDocuments, runAggregation, parsePipeline, validatePipeline,
} = require('../utils/aiData');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const ALLOWED_ROLES = (process.env.AI_ALLOWED_ROLES || 'Admin,HR,Management')
  .split(',').map((r) => r.trim()).filter(Boolean);

function requireAiAccess(req, res, next) {
  if (!ALLOWED_ROLES.includes(req.user?.role)) {
    return res.status(403).json({ success: false, error: 'AI assistant is not enabled for your role' });
  }
  next();
}

router.use(authenticate, requireAiAccess);

const CHART_TYPES = ['bar', 'line', 'pie', 'table', 'metric'];
const MAX_TOOL_ROUNDS = 8;

/* ─────────────── Prompt ─────────────── */

// "status:String[Open|Closed]" — enum or observed values in brackets.
function fieldText(f) {
  const values = f.enum || f.values;
  return `${f.path}:${f.type}${values ? `[${values.join('|')}]` : ''}${f.example ? `(e.g. "${f.example}")` : ''}`;
}

let catalogueCache = { at: 0, text: '' };
async function catalogueText() {
  if (Date.now() - catalogueCache.at < 10 * 60 * 1000) return catalogueCache.text;
  const cat = await collectionCatalogue();
  const text = cat.map((c) =>
    `- ${c.name} (collection "${c.collection}", ~${c.docs ?? '?'} docs)${c.note ? ` — ${c.note}` : ''}\n` +
    `  fields: ${c.fields.map(fieldText).join(', ')}`
  ).join('\n');
  catalogueCache = { at: Date.now(), text };
  return text;
}

async function systemPrompt(user) {
  const today = moment().tz('Asia/Kolkata').format('dddd, D MMMM YYYY');
  return `You are the HR analytics assistant inside Brisk Olive's HR portal. Today is ${today} (Asia/Kolkata).
You are talking to ${user.name || 'a user'} (role: ${user.role}).

You answer questions about the company's HR data by querying MongoDB with read-only aggregation pipelines.

Available collections:
${await catalogueText()}

How to work (each tool call is a round trip against a small per-minute quota, so use as few as possible — ideally one tool call, then your answer):
1. The field list above is complete, with types; values in [brackets] are the actual values in the data, and (e.g. "…") shows the format of dates stored as strings. Only call describe_collection if you genuinely need sample documents (e.g. to see a date string format).
2. When a chart or table would help — or the user asks for analytics, a breakdown, a trend, a list or a comparison — call show_chart directly. It runs the pipeline, shows the real data to the user (who can pin it to their dashboard), and returns the rows to you, so you do NOT need a separate run_query first. Shape the output as flat rows, e.g. [{"department":"Sales","count":12}], and set xKey / yKeys to those field names. For a single number use chartType "metric" with one row and yKeys = [the value field].
3. Use run_query only for answers that need no visual (e.g. a yes/no or a single fact you'll state in words), or to look something up before charting.
4. You may call several tools in the same turn when they are independent.
5. Then reply with a short, direct answer in plain language (a few sentences or a short bullet list). Quote the actual numbers. Do not paste raw JSON or pipelines unless asked.

Query rules:
- Pipelines are JSON arrays passed as a string. For date literals use {"$date":"2026-01-01T00:00:00Z"} or "$$NOW".
- Many Employee fields are strings: convert with {"$convert":{"input":"$field","to":"double","onError":null,"onNull":null}} or $dateFromString with onError.
- Personal/sensitive fields (bank, Aadhaar, PAN, passport, phone, address, family, documents…) are not available; say so if asked.
- Write operations are impossible; you only read.
- If a query errors, read the error, fix the pipeline and retry.
- If the data can't answer the question, say what is missing instead of guessing. Never invent numbers.
- Keep people's details to what the question needs.`;
}

/* ─────────────── Tools ─────────────── */

const TOOLS = [{
  functionDeclarations: [
    {
      name: 'describe_collection',
      description: 'Get the full field list (with types and enum values) and a few recent sample documents for one collection.',
      parameters: {
        type: 'object',
        properties: { collection: { type: 'string', description: 'Model name, e.g. "Employee"' } },
        required: ['collection'],
      },
    },
    {
      name: 'run_query',
      description: 'Run a read-only MongoDB aggregation pipeline on one collection and get the resulting rows.',
      parameters: {
        type: 'object',
        properties: {
          collection: { type: 'string', description: 'Model name, e.g. "Employee"' },
          pipeline: { type: 'string', description: 'JSON array of aggregation stages' },
        },
        required: ['collection', 'pipeline'],
      },
    },
    {
      name: 'show_chart',
      description: 'Display a chart / table / metric to the user from an aggregation pipeline. The user can pin it to their dashboard.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string', description: 'One short line explaining the chart' },
          chartType: { type: 'string', enum: CHART_TYPES },
          collection: { type: 'string' },
          pipeline: { type: 'string', description: 'JSON array of aggregation stages producing flat rows' },
          xKey: { type: 'string', description: 'Row field used for the x-axis / pie labels (empty for metric)' },
          yKeys: { type: 'array', items: { type: 'string' }, description: 'Numeric row field(s) to plot' },
        },
        required: ['title', 'chartType', 'collection', 'pipeline', 'yKeys'],
      },
    },
  ],
}];

// Keeps what goes back to the model small; the user still gets full chart data.
function forModel(rows, limit = 50) {
  let payload = { rowCount: rows.length, rows: rows.slice(0, limit) };
  let text = JSON.stringify(payload);
  while (text.length > 20000 && payload.rows.length > 5) {
    payload = { ...payload, rows: payload.rows.slice(0, Math.floor(payload.rows.length / 2)), note: 'rows truncated' };
    text = JSON.stringify(payload);
  }
  return payload;
}

async function runTool(name, args, charts) {
  if (name === 'describe_collection') {
    const model = findModel(args.collection);
    if (!model) return { error: `unknown or restricted collection "${args.collection}"` };
    return {
      collection: model.modelName,
      mongoCollectionName: model.collection.name,
      fields: describeFields(model.schema),
      samples: await sampleDocuments(model),
    };
  }

  if (name === 'run_query') {
    const result = await runAggregation(args.collection, args.pipeline);
    return { ...forModel(result.rows), truncated: result.truncated };
  }

  if (name === 'show_chart') {
    const chartType = CHART_TYPES.includes(args.chartType) ? args.chartType : 'bar';
    const result = await runAggregation(args.collection, args.pipeline);
    const chart = {
      title: String(args.title || 'Chart'),
      description: String(args.description || ''),
      chartType,
      collection: result.collection,
      pipeline: typeof args.pipeline === 'string' ? args.pipeline : JSON.stringify(args.pipeline),
      xKey: String(args.xKey || ''),
      yKeys: Array.isArray(args.yKeys) ? args.yKeys.map(String) : [],
      data: result.rows,
    };
    charts.push(chart);
    return { shown: true, ...forModel(result.rows, 20) };
  }

  return { error: `unknown tool ${name}` };
}

/* ─────────────── Routes ─────────────── */

router.post('/chat', asyncHandler(async (req, res) => {
  if (!geminiConfigured()) {
    return res.status(503).json({ success: false, error: 'GEMINI_API_KEY is not set on the server' });
  }
  const message = String(req.body?.message || '').trim();
  if (!message) return res.status(400).json({ success: false, error: 'message is required' });
  if (message.length > 2000) return res.status(400).json({ success: false, error: 'message is too long' });

  // Text-only history from the client (last few turns) for follow-up questions.
  const history = (Array.isArray(req.body?.history) ? req.body.history : [])
    .slice(-10)
    .filter((h) => (h.role === 'user' || h.role === 'model') && typeof h.text === 'string' && h.text.trim())
    .map((h) => ({ role: h.role, parts: [{ text: h.text.slice(0, 4000) }] }));

  const contents = [...history, { role: 'user', parts: [{ text: message }] }];
  const systemInstruction = await systemPrompt(req.user);
  const charts = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const content = await generateContent({ systemInstruction, contents, tools: TOOLS });
    const parts = content.parts || [];
    const calls = parts.filter((p) => p.functionCall);

    if (!calls.length) {
      const answer = parts.map((p) => p.text || '').join('').trim();
      return res.json({ success: true, answer: answer || 'Done.', charts });
    }

    // Echo the model turn back unchanged (keeps thought signatures intact).
    contents.push(content);
    const responses = [];
    for (const { functionCall } of calls) {
      let response;
      try {
        response = await runTool(functionCall.name, functionCall.args || {}, charts);
      } catch (err) {
        response = { error: err.message };
      }
      responses.push({ functionResponse: { name: functionCall.name, response } });
    }
    contents.push({ role: 'user', parts: responses });
  }

  res.json({
    success: true,
    answer: charts.length
      ? 'Here is what I found.'
      : 'Sorry — I could not finish that analysis. Try rephrasing or narrowing the question.',
    charts,
  });
}));

router.get('/insights', asyncHandler(async (req, res) => {
  const insights = await AiInsight.find({ createdBy: req.user.id }).sort({ createdAt: -1 }).lean();
  const data = await Promise.all(insights.map(async (ins) => {
    try {
      const result = await runAggregation(ins.collectionName, ins.pipeline);
      return { ...ins, data: result.rows };
    } catch (err) {
      return { ...ins, data: [], error: err.message };
    }
  }));
  res.json({ success: true, data });
}));

router.post('/insights', asyncHandler(async (req, res) => {
  const { title, description, question, chartType, xKey, yKeys, collection, pipeline } = req.body || {};
  if (!title || !collection || !pipeline) {
    return res.status(400).json({ success: false, error: 'title, collection and pipeline are required' });
  }
  const model = findModel(collection);
  if (!model) return res.status(400).json({ success: false, error: 'unknown or restricted collection' });
  try {
    validatePipeline(parsePipeline(pipeline));
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
  const insight = await AiInsight.create({
    createdBy: req.user.id,
    title: String(title).slice(0, 200),
    description: String(description || '').slice(0, 500),
    question: String(question || '').slice(0, 2000),
    chartType: CHART_TYPES.includes(chartType) ? chartType : 'bar',
    xKey: String(xKey || ''),
    yKeys: Array.isArray(yKeys) ? yKeys.map(String) : [],
    collectionName: model.modelName,
    pipeline: typeof pipeline === 'string' ? pipeline : JSON.stringify(pipeline),
  });
  res.status(201).json({ success: true, data: insight });
}));

router.delete('/insights/:id', asyncHandler(async (req, res) => {
  const deleted = await AiInsight.findOneAndDelete({ _id: req.params.id, createdBy: req.user.id });
  if (!deleted) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true });
}));

// Surface errors as JSON so the chat panel can show them.
router.use((err, req, res, next) => {
  console.error('AI route error:', err.message);
  res.status(500).json({ success: false, error: err.message || 'AI request failed' });
});

module.exports = router;
