import { ipcMain } from 'electron';
import type { z } from 'zod';
import type { IpcContract } from '@jarvis/contracts';
import { createLogger } from '@jarvis/config';
import type { IpcSenderValidator } from './ipc-sender.js';

const log = createLogger({ scope: 'desktop:main:ipc' });

/**
 * The only way to register an IPC handler in this application.
 *
 * Nothing calls `ipcMain.handle` directly. Routing every channel through here
 * means validation cannot be forgotten — the schema check is structural, not a
 * convention someone has to remember. SECURITY-BOUNDARIES.md requires the
 * cross-boundary contract be "authenticated, schema-validated" and reject
 * anything outside it.
 *
 * Four guarantees:
 *
 *   1. The sending frame is authenticated before its payload is inspected. A
 *      hostile frame cannot invoke privileged main-process code.
 *   2. The request is parsed before the implementation runs. A renderer cannot
 *      reach `impl` with a payload the schema does not admit.
 *   3. The response is parsed before it is returned. This catches OUR bugs —
 *      a main-process change that starts leaking an extra field fails here
 *      rather than in the UI.
 *   4. Errors are logged with the channel and returned as a flat message. The
 *      renderer never receives a stack trace, which would disclose filesystem
 *      paths.
 */
export function handleContract<Req extends z.ZodType, Res extends z.ZodType>(
  contract: IpcContract<Req, Res>,
  impl: (request: z.infer<Req>) => z.infer<Res> | Promise<z.infer<Res>>,
  validateSender: IpcSenderValidator,
): void {
  ipcMain.handle(contract.channel, async (event, rawRequest: unknown): Promise<z.infer<Res>> => {
    const senderFrameUrl = event.senderFrame?.url;
    if (senderFrameUrl === undefined || !validateSender(senderFrameUrl)) {
      // Do not log an untrusted URL: its path/query may contain secrets.
      log.warn('rejected untrusted sender', { channel: contract.channel });
      throw new Error(`Untrusted sender for ${contract.channel}`);
    }

    const request = contract.request.safeParse(rawRequest);

    if (!request.success) {
      // Log the channel and the validation issue, never the payload itself —
      // a rejected payload is untrusted input and may be hostile or sensitive.
      log.warn('rejected malformed request', {
        channel: contract.channel,
        issues: request.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
      });
      throw new Error(`Invalid request for ${contract.channel}`);
    }

    let result: z.infer<Res>;
    try {
      result = await impl(request.data);
    } catch (cause) {
      log.error('handler threw', {
        channel: contract.channel,
        message: cause instanceof Error ? cause.message : String(cause),
      });
      // `cause` is preserved for main-process logs but never crosses to the
      // renderer — Electron serialises only the message across IPC.
      throw new Error(`${contract.channel} failed`, { cause });
    }

    const response = contract.response.safeParse(result);
    if (!response.success) {
      log.error('handler produced a response that violates its own contract', {
        channel: contract.channel,
        issues: response.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
      });
      throw new Error(`${contract.channel} failed`);
    }

    return response.data;
  });
}
