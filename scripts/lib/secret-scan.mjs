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
  /sk-ant-[A-Za-z0-9_-]{16,}/,
  /sk-[A-Za-z0-9]{20,}/,
  /AIza[A-Za-z0-9_-]{20,}/,
  /xai-[A-Za-z0-9]{16,}/,
  /ghp_[A-Za-z0-9]{20,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
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
 */
export const FIXTURE_MARKERS = /PLANTED|NOT-?REAL|EXAMPLE|FAKE|DUMMY|pretend/i;

/**
 * The first genuine-looking credential in `text`, or `null`.
 *
 * @param {string} text
 * @returns {string | null}
 */
export function findSecret(text) {
  for (const pattern of SECRET_PATTERNS) {
    // `matchAll` rather than `exec`: the first hit for a pattern may be a
    // fixture while a later one is real, and stopping at the first would let the
    // real one through behind it.
    for (const match of text.matchAll(new RegExp(pattern, 'g'))) {
      const value = match[0];
      if (FIXTURE_MARKERS.test(value)) continue;
      return value;
    }
  }
  return null;
}
