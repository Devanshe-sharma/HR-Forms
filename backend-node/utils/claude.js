/**
 * Claude (Anthropic Messages API) client for the AI assistant.
 * Config: ANTHROPIC_API_KEY (required), CLAUDE_MODEL (default claude-opus-5).
 *
 * The SDK already retries 408/409/429/5xx/529 with backoff (maxRetries), so
 * errors reaching the caller here are the ones worth showing to the user.
 */
const Anthropic = require('@anthropic-ai/sdk');

let client = null;
function getClient() {
  if (!client) client = new Anthropic({ maxRetries: 3, timeout: 120000 });
  return client;
}

function claudeConfigured() {
  return !!process.env.ANTHROPIC_API_KEY;
}

// Cache breakpoint on the last block of the last message, so each tool round
// of one question re-reads the conversation so far from cache.
function withTrailingCacheBreakpoint(messages) {
  if (!messages.length) return messages;
  const last = messages[messages.length - 1];
  const content = typeof last.content === 'string' ? [{ type: 'text', text: last.content }] : [...last.content];
  content[content.length - 1] = { ...content[content.length - 1], cache_control: { type: 'ephemeral' } };
  return [...messages.slice(0, -1), { ...last, content }];
}

/**
 * One Messages API call.
 * @param {object} p
 * @param {string} p.stablePrompt  large, rarely-changing system text (cached)
 * @param {string} p.volatilePrompt per-request system text (date, user) — after the cache breakpoint
 * @param {Array}  p.messages
 * @param {Array}  p.tools
 */
async function createMessage({ stablePrompt, volatilePrompt, messages, tools }) {
  try {
    return await getClient().beta.messages.create({
      model: process.env.CLAUDE_MODEL || 'claude-opus-5',
      max_tokens: 16000,
      // If a safety classifier declines, the API re-runs the request on
      // Anthropic's recommended fallback model instead of refusing.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      // Render order is tools → system → messages: the breakpoint on the
      // stable system block caches the tool definitions too.
      system: [
        { type: 'text', text: stablePrompt, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: volatilePrompt },
      ],
      tools,
      messages: withTrailingCacheBreakpoint(messages),
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      throw new Error('Claude API key is invalid — check ANTHROPIC_API_KEY on the server.');
    } else if (err instanceof Anthropic.PermissionDeniedError) {
      throw new Error('This Claude API key is not allowed to use this model.');
    } else if (err instanceof Anthropic.RateLimitError) {
      throw new Error('Claude rate limit reached — please wait a minute and try again.');
    } else if (err instanceof Anthropic.BadRequestError) {
      throw new Error(`Claude rejected the request: ${err.message}`);
    } else if (err instanceof Anthropic.APIConnectionError) {
      throw new Error('Could not reach the Claude API — check the server\'s internet connection.');
    } else if (err instanceof Anthropic.APIError) {
      if (err.type === 'overloaded_error' || err.status === 529) {
        throw new Error('Claude is overloaded right now — please try again shortly.');
      }
      if (err.type === 'billing_error' || err.status === 402) {
        throw new Error('Claude API billing issue — check the account\'s credit balance.');
      }
      throw new Error(`Claude API error (${err.status}): ${err.message}`);
    }
    throw err;
  }
}

module.exports = { createMessage, claudeConfigured };
