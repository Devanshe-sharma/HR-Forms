/**
 * Minimal Gemini REST client (generateContent with function calling).
 * Config: GEMINI_API_KEY (required), GEMINI_MODEL (default gemini-3.5-flash-lite).
 */
const axios = require('axios');

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// 503 "high demand" / 500 are usually transient — retry with backoff.
// 429 (quota) waits for the delay Google asks for, since retrying sooner
// just burns more of the per-minute quota (free tier is 5 requests/min).
const RETRYABLE = new Set([500, 503]);
const RETRY_DELAYS_MS = [1000, 3000, 6000];
const MAX_QUOTA_WAIT_MS = 40000;

function quotaRetryDelayMs(err) {
  const info = (err.response?.data?.error?.details || []).find((d) => d['@type']?.endsWith('RetryInfo'));
  const secs = parseFloat(info?.retryDelay);
  return Number.isFinite(secs) ? Math.ceil(secs * 1000) + 500 : null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function geminiConfigured() {
  return !!process.env.GEMINI_API_KEY;
}

async function generateContent({ systemInstruction, contents, tools }) {
  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  let quotaWaited = false;
  for (let attempt = 0; ; attempt++) {
    try {
      const { data } = await axios.post(
        `${BASE_URL}/${model}:generateContent`,
        {
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents,
          tools,
          generationConfig: { temperature: 0.2 },
        },
        {
          headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY, 'Content-Type': 'application/json' },
          timeout: 60000,
        }
      );
      const candidate = data.candidates?.[0];
      if (!candidate?.content) {
        const reason = data.promptFeedback?.blockReason || candidate?.finishReason || 'no response';
        throw new Error(`Gemini returned no content (${reason})`);
      }
      return candidate.content; // { role: 'model', parts: [...] }
    } catch (err) {
      const status = err.response?.status;
      const apiMsg = err.response?.data?.error?.message;
      if (RETRYABLE.has(status) && attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      if (status === 429) {
        const wait = quotaRetryDelayMs(err);
        if (!quotaWaited && wait && wait <= MAX_QUOTA_WAIT_MS) {
          quotaWaited = true;
          await sleep(wait);
          continue;
        }
        const daily = JSON.stringify(err.response?.data || '').includes('PerDay');
        throw new Error(daily
          ? 'Gemini daily quota used up for this API key (free tier) — it resets tomorrow, or enable billing on the key.'
          : 'Gemini per-minute quota reached (free tier) — wait a minute and try again, or enable billing on the key.');
      }
      if (status === 503) throw new Error('Gemini is busy right now (high demand) — please try again shortly.');
      if (status === 400 || status === 403 || status === 404) throw new Error(`Gemini request rejected: ${apiMsg || err.message}`);
      throw new Error(apiMsg || err.message);
    }
  }
}

module.exports = { generateContent, geminiConfigured };
