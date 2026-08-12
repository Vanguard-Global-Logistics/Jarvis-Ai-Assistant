import { Menu, dialog } from 'electron';
import type { BrowserWindow, MenuItemConstructorOptions } from 'electron';
import { createLogger } from '@jarvis/config';
import type { AegisLevel } from '@jarvis/contracts';
import { AEGIS_LEVELS, levelRank } from '@jarvis/contracts';
import type { AegisAdmin } from '@jarvis/aegis';

/**
 * The AEGIS console, as a NATIVE APPLICATION MENU (ADR 0025).
 *
 * ## Why lowering lives here and not in the window
 *
 * The renderer can raise a level and cannot lower one — that asymmetry is the
 * design, and it left a real problem: with no lowering path anywhere, pressing
 * Restrict would be a one-way door. The level survives restarts by design, so
 * "quit and reopen" is not an escape either. A safety control you cannot undo is
 * a control people learn not to touch.
 *
 * The native menu is the answer because it is genuinely a different surface, not
 * a differently-styled one. It is CONSTRUCTED in main, its click handlers RUN in
 * main, and a compromised renderer — script injection, a hostile page, a model
 * output that reached the DOM — cannot click it. There is no IPC channel behind
 * these items; there is nothing to invoke.
 *
 * So the boundary holds in both directions:
 *
 *   - renderer → raise only, over a validated channel
 *   - native menu → lower, recover, and read the log, reachable only by a human
 *     with the actual application focused
 *
 * ## What is deliberately NOT here
 *
 * A keyboard shortcut for any of it. Accelerators are exactly what a stray
 * key-repeat or a mis-typed chord hits, and every item on this menu changes a
 * security posture. Menus are slower on purpose.
 */

const log = createLogger({ scope: 'desktop:aegis-menu' });

/**
 * `dialog.showMessageBox` has two overloads — with and without a parent window.
 * Branching picks the right one; the alternative is passing `undefined` through
 * a non-null assertion, which is a lie to the type system in the one file where
 * being precise matters most.
 *
 * The parent matters: a sheet attached to the window is modal to it, so an AEGIS
 * confirmation cannot be lost behind the app it is about.
 */
async function ask(
  window: BrowserWindow | null,
  options: Electron.MessageBoxOptions,
): Promise<number> {
  const result =
    window === null
      ? await dialog.showMessageBox(options)
      : await dialog.showMessageBox(window, options);
  return result.response;
}

/** Prompt for a lower level, then confirm. Two steps, both native. */
async function confirmLower(
  window: BrowserWindow | null,
  aegis: AegisAdmin,
  to: AegisLevel,
): Promise<void> {
  const current = aegis.status().level;

  const response = await ask(window, {
    type: 'warning',
    buttons: ['Cancel', `Lower to ${to}`],
    defaultId: 0,
    // Cancel on Escape, and Cancel as the default button: the safe choice should
    // be the one a distracted human gets by pressing return.
    cancelId: 0,
    title: 'AEGIS — lower the security level',
    message: `Lower AEGIS from ${current} to ${to}?`,
    detail:
      'This restores capabilities that were revoked. Only do this once you know why ' +
      'the level was raised and are satisfied it is resolved.\n\n' +
      'This action is recorded permanently in the AEGIS audit log.',
  });

  if (response !== 1) return;

  const result = aegis.lower(to, 'Lowered by a human at the AEGIS menu.');
  log.info('aegis lower requested from menu', {
    to,
    accepted: result.accepted,
    active: result.status.level,
  });

  if (!result.accepted) {
    await ask(window, {
      type: 'error',
      title: 'AEGIS refused',
      message: 'AEGIS did not lower the level.',
      detail: result.refusedBecause ?? 'No reason was given.',
    });
  }
}

/**
 * Dev-only blackout recovery.
 *
 * `SECURITY-BOUNDARIES.md` requires blackout recovery to be a separate
 * authenticated human workflow, and requires any dev-only path to be clearly
 * marked. The real workflow does not exist; this is the marked stand-in, and it
 * says so in its own title, its own dialog, and the audit entry it writes.
 */
async function confirmDevRecovery(window: BrowserWindow | null, aegis: AegisAdmin): Promise<void> {
  const response = await ask(window, {
    type: 'warning',
    buttons: ['Cancel', 'Recover (dev-only)'],
    defaultId: 0,
    cancelId: 0,
    title: 'AEGIS — DEV-ONLY blackout recovery',
    message: 'Recover from blackout using the DEVELOPMENT path?',
    detail:
      'This is NOT the real recovery workflow. The real one is a separate, ' +
      'authenticated, out-of-band process that does not exist yet.\n\n' +
      'This exists so a developer is not permanently locked out of their own build. ' +
      'It is recorded in the audit log as DEV-ONLY RECOVERY.',
  });

  if (response !== 1) return;

  const result = aegis.devOnlyRecoverFromBlackout('Recovered at the dev-only menu item.');
  log.info('aegis dev-only recovery', { accepted: result.accepted });
}

/** Show the audit log. Read-only — there is no delete anywhere in this app. */
async function showAuditLog(window: BrowserWindow | null, aegis: AegisAdmin): Promise<void> {
  // The last 20, newest first. The whole log can be long and a dialog is not a
  // log viewer; the recent transitions are what a human at this menu needs.
  const recent = [...aegis.auditLog()].slice(-20).reverse();
  const body = recent
    .map(
      (e) => `${e.at}  ${e.event.padEnd(20)} ${e.from ?? '—'} → ${e.to}  (${e.actor})  ${e.reason}`,
    )
    .join('\n');

  await ask(window, {
    type: 'info',
    title: 'AEGIS audit log',
    message: `The last ${String(recent.length)} AEGIS events, newest first.`,
    detail: body === '' ? 'The log is empty.' : body,
  });
}

/**
 * Build the AEGIS menu.
 *
 * Lowering items are enabled only for levels genuinely below the current one, so
 * the menu never offers an action AEGIS would refuse — a control that is
 * clickable and then declines teaches people to distrust the whole surface.
 */
export function buildAegisMenu(
  aegis: AegisAdmin,
  getWindow: () => BrowserWindow | null,
): MenuItemConstructorOptions {
  const current = aegis.status().level;

  const lowerItems: MenuItemConstructorOptions[] = AEGIS_LEVELS.filter(
    (level) => levelRank(level) < levelRank(current),
  ).map((level) => ({
    label: `Lower to ${level}…`,
    // Blackout never lifts through the ordinary path, so while blacked out this
    // list is empty by construction and the dev-only item is the only way back.
    enabled: current !== 'BLACK',
    click: () => {
      void confirmLower(getWindow(), aegis, level);
    },
  }));

  return {
    label: 'AEGIS',
    submenu: [
      { label: `Current level: ${current}`, enabled: false },
      { type: 'separator' },
      ...(lowerItems.length === 0
        ? [{ label: 'Nothing to lower — already at GREEN', enabled: false }]
        : lowerItems),
      { type: 'separator' },
      {
        label: 'DEV-ONLY: recover from blackout…',
        enabled: current === 'BLACK',
        click: () => {
          void confirmDevRecovery(getWindow(), aegis);
        },
      },
      { type: 'separator' },
      {
        label: 'View audit log…',
        click: () => {
          void showAuditLog(getWindow(), aegis);
        },
      },
    ],
  };
}

/**
 * Install the application menu, and rebuild it whenever the level changes.
 *
 * A menu built once at startup would show a stale level and offer stale lowering
 * options the moment anything raised the level — including the renderer's own
 * panic button. `refresh` is called after every transition, from the one place
 * transitions happen.
 */
export function installAegisMenu(
  aegis: AegisAdmin,
  getWindow: () => BrowserWindow | null,
): {
  refresh: () => void;
} {
  const build = (): void => {
    // The default menu carries the standard Edit/View/Window roles a Mac app is
    // expected to have — copy/paste in the composer stops working without them.
    const template: MenuItemConstructorOptions[] = [
      ...(process.platform === 'darwin'
        ? [{ role: 'appMenu' as const }]
        : ([] as MenuItemConstructorOptions[])),
      { role: 'editMenu' },
      { role: 'viewMenu' },
      { role: 'windowMenu' },
      buildAegisMenu(aegis, getWindow),
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  };

  build();
  return { refresh: build };
}
