// @ts-check

/**
 * Parse `.env` text — the plain-JavaScript twin of `parseEnvFile` in
 * `apps/desktop/src/main/env-file.ts`.
 *
 * WHY A TWIN EXISTS AT ALL. The app's parser is TypeScript inside a workspace
 * package; the diagnostic scripts run under bare `node` and cannot import it.
 * That is the same constraint that produced this project's most expensive bug
 * class: `scripts/collect-diagnostics.mjs` parsed `.env` with its own rules and
 * confidently reported `provider: local` while the running app used `mock`,
 * because nothing was loading the file at all (ADR 0021). A diagnostic that
 * disagrees with the program it describes is worse than no diagnostic.
 *
 * So the duplication is allowed and PINNED: `env-text-agreement.test.ts` runs a
 * fixture full of the awkward cases through both implementations and asserts
 * they produce identical output. If either drifts, that test fails, which is the
 * only thing that makes a second parser safe to keep.
 *
 * Keep this function byte-for-byte equivalent in BEHAVIOUR to `parseEnvFile`.
 * Not in style — in behaviour.
 *
 * @param {string} text
 * @returns {{ key: string, value: string }[]}
 */
export function parseEnvText(text) {
  /** @type {{ key: string, value: string }[]} */
  const entries = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;

    const withoutExport = line.startsWith('export ') ? line.slice('export '.length).trim() : line;
    const eq = withoutExport.indexOf('=');
    if (eq <= 0) continue;

    const key = withoutExport.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    let value = withoutExport.slice(eq + 1).trim();
    if (value.length >= 2 && /^(".*"|'.*')$/s.test(value)) value = value.slice(1, -1);

    entries.push({ key, value });
  }
  return entries;
}

/**
 * The same parse, as a lookup map with empty values dropped.
 *
 * Empty means "not configured" everywhere in this project — `.env.example`
 * ships every name with an empty value on purpose — so a caller asking whether
 * something is set should never have to remember that.
 *
 * @param {string} text
 * @returns {Record<string, string>}
 */
export function parseEnvMap(text) {
  /** @type {Record<string, string>} */
  const map = {};
  for (const { key, value } of parseEnvText(text)) {
    if (value !== '') map[key] = value;
  }
  return map;
}

/**
 * The key names SAFE to print in a report, split from those that are not.
 *
 * "Names only, never values" turned out to be insufficient on its own: a
 * multi-line credential's continuation line (`MIIEvQIB…SECRET…==`) parses as a
 * perfectly VALID key named by its own base64 body — all alphanumerics — so a
 * parser-level fix cannot make key material unprintable. The rule that can:
 * only names the repository itself declares in `.env.example` (committed,
 * value-free, canonical) are ever printed; anything else is a COUNT. A
 * credential fragment cannot be in the example file, so it cannot be printed,
 * by construction rather than by pattern-matching.
 *
 * @param {string} envText   the machine's real `.env` contents
 * @param {string} exampleText the committed `.env.example` contents
 * @returns {{ known: string[], unknownCount: number }}
 */
export function safeEnvNames(envText, exampleText) {
  const declared = new Set(parseEnvText(exampleText).map(({ key }) => key));
  const set = Object.keys(parseEnvMap(envText));
  return {
    known: set.filter((name) => declared.has(name)),
    unknownCount: set.filter((name) => !declared.has(name)).length,
  };
}
