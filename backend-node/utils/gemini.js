/**
 * Minimal Gemini REST client (generateContent with function calling).
 * Config: GEMINI_API_KEY (required), GEMINI_MODEL (default gemini-2.5-flash).
 */
const axios = require('axios');

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

function geminiConfigured() {
  return !!process.env.GEMINI_API_KEY;
}

async function generateContent({ systemInstruction, contents, tools }) {
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
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
    if (status === 429) throw new Error('Gemini rate limit / quota reached — try again in a minute.');
    if (status === 400 || status === 403) throw new Error(`Gemini request rejected: ${apiMsg || err.message}`);
    throw new Error(apiMsg || err.message);
  }
}

module.exports = { generateContent, geminiConfigured };
