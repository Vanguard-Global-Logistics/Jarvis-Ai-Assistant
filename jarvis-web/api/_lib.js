// Shared server-side helper for the Jarvis web functions.
// Underscore-prefixed files in /api are NOT treated as routes by Vercel.
//
// Talks to Anthropic's REST API directly with global fetch (Node 18+), so there
// is no SDK dependency to install or version-match. The API key is read from the
// ANTHROPIC_API_KEY environment variable on the server and NEVER sent to the
// browser.

const ANTHROPIC = 'https://api.anthropic.com/v1';

function authHeaders(apiKey) {
  return {
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json',
  };
}

let cachedModel = null;

// Pick a model without hard-coding an ID that might change. Honor an explicit
// ANTHROPIC_MODEL override; otherwise ask the account which models it has and
// prefer a Sonnet (good quality/cost balance), then Haiku (cheapest), then
// whatever is first.
async function resolveModel(apiKey) {
  if (process.env.ANTHROPIC_MODEL) return process.env.ANTHROPIC_MODEL;
  if (cachedModel) return cachedModel;
  const r = await fetch(`${ANTHROPIC}/models?limit=100`, { headers: authHeaders(apiKey) });
  if (!r.ok) {
    const body = await safeJson(r);
    throw new Error(body?.error?.message || `models list failed (HTTP ${r.status})`);
  }
  const data = await r.json();
  const ids = (data.data || []).map((m) => m.id);
  cachedModel =
    ids.find((id) => /sonnet/i.test(id)) ||
    ids.find((id) => /haiku/i.test(id)) ||
    ids[0];
  if (!cachedModel) throw new Error('no models available on this account');
  return cachedModel;
}

async function callMessages(apiKey, payload) {
  const r = await fetch(`${ANTHROPIC}/messages`, {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: JSON.stringify(payload),
  });
  const data = await safeJson(r);
  if (!r.ok) {
    const msg = data?.error?.message || `HTTP ${r.status}`;
    const err = new Error(msg);
    err.status = r.status;
    throw err;
  }
  return data;
}

function extractText(data) {
  return (data.content || [])
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('\n')
    .trim();
}

async function safeJson(r) {
  try {
    return await r.json();
  } catch {
    return null;
  }
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return {};
}

const JARVIS_SYSTEM = [
  "You are Jarvis, William Lavold's personal AI assistant and executive partner",
  'at Vanguard Global Logistics. Be direct, concise, and genuinely useful. Help',
  'with logistics operations, software projects, planning, and clear thinking.',
  'Never claim to have taken a real-world action (sending, buying, deploying) that',
  'you cannot actually perform — say what you would do instead. When you are',
  'uncertain, say so plainly.',
].join(' ');

module.exports = {
  authHeaders,
  resolveModel,
  callMessages,
  extractText,
  readBody,
  JARVIS_SYSTEM,
};
