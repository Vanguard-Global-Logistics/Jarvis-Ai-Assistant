// POST /api/amplify — Thought Amplifier v1.
// Body: { idea: string }
// Returns: { clarifiedIntent, missingQuestions[], improvedConcept,
//            recommendedNextStep, buildReadyPrompt } or { error }/{ provider:'mock' }

const { resolveModel, callMessages, extractText, readBody } = require('./_lib.js');

const AMP_SYSTEM = [
  "You are the Thought Amplifier inside Jarvis, William Lavold's executive partner.",
  'William gives you a rough idea. Do not answer it — help him discover the best',
  'version of his own thinking. Respond with ONLY a JSON object, no prose before or',
  'after, with exactly these keys:',
  '{"clarifiedIntent": string, "missingQuestions": string[], "improvedConcept": string,',
  '"recommendedNextStep": string, "buildReadyPrompt": string}.',
  'clarifiedIntent: what he is really trying to accomplish, 2-3 sentences.',
  'missingQuestions: the fewest, highest-leverage questions, one decision each.',
  'improvedConcept: a stronger version — sharper scope, bigger leverage, or simpler.',
  'recommendedNextStep: one concrete action he can take today.',
  'buildReadyPrompt: a complete prompt he can paste into a build session.',
  'Be direct and specific. Never invent facts he did not give you.',
].join(' ');

function parseCard(text) {
  // The model is asked for pure JSON, but be forgiving: pull the first {...}.
  let raw = text.trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) raw = raw.slice(start, end + 1);
  const obj = JSON.parse(raw);
  const card = {
    clarifiedIntent: String(obj.clarifiedIntent || '').trim(),
    missingQuestions: Array.isArray(obj.missingQuestions)
      ? obj.missingQuestions.map((q) => String(q).trim()).filter(Boolean)
      : [],
    improvedConcept: String(obj.improvedConcept || '').trim(),
    recommendedNextStep: String(obj.recommendedNextStep || '').trim(),
    buildReadyPrompt: String(obj.buildReadyPrompt || '').trim(),
  };
  if (
    !card.clarifiedIntent ||
    card.missingQuestions.length === 0 ||
    !card.improvedConcept ||
    !card.recommendedNextStep ||
    !card.buildReadyPrompt
  ) {
    throw new Error('incomplete amplifier fields');
  }
  return card;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const body = readBody(req);
  const idea = String(body.idea || '').trim();
  if (!idea) {
    res.status(400).json({ error: 'idea required' });
    return;
  }

  if (!apiKey) {
    res.status(200).json({
      provider: 'mock',
      clarifiedIntent: `[MOCK] You want to explore: ${idea}. Add ANTHROPIC_API_KEY in Vercel for a real amplification.`,
      missingQuestions: ['[MOCK] Who is this for, and what must it do on day one?', '[MOCK] What does success look like in 90 days?'],
      improvedConcept: `[MOCK] A sharper framing of "${idea}" would appear here.`,
      recommendedNextStep: '[MOCK] Write the one-paragraph problem statement.',
      buildReadyPrompt: `[MOCK] Build the smallest useful version of: ${idea}.`,
    });
    return;
  }

  try {
    const model = await resolveModel(apiKey);
    const data = await callMessages(apiKey, {
      model,
      max_tokens: 1200,
      system: AMP_SYSTEM,
      messages: [{ role: 'user', content: `Amplify this idea:\n\n${idea}` }],
    });
    const card = parseCard(extractText(data));
    res.status(200).json({ provider: 'anthropic', model, ...card });
  } catch (e) {
    res.status(200).json({
      provider: 'error',
      error:
        'The amplifier hit a problem: ' +
        (e && e.message ? e.message : 'unknown error') +
        '. (If this mentions the model, set ANTHROPIC_MODEL in Vercel.)',
    });
  }
};
