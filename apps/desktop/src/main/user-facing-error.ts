/**
 * An error whose message is SAFE to show a person, and therefore crosses the
 * IPC boundary intact instead of being flattened to `"<channel> failed"`.
 *
 * ## Why this exists
 *
 * `handleContract` flattens every handler error on purpose: a vendor SDK error
 * can carry a filesystem path, a request body, or a credential, and none of
 * that may reach the renderer. That default is correct and stays the default.
 *
 * But it also flattened the errors written FOR a person. The credential refusal
 * in `memory:remember` (ADR 0029) is a paragraph explaining that keys belong in
 * `.env` — and `npm run probe:runtime` caught it arriving at the renderer as
 * `"memory:remember failed"`, which tells someone nothing and reads like a bug
 * in Jarvis rather than the deliberate refusal it is.
 *
 * The unit tests could not have caught that: they mocked the rejection with the
 * message they wanted to see. Only driving the real app over the real boundary
 * showed what a person would actually read. That is the same lesson ADR 0021
 * recorded — a test that injects the value it is checking proves nothing about
 * the path that produces it.
 *
 * ## The rule that keeps the exception safe
 *
 * **A `UserFacingError` message must be built from constants only.** Never
 * interpolate a caught error, a vendor response, a filesystem path, or — above
 * all — the input that was rejected. Anything that cannot meet that bar must be
 * a plain `Error`, so it gets flattened.
 *
 * It lives in its own module rather than in `ipc.ts` so that a domain-side
 * thrower (the memory store) does not have to import the IPC boundary to raise
 * one: dependencies point inward (CLAUDE.md §3).
 */
export class UserFacingError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'UserFacingError';
  }
}
