import { ModelRefusalError } from '@jarvis/jarvis-core';

/**
 * Turn any failure from a model provider into a SAFE error to throw onward.
 *
 * The review finding carried into Checkpoint 2 (docs/status/AUTONOMOUS-SESSION-
 * HANDOFF.md) is explicit: "Never log provider/SDK errors verbatim — sanitize
 * before any logging the C2 wiring introduces." `handleContract` logs the
 * message of whatever the handler throws, so the sanitisation must happen HERE,
 * before the error reaches that logger — not after.
 *
 * A raw SDK error can carry a request URL, headers, a rate-limit body, or a
 * fragment of the outbound payload. None of that may reach a log line, and none
 * of it may reach the renderer. So this returns an Error whose message is a
 * fixed CATEGORY string and nothing else: the original `cause` is attached (for
 * a debugger attached to the main process) but never interpolated into the
 * message.
 *
 * The renderer never sees even this category — `handleContract` collapses every
 * handler failure to `"<channel> failed"` across IPC. The category exists purely
 * so the main-process log distinguishes "the model declined" from "the call
 * broke" without disclosing anything sensitive.
 */
export function toSafeModelError(cause: unknown): Error {
  if (cause instanceof ModelRefusalError) {
    // A refusal is a normal, expected outcome, not a fault. Named so the log
    // reads as a decline rather than an incident.
    return new Error('model declined the request', { cause });
  }

  // Everything else — network, auth, rate limit, malformed response, a bug in
  // the adapter — collapses to one opaque category. Deliberately no detail:
  // the detail lives on `cause` for a local debugger, never in the message.
  return new Error('model call failed', { cause });
}
