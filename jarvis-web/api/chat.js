// POST /api/chat  — one conversation turn.
// Body: { messages: [{ role: 'user'|'assistant', content: string }, ...] }
// Returns: { text, provider: 'anthropic'|'mock'|'error', model? }
//
// The API key lives only here on the server (process.env.ANTHROPIC_API_KEY).
// The browser never sees it.

const { resolveModel, callMessages, extractText, readBody, JARVIS_SYSTEM } = require('./_lib.js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // No key configured yet — behave like the mock so the page still works and
    // the UI labels it honestly.
    const body = readBody(req);
    const last = [...(body.messages || [])].reverse().find((m) => m.role === 'user');
    res.status(200).json({
      provider: 'mock',
      text:
        `[MOCK PROVIDER] I received: "${last ? last.content : 'your message'}". ` +
        'No API key is set on the server yet, so this is the offline reply. ' +
        'Add ANTHROPIC_API_KEY in Vercel → Settings → Environment Variables to make Jarvis think for real.',
    });
    return;
  }

  try {
    const body = readBody(req);
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (messages.length === 0) {
      res.status(400).json({ error: 'messages required' });
      return;
    }

    const model = await resolveModel(apiKey);
    const data = await callMessages(apiKey, {
      model,
      max_tokens: 1024,
      system: JARVIS_SYSTEM,
      messages: messages.map((m) => ({ role: m.role, content: String(m.content) })),
    });

    if (data.stop_reason === 'refusal') {
      res.status(200).json({ provider: 'anthropic', model, text: 'Jarvis declined that request.' });
      return;
    }

    const text = extractText(data) || '(Jarvis returned no text.)';
    res.status(200).json({ provider: 'anthropic', model, text });
  } catch (e) {
    // Surface a helpful, non-sensitive message. If it mentions the model, the
    // fix is setting ANTHROPIC_MODEL in Vercel.
    res.status(200).json({
      provider: 'error',
      text:
        'Jarvis hit a problem reaching the model: ' +
        (e && e.message ? e.message : 'unknown error') +
        '. (If this mentions the model or "not_found", set ANTHROPIC_MODEL in Vercel to a valid model id.)',
    });
  }
};
