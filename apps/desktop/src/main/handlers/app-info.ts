import { app } from 'electron';
import type { AppInfo } from '@jarvis/contracts';
import { appGetInfoContract } from '@jarvis/contracts';
import { handleContract } from '../ipc.js';

/**
 * `app:get-info` — static host facts for the status bar and bug reports.
 *
 * Reads only from Electron's own metadata. Nothing here touches the filesystem,
 * the environment, or user data, so there is nothing sensitive to leak: the
 * response schema is `.strict()`, so any future field added here without also
 * being added to the contract fails at the boundary instead of reaching the
 * renderer.
 */
export function registerAppInfoHandler(): void {
  handleContract(appGetInfoContract, (): AppInfo => {
    // `process.platform` is typed as the full NodeJS.Platform union, but the
    // contract admits only the three we support. Narrow explicitly rather than
    // casting — an unsupported platform should fail loudly at the boundary.
    const platform = process.platform;
    if (platform !== 'win32' && platform !== 'darwin' && platform !== 'linux') {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    return {
      appVersion: app.getVersion(),
      electronVersion: process.versions.electron,
      chromeVersion: process.versions.chrome,
      nodeVersion: process.versions.node,
      platform,
      arch: process.arch,
      isPackaged: app.isPackaged,
    };
  });
}
