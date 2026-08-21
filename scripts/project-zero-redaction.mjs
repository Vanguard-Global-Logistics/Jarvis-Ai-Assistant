const REDACTION = '[REDACTED SECRET]';

const PATTERNS = [
  /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g,
  /\bsk-ant-[A-Za-z0-9_-]{12,}\b/g,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{12,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\b(?:Bearer|Authorization:\s*Bearer)\s+[A-Za-z0-9._~+\/-]{12,}={0,2}\b/gi,
  /\b(?:OPENAI_API_KEY|ANTHROPIC_API_KEY|SUPABASE_SERVICE_ROLE_KEY|PLAID_SECRET|VERCEL_TOKEN|DATABASE_URL)\s*[:=]\s*[^\s,;]+/gi,
  /\b(?:password|passwd|secret|api[_ -]?key|access[_ -]?token|refresh[_ -]?token)\s*[:=]\s*["']?[^\s,"';]{8,}["']?/gi,
];

export function redactSensitiveText(value) {
  if (typeof value !== 'string') return value;
  let redacted = value;
  for (const pattern of PATTERNS) {
    redacted = redacted.replace(pattern, REDACTION);
  }
  return redacted;
}

export function sanitizeForCloud(value) {
  if (typeof value === 'string') return redactSensitiveText(value);
  if (Array.isArray(value)) return value.map(sanitizeForCloud);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, sanitizeForCloud(child)]),
    );
  }
  return value;
}

export function containsCredentialLikeData(value) {
  if (typeof value !== 'string') return false;
  return redactSensitiveText(value) !== value;
}

export { REDACTION };
