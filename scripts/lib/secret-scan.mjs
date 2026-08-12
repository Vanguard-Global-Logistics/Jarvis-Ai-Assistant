// @ts-check

/**
 * Find anything credential-shaped in text that is about to leave the machine.
 *
 * Extracted into its own module so it can be tested DIRECTLY. The first version
 * lived inside `review-packet.mjs`, and the test tried to exercise it by
 * planting a fake key in the working tree — which proved nothing, because the
 * packet is built from `base...HEAD` (committed history) and a three-dot diff
 * never reads the worktree. The test passed the "refuses" cases for the wrong
 * reason and would have passed against a scanner that did nothing at all.
 *
 * Testing the function is the honest version. The script's job is then only to
 * call it and exit.
 */

/**
 * Patterns for real, currently-issued credential formats.
 *
 * Deliberately specific rather than a generic "long random string": a loose
 * pattern fires on hashes, UUIDs and base64 blobs, and a guard that always fires
 * is one people route around — which is worse than a narrower guard that fires
 * only when it means something.
 */
export const SECRET_PATTERNS = [
  { re: /sk-ant-[A-Za-z0-9_-]{16,}/, exemptible: true },
  { re: /sk-[A-Za-z0-9]{20,}/, exemptible: true },
  { re: /AIza[A-Za-z0-9_-]{20,}/, exemptible: true },
  { re: /xai-[A-Za-z0-9]{16,}/, exemptible: true },
  { re: /ghp_[A-Za-z0-9]{20,}/, exemptible: true },
  {
    // A PEM header, then ANY characters, then a real base64 run.
    //
    // This pattern went wrong twice in an hour, in opposite directions, and the
    // swarm caught both by RUNNING the module rather than reading the regex:
    //
    //  1. Requiring the body via `[A-Za-z0-9+/=\s]*?` failed OPEN on a deletion
    //     line, because `-` is not in that class — and the commit that removes a
    //     leaked key is precisely the commit whose diff contains the key. It
    //     missed passphrase-encrypted PEMs too: `Proc-Type:` and `DEK-Info:` sit
    //     between header and body, and `:` `,` are not in the class either.
    //  2. Matching the header line alone (`[^\n]*`) fixed that and opened a
    //     BYPASS: the matched value became the whole line, so a single `EXAMPLE`
    //     on it exempted the match and the real key body below was never
    //     examined.
    //
    // `[\s\S]{0,400}?` admits any gap — diff prefixes, PEM headers, escaped
    // `\n` in a JSON service-account key — while still requiring 40 contiguous
    // base64 characters, which prose about PEM files does not contain.
    re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]{0,400}?[A-Za-z0-9+/]{40}/,
    // NOT exemptible. A fixture marker anywhere in a span this long — including
    // one a leaker could add on purpose — must never disarm a private key.
    exemptible: false,
  },
];

/**
 * Markers that prove a key-shaped string is a TEST FIXTURE.
 *
 * This repository deliberately contains key-shaped values: the redaction tests
 * plant them precisely so they can assert nothing leaks. Without this, a scan of
 * the whole branch refuses every time.
 *
 * No real credential contains the word PLANTED. The marker is matched INSIDE the
 * matched value, not merely nearby, so a real key on the next line is still
 * caught.
 *
 * **This applies only to patterns marked `exemptible`.** A private key is never
 * exempted: its match spans hundreds of characters, so a marker sitting anywhere
 * in that span — including one added deliberately — would disarm the guard, and
 * that is too much rope for the one credential you cannot rotate quietly.
 */
export const FIXTURE_MARKERS = /PLANTED|NOT-?REAL|EXAMPLE|FAKE|DUMMY|pretend/i;

/**
 * The first genuine-looking credential in `text`, or `null`.
 *
 * @param {string} text
 * @returns {string | null}
 */
export function findSecret(text) {
  for (const { re, exemptible } of SECRET_PATTERNS) {
    // `matchAll` rather than `exec`: the first hit for a pattern may be a
    // fixture while a later one is real, and stopping at the first would let the
    // real one through behind it.
    for (const match of text.matchAll(new RegExp(re, 'g'))) {
      const value = match[0];
      if (exemptible && FIXTURE_MARKERS.test(value)) continue;
      return value;
    }
  }
  return null;
}
