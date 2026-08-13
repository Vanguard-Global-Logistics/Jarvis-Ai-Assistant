// @ts-check
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnvMap } from './lib/env-text.mjs';

/**
 * Ask the configured model provider, directly, what is wrong.
 *
 * WHY THIS EXISTS. Twice now a provider has failed with a status code and
 * nothing else — a 404 that was a malformed URL, then a 400 that could equally
 * have been a bad key or a retired model. Both times the answer was sitting in
 * the response body, and both times diagnosing it cost a round-trip: William
 * pasted a terminal into a chat, waited, pulled a change, and tried again.
 *
 * That round-trip is the actual defect. This script removes it. It makes ONE
 * real request with the real configuration and prints exactly what came back —
 * the status, the service's own sentence, and (where the service offers a model
 * list) the models this key can actually see, which is the fastest way to tell
 * "wrong key" from "wrong model name".
 *
 * WHAT IT NEVER PRINTS: the key. It reads credentials because it cannot make a
 * real request without them, and prints only whether each is set.
 * `packages/config/src/check-model-redaction.test.ts` plants fake keys and
 * asserts none of them appear in the output — the same promise
 * `npm run diagnostics` makes, tested the same way, because this output is
 * equally likely to be pasted into a chat window.
 *
 * Usage:
 *   npm run check:model              # whichever provider the app would use
 *   npm run check:model -- gemini    # a specific one
 *   npm run check:model -- --dry-run # what WOULD be used; opens no socket
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// --- .env ------------------------------------------------------------------

/**
 * Read `.env` with the same rules the app uses.
 *
 * The parser lives in `scripts/lib/env-text.mjs` and is pinned by test against
 * `parseEnvFile` in the app, because a diagnostic that parses differently from
 * the program it describes is worse than none — that exact mismatch reported
 * `local` while the app ran `mock` for a full day (ADR 0021, CLAUDE.md §8
 * rule 7).
 */
function readEnvFile() {
  const path = join(root, '.env');
  if (!existsSync(path)) return {};
  return parseEnvMap(readFileSync(path, 'utf8'));
}

/** The ambient environment wins, exactly as the app decides it (ADR 0021). */
function setting(/** @type {Record<string,string>} */ file, /** @type {string} */ key) {
  const ambient = process.env[key];
  if (ambient !== undefined && ambient !== '') return ambient;
  return file[key];
}

// --- provider descriptions --------------------------------------------------

/**
 * Everything this script needs to talk to one service.
 *
 * Deliberately a small table rather than an import of the real providers: the
 * point of this script is to be a SECOND opinion, reachable when the app itself
 * will not start. A version that shared the app's code would fail in the same
 * way the app does, and tell you nothing new.
 */
const PROVIDERS = {
  gemini: {
    label: 'Gemini',
    keyName: 'GEMINI_API_KEY',
    modelKey: 'JARVIS_GEMINI_MODEL',
    defaultModel: 'gemini-2.5-flash',
    completions: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    models: 'https://generativelanguage.googleapis.com/v1beta/openai/models',
    keyPage: 'aistudio.google.com',
  },
  nvidia: {
    label: 'NVIDIA NIM',
    keyName: 'NVIDIA_API_KEY',
    modelKey: 'JARVIS_NVIDIA_MODEL',
    defaultModel: 'meta/llama-3.3-70b-instruct',
    completions: 'https://integrate.api.nvidia.com/v1/chat/completions',
    models: 'https://integrate.api.nvidia.com/v1/models',
    keyPage: 'build.nvidia.com',
  },
  grok: {
    label: 'Grok',
    keyName: 'XAI_API_KEY',
    modelKey: 'JARVIS_XAI_MODEL',
    defaultModel: 'grok-4',
    completions: 'https://api.x.ai/v1/chat/completions',
    models: 'https://api.x.ai/v1/models',
    keyPage: 'console.x.ai',
  },
};

/** Trim a service's error body down to the sentence a human needs. */
function detailOf(/** @type {string} */ body) {
  const trimmed = body.trim();
  if (trimmed === '') return '(empty body)';
  try {
    const raw = JSON.parse(trimmed);
    // Google wraps its error in an array. Observed, not guessed.
    const parsed = Array.isArray(raw) ? raw[0] : raw;
    const nested = parsed?.error;
    const message =
      typeof nested === 'object' && nested !== null
        ? nested.message
        : typeof nested === 'string'
          ? nested
          : parsed?.message;
    if (typeof message === 'string' && message.trim() !== '') {
      return message.replace(/\s+/g, ' ').trim();
    }
  } catch {
    // Not JSON; the raw text is the best available.
  }
  return trimmed.replace(/\s+/g, ' ').slice(0, 400);
}

/**
 * Remove the credential from anything about to be printed.
 *
 * Belt and braces: this script never interpolates the key deliberately, and a
 * service echoing it back would defeat that intention silently.
 */
function scrub(/** @type {string} */ text, /** @type {string|undefined} */ secret) {
  if (secret === undefined || secret.length < 8) return text;
  return text.split(secret).join('<redacted>');
}

// --- checks ----------------------------------------------------------------

async function checkLocal(/** @type {Record<string,string>} */ file) {
  const url = setting(file, 'JARVIS_LOCAL_MODEL_URL');
  const model = setting(file, 'JARVIS_LOCAL_MODEL');
  console.log('provider      : local (a model on this machine)');
  console.log(`endpoint      : ${url ?? '(not set)'}`);
  console.log(`model         : ${model ?? '(not set)'}`);
  if (url === undefined || model === undefined) {
    console.log('\nBoth JARVIS_LOCAL_MODEL_URL and JARVIS_LOCAL_MODEL must be set.');
    return 1;
  }

  const endpoint = url.replace(/\/+$/, '');
  const target = endpoint.endsWith('/v1')
    ? `${endpoint}/chat/completions`
    : `${endpoint}/v1/chat/completions`;
  console.log(`requesting    : ${target}\n`);
  if (DRY_RUN) {
    console.log('(--dry-run: stopping before the request)');
    return 0;
  }

  let response;
  try {
    response = await fetch(target, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
        stream: false,
        max_tokens: 20,
      }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (cause) {
    console.log(`✗ could not reach it: ${cause instanceof Error ? cause.message : String(cause)}`);
    console.log('\n  Is the runner started? For Ollama:  ollama serve');
    console.log(`  Is the model pulled?   ollama pull ${model}`);
    return 1;
  }

  const body = await response.text();
  if (!response.ok) {
    console.log(`✗ HTTP ${String(response.status)}`);
    console.log(`  it said: ${detailOf(body)}`);
    if (response.status === 404) {
      console.log(`\n  A 404 here usually means the model is not pulled: ollama pull ${model}`);
    }
    return 1;
  }

  /** @type {string} */
  let text;
  try {
    text = JSON.parse(body)?.choices?.[0]?.message?.content ?? '';
  } catch {
    console.log('✗ answered 200 but the body was not JSON.');
    return 1;
  }
  console.log('✓ it answered.');
  console.log(`  reply: ${String(text).replace(/\s+/g, ' ').slice(0, 200)}`);
  return 0;
}

async function checkHosted(
  /** @type {keyof typeof PROVIDERS} */ id,
  /** @type {Record<string,string>} */ file,
) {
  const p = PROVIDERS[id];
  const key = setting(file, p.keyName);
  const model = setting(file, p.modelKey) ?? p.defaultModel;

  console.log(`provider      : ${id} (${p.label})`);
  console.log(`${p.keyName.padEnd(14)}: ${key === undefined ? 'NOT SET' : '<set, never printed>'}`);
  console.log(`model         : ${model}`);
  if (key === undefined) {
    console.log(`\nNo key. Get one at ${p.keyPage} and put it in .env as ${p.keyName}=...`);
    return 1;
  }
  console.log(`requesting    : ${p.completions}\n`);
  // `--dry-run` stops here, before any socket is opened. It answers "what would
  // you use, and is the key even set?" without spending an API call — and it is
  // what lets the leak test exercise THIS branch hermetically. Without it the
  // test could only reach the providers that make no network call, which is
  // exactly the coverage hole that let a deliberately injected leak pass.
  if (DRY_RUN) {
    console.log('(--dry-run: stopping before the request)');
    return 0;
  }

  let response;
  try {
    response = await fetch(p.completions, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
        stream: false,
      }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (cause) {
    const why = cause instanceof Error ? cause.message : String(cause);
    console.log(`✗ could not reach it: ${scrub(why, key)}`);
    return 1;
  }

  const body = await response.text();

  if (response.ok) {
    /** @type {string} */
    let text;
    try {
      text = JSON.parse(body)?.choices?.[0]?.message?.content ?? '';
    } catch {
      console.log('✗ answered 200 but the body was not JSON.');
      return 1;
    }
    console.log('✓ it answered.');
    console.log(`  reply: ${scrub(String(text), key).replace(/\s+/g, ' ').slice(0, 200)}`);
    return 0;
  }

  console.log(`✗ HTTP ${String(response.status)}`);
  console.log(`  it said: ${scrub(detailOf(body), key)}`);

  // The two failures that look identical from a status code, separated: ask the
  // service which models this key can see. A list that arrives proves the key
  // works and the model name is the problem; a list that fails the same way
  // proves it is the key.
  console.log('\n  asking which models this key can see...');
  try {
    const listed = await fetch(p.models, {
      headers: { authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(30_000),
    });
    const listBody = await listed.text();
    if (!listed.ok) {
      console.log(`  ✗ the model list ALSO failed (HTTP ${String(listed.status)}).`);
      console.log(`    it said: ${scrub(detailOf(listBody), key)}`);
      console.log('\n  Both calls failing the same way points at the KEY, not the model.');
      console.log(`    Check ${p.keyName} in .env — regenerate it at ${p.keyPage} if unsure.`);
      return 1;
    }
    /** @type {string[]} */
    const names = (JSON.parse(listBody)?.data ?? [])
      .map((/** @type {{id?: unknown}} */ m) => String(m.id ?? ''))
      .filter(Boolean)
      .map((/** @type {string} */ n) => n.replace(/^models\//, ''));

    console.log(`  ✓ the key WORKS — it can see ${String(names.length)} models.`);
    console.log('\n  So the key is fine and the MODEL NAME is the problem.');
    const usable = names.filter((n) => !/embedding|aqa|imagen|veo|tts/i.test(n));
    console.log(`  Models this key can use:\n    ${usable.slice(0, 25).join('\n    ')}`);
    console.log(`\n  Set one of these in .env as ${p.modelKey}=<name> and try again.`);
  } catch (cause) {
    console.log(`  (could not list models: ${scrub(String(cause), key)})`);
  }
  return 1;
}

// --- main -------------------------------------------------------------------

const file = readEnvFile();
const argv = process.argv.slice(2);
/** Print what would be used, open no socket. */
const DRY_RUN = argv.includes('--dry-run');
const requested = argv.find((a) => !a.startsWith('--'));

/** Startup precedence, mirroring create-provider.ts. */
function chooseProvider() {
  if (requested !== undefined && requested !== '') return requested;
  const named = setting(file, 'JARVIS_MODEL_PROVIDER');
  if (named !== undefined) return named;
  if (setting(file, 'JARVIS_LOCAL_MODEL_URL') !== undefined) return 'local';
  if (setting(file, 'ANTHROPIC_API_KEY') !== undefined) return 'anthropic';
  if (setting(file, 'GEMINI_API_KEY') !== undefined) return 'gemini';
  if (setting(file, 'XAI_API_KEY') !== undefined) return 'grok';
  if (setting(file, 'NVIDIA_API_KEY') !== undefined) return 'nvidia';
  return 'mock';
}

const chosen = chooseProvider();
console.log('─'.repeat(64));
console.log('  MODEL CHECK — one real request, so the service explains itself');
console.log('─'.repeat(64));
console.log(`.env found    : ${existsSync(join(root, '.env')) ? 'yes' : 'NO'}`);

let code = 0;
if (chosen === 'local') {
  code = await checkLocal(file);
} else if (chosen === 'gemini' || chosen === 'grok' || chosen === 'nvidia') {
  code = await checkHosted(chosen, file);
} else if (chosen === 'mock') {
  console.log('provider      : mock');
  console.log('\nNothing to check — the mock provider makes no network calls.');
  console.log('Configure a real one in .env, or pass a name: npm run check:model -- gemini');
} else if (chosen === 'anthropic') {
  console.log('provider      : anthropic');
  console.log(
    `ANTHROPIC_API_KEY: ${setting(file, 'ANTHROPIC_API_KEY') === undefined ? 'NOT SET' : '<set, never printed>'}`,
  );
  console.log('\nNot checked here: Anthropic uses its own SDK rather than this dialect.');
} else {
  console.log(`\nUnknown provider "${chosen}". Try: local, gemini, grok, nvidia, anthropic, mock`);
  code = 1;
}

console.log('─'.repeat(64));
process.exit(code);
