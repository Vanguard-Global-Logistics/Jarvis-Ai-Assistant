// @ts-check

/**
 * launchd plist generation for the headless Mac (ADR 0033; ADR 0030 §1c).
 *
 * Pure functions, so the test asserts the actual XML rather than trusting a
 * script it never ran. The installer's only jobs are: refuse off-macOS, write
 * these files, and run `launchctl`.
 *
 * Two agents:
 *
 *   - `com.jarvis.desktop` — starts Jarvis when the account logs in and
 *     restarts it if it dies (`KeepAlive`). Runs `npm run dev:awake`, which is
 *     the app plus `caffeinate`, because a head node that sleeps is a head node
 *     that is down (ADR 0012).
 *   - `com.jarvis.health` — runs `npm run health` every 30 minutes, appending
 *     to a log under `~/Library/Logs/Jarvis/`. When something breaks on a box
 *     nobody watches, the evidence is already written down.
 *
 * LaunchAgents, not LaunchDaemons, deliberately: the app needs the logged-in
 * user's session (a GUI, the user's keychain, the user's `~`). The Mac must be
 * set to log the account in automatically for this to survive a reboot — that
 * is a System Settings step only a human at the machine once can do, and the
 * installer SAYS so rather than implying reboot-proofness it cannot deliver.
 */

/** Escape the five XML-significant characters for text nodes. */
const escapeXml = (value) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

/**
 * One plist. `npmPath` is the ABSOLUTE path to npm — launchd starts agents
 * with a minimal PATH that does not include nvm/homebrew locations, which is
 * the classic way a LaunchAgent works in a terminal test and never at login.
 *
 * @param {object} spec
 * @param {string} spec.label
 * @param {string} spec.npmPath
 * @param {string} spec.npmScript
 * @param {string} spec.repoDir
 * @param {string} spec.logPath
 * @param {string} spec.nodeBinDir
 * @param {boolean} [spec.keepAlive]
 * @param {number} [spec.startIntervalSeconds]
 * @returns {string}
 */
export function buildPlist({
  label,
  npmPath,
  npmScript,
  repoDir,
  logPath,
  nodeBinDir,
  keepAlive = false,
  startIntervalSeconds,
}) {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    '<dict>',
    `  <key>Label</key><string>${escapeXml(label)}</string>`,
    '  <key>ProgramArguments</key>',
    '  <array>',
    `    <string>${escapeXml(npmPath)}</string>`,
    '    <string>run</string>',
    `    <string>${escapeXml(npmScript)}</string>`,
    '  </array>',
    `  <key>WorkingDirectory</key><string>${escapeXml(repoDir)}</string>`,
    // An explicit PATH, because the npm path alone is NOT enough — a critic
    // proved it one process deeper: `dev:awake` spawns bare `npm` and
    // `caffeinate` by NAME, and under launchd's minimal PATH those raise
    // ENOENT even when ProgramArguments[0] itself is absolute. The node bin
    // dir (where npm and node live for nvm/homebrew installs) is prepended to
    // the system defaults.
    '  <key>EnvironmentVariables</key>',
    '  <dict>',
    `    <key>PATH</key><string>${escapeXml(nodeBinDir)}:/usr/bin:/bin:/usr/sbin:/sbin</string>`,
    '  </dict>',
    '  <key>RunAtLoad</key><true/>',
  ];
  if (keepAlive) lines.push('  <key>KeepAlive</key><true/>');
  if (startIntervalSeconds !== undefined) {
    lines.push(`  <key>StartInterval</key><integer>${String(startIntervalSeconds)}</integer>`);
  }
  lines.push(
    `  <key>StandardOutPath</key><string>${escapeXml(logPath)}</string>`,
    `  <key>StandardErrorPath</key><string>${escapeXml(logPath)}</string>`,
    '</dict>',
    '</plist>',
    '',
  );
  return lines.join('\n');
}

/**
 * Both agents for a given machine. Paths are REAL, passed in from the running
 * environment — never a `~/path/to/` placeholder, per the standing rule that
 * placeholders get pasted literally.
 */
export function buildAgents({ repoDir, npmPath, logsDir, nodeBinDir }) {
  return [
    {
      filename: 'com.jarvis.desktop.plist',
      content: buildPlist({
        label: 'com.jarvis.desktop',
        npmPath,
        npmScript: 'dev:awake',
        repoDir,
        logPath: `${logsDir}/desktop.log`,
        nodeBinDir,
        keepAlive: true,
      }),
    },
    {
      filename: 'com.jarvis.health.plist',
      content: buildPlist({
        label: 'com.jarvis.health',
        npmPath,
        npmScript: 'health',
        repoDir,
        logPath: `${logsDir}/health.log`,
        nodeBinDir,
        startIntervalSeconds: 1800,
      }),
    },
  ];
}
