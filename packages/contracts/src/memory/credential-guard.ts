/**
 * Refuse to store anything credential-shaped as a memory
 * (`docs/foundation/06-MEMORY-CONSTITUTION.md` §5).
 *
 * ## Why memory needs its own copy of this
 *
 * `scripts/lib/secret-scan.mjs` guards text that is about to leave the machine
 * in a review packet. This guards text about to be stored **forever and
 * replayed into every future prompt**, which is a strictly worse outcome: a
 * credential in a review packet is seen once by a reviewer, while a credential
 * in memory is silently re-sent to whatever brain is answering, in every session,
 * for as long as the row exists — including long after everyone has forgotten it
 * was written.
 *
 * The port is deliberate and pinned: `credential-guard.test.ts` imports
 * `SECRET_PATTERNS` from the `.mjs` and compares the live regex sources
 * structurally, so the two cannot drift without turning CI red.
 *
 * It has to be that comparison and not a cheaper one. The first version of this
 * test scraped the `.mjs` as TEXT and compared a pattern count plus six prefix
 * substrings — and this repository had already tried that and rejected it:
 * `packages/config/src/secret-scan-agreement.test.ts` records that the scraped
 * version "failed open two ways". Widening a character class keeps the count and
 * the prefixes identical, so memory would have kept the weaker rule with CI
 * green. Same arrangement as the Gauntlet skill's portable copy, which compares
 * the imported objects for the same reason.
 *
 * ## The one deliberate difference: no fixture exemption
 *
 * `secret-scan.mjs` exempts key-shaped strings carrying `PLANTED` / `EXAMPLE` /
 * `FAKE`, because this repository deliberately contains such values — the
 * redaction tests plant them so they can assert nothing leaks, and without the
 * exemption a scan of the whole branch refuses every time.
 *
 * **Memory has no such need and takes no such exemption.** Nobody types an
 * example API key as a durable fact about themselves, so the exemption would buy
 * nothing — while an attacker who knows about it gets a one-word bypass on the
 * one store that replays its contents into every prompt. Refusing a
 * hypothetical `sk-ant-EXAMPLE...` memory costs a person nothing; letting a real
 * one through costs them the key.
 */

/**
 * Credential formats, ported from `scripts/lib/secret-scan.mjs`.
 *
 * Deliberately specific rather than a generic "long random string": a loose
 * pattern fires on hashes, UUIDs and base64 blobs, and a guard that always fires
 * is one people route around — worse than a narrower guard that fires only when
 * it means something.
 */
export const MEMORY_CREDENTIAL_PATTERNS: readonly RegExp[] = [
  /sk-ant-[A-Za-z0-9_-]{16,}/,
  /sk-[A-Za-z0-9]{20,}/,
  /AIza[A-Za-z0-9_-]{20,}/,
  /xai-[A-Za-z0-9]{16,}/,
  /ghp_[A-Za-z0-9]{20,}/,
  // A PEM header, any gap, then a real base64 run. The `[\s\S]{0,400}?` gap
  // admits PEM headers (`Proc-Type:`, `DEK-Info:`) and escaped newlines from a
  // JSON service-account key, while still requiring 40 contiguous base64
  // characters — which prose about PEM files does not contain.
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]{0,400}?[A-Za-z0-9+/]{40}/,
];

/**
 * Does this text look like it contains a credential?
 *
 * Returns a boolean and **never the matched text**. Constitution §5: "A
 * rejection message must never echo the matched text back." A guard that
 * reports what it caught writes the secret into a log line, a screenshot, or a
 * pasted bug report — which is the exact disclosure it was built to prevent.
 */
export function looksLikeCredential(text: string): boolean {
  return MEMORY_CREDENTIAL_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * What a person is told when a memory is refused.
 *
 * Names the rule and the reason, quotes nothing back, and does not hedge. It is
 * phrased as a property of the system rather than an accusation, because the
 * overwhelmingly likely case is someone pasting a line of config without
 * thinking rather than anyone doing anything wrong.
 */
export const CREDENTIAL_REFUSED_MESSAGE =
  'That looks like an API key or password, so Jarvis will not remember it. ' +
  'Memories are replayed into every future conversation — including ones sent ' +
  'to a brain that leaves this machine. Keys belong in the .env file on this ' +
  'computer, which Jarvis reads but never stores and never shows.';
