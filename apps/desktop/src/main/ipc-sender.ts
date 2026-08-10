export type IpcSenderValidator = (senderFrameUrl: string) => boolean;

export interface TrustedRendererUrls {
  readonly packagedEntryUrl: string;
  readonly developmentUrl: string | null;
}

function parseUrl(value: string, label: string): URL {
  try {
    return new URL(value);
  } catch {
    throw new Error(`${label} must be an absolute URL`);
  }
}

function isLoopback(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

/**
 * Build the fail-closed sender policy used by every privileged IPC contract.
 *
 * Packaged IPC is accepted only from the exact renderer entry document.
 * Development IPC is accepted from the configured loopback origin so Vite
 * routes and hot reload continue to work. Remote development origins fail
 * during startup instead of silently becoming trusted renderers.
 */
export function createIpcSenderValidator(config: TrustedRendererUrls): IpcSenderValidator {
  const packagedEntry = parseUrl(config.packagedEntryUrl, 'packagedEntryUrl');
  if (packagedEntry.protocol !== 'file:') {
    throw new Error('packagedEntryUrl must use file: until the custom Jarvis protocol ships');
  }
  if (packagedEntry.username !== '' || packagedEntry.password !== '') {
    throw new Error('packagedEntryUrl must not contain credentials');
  }

  let developmentOrigin: string | null = null;
  if (config.developmentUrl !== null) {
    const development = parseUrl(config.developmentUrl, 'developmentUrl');
    if (
      (development.protocol !== 'http:' && development.protocol !== 'https:') ||
      !isLoopback(development.hostname) ||
      development.username !== '' ||
      development.password !== ''
    ) {
      throw new Error('developmentUrl must be an unauthenticated loopback HTTP(S) URL');
    }
    developmentOrigin = development.origin;
  }

  return (senderFrameUrl: string): boolean => {
    let sender: URL;
    try {
      sender = new URL(senderFrameUrl);
    } catch {
      return false;
    }
    if (sender.username !== '' || sender.password !== '') return false;
    if (sender.href === packagedEntry.href) return true;
    return (
      developmentOrigin !== null &&
      (sender.protocol === 'http:' || sender.protocol === 'https:') &&
      sender.origin === developmentOrigin
    );
  };
}
