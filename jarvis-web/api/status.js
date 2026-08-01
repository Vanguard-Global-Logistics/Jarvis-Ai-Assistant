// GET/POST /api/status — reports whether a key is configured, WITHOUT calling
// the model (so it costs nothing). Used by the page to show an honest mode tag.
module.exports = async (req, res) => {
  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);
  res.status(200).json({ mode: hasKey ? 'live' : 'mock' });
};
