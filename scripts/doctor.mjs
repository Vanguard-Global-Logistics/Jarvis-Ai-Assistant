/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { platform, arch } from 'node:process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const REQUIRED_NODE_MAJOR = 22;

/**
 * @typedef {'PASS' | 'WARN' | 'FAIL'} DoctorStatus
 * @typedef {{status: DoctorStatus, name: string, detail: string}} DoctorCheck
 * @typedef {{environment?: Record<string, string | undefined>, nodeVersion?: string, root?: string}} DoctorOptions
 */

/**
 * @param {string} version
 * @returns {number}
 */
export function parseNodeMajor(version) {
  const major = Number.parseInt(version.split('.')[0] ?? '', 10);
  return Number.isFinite(major) ? major : 0;
}

/**
 * @param {string} raw
 * @returns {string}
 */
export function validateDoctorLocalUrl(raw) {
  const url = new URL(raw);
  const loopbackHosts = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

  if (
    url.protocol !== 'http:' ||
    !loopbackHosts.has(url.hostname) ||
    url.username !== '' ||
    url.password !== '' ||
    url.search !== '' ||
    url.hash !== ''
  ) {
    throw new Error('must be credential-free HTTP on the loopback interface');
  }

  return url.toString().replace(/\/$/, '');
}

function pass(name, detail) {
  return { status: 'PASS', name, detail };
}

function warn(name, detail) {
  return { status: 'WARN', name, detail };
}

function fail(name, detail) {
  return { status: 'FAIL', name, detail };
}

async function checkLocalInference(environment) {
  if (environment.HIVE_LOCAL_AI_MODE !== 'local-only') {
    return warn(
      'Local inference',
      'disabled; set HIVE_LOCAL_AI_MODE=local-only after installing the local sidecar',
    );
  }

  let baseUrl;
  try {
    baseUrl = validateDoctorLocalUrl(environment.HIVE_LOCAL_AI_URL ?? 'http://127.0.0.1:8000');
  } catch (error) {
    return fail('Local inference', `invalid HIVE_LOCAL_AI_URL: ${error.message}`);
  }

  try {
    const response = await fetch(`${baseUrl}/v1/models`, {
      signal: AbortSignal.timeout(2_500),
    });
    if (!response.ok) {
      return fail('Local inference', `model endpoint returned HTTP ${response.status}`);
    }

    const body = await response.json();
    if (!Array.isArray(body?.data) || body.data.length === 0) {
      return fail('Local inference', 'model endpoint returned no installed models');
    }
    return pass('Local inference', `${body.data.length} model(s) available on loopback`);
  } catch (error) {
    return fail(
      'Local inference',
      `unreachable at ${baseUrl}; start the sidecar, then rerun npm run doctor (${error.message})`,
    );
  }
}

/**
 * @param {DoctorOptions} [options]
 * @returns {Promise<DoctorCheck[]>}
 */
export async function collectDoctorChecks({
  environment = process.env,
  nodeVersion = process.versions.node,
  root = process.cwd(),
} = {}) {
  const checks = [];
  const major = parseNodeMajor(nodeVersion);
  checks.push(
    major >= REQUIRED_NODE_MAJOR
      ? pass('Node.js', `v${nodeVersion}`)
      : fail('Node.js', `v${nodeVersion}; install Node ${REQUIRED_NODE_MAJOR} or newer`),
  );

  checks.push(
    existsSync(resolve(root, 'node_modules'))
      ? pass('Dependencies', 'node_modules is present')
      : fail('Dependencies', 'missing; run npm install at the repository root'),
  );

  const requireFromRoot = createRequire(resolve(root, 'package.json'));
  try {
    requireFromRoot.resolve('electron/package.json');
    checks.push(pass('Electron', 'package resolves'));
  } catch {
    checks.push(fail('Electron', 'package does not resolve; rerun npm install'));
  }

  try {
    const BetterSqlite3 = requireFromRoot('better-sqlite3');
    const database = new BetterSqlite3(':memory:');
    database.prepare('SELECT 1').get();
    database.close();
    checks.push(pass('SQLite native module', 'loads for the current Node ABI'));
  } catch (error) {
    checks.push(
      fail(
        'SQLite native module',
        `could not load; run npm rebuild better-sqlite3 (${error.message})`,
      ),
    );
  }

  const machine = `${platform}/${arch}`;
  checks.push(
    platform === 'darwin' && arch === 'arm64'
      ? pass('Hardware', `${machine}; Apple Silicon supports the MLX fast path`)
      : warn('Hardware', `${machine}; MLX acceleration requires Apple Silicon`),
  );

  checks.push(await checkLocalInference(environment));
  return checks;
}

/**
 * @param {DoctorOptions} [options]
 * @returns {Promise<number>}
 */
export async function runDoctor(options) {
  const checks = await collectDoctorChecks(options);
  console.log('Jarvis doctor');
  for (const check of checks) {
    console.log(`[${check.status}] ${check.name}: ${check.detail}`);
  }
  const failures = checks.filter((check) => check.status === 'FAIL').length;
  console.log(
    failures === 0
      ? 'Doctor completed without blocking failures.'
      : `Doctor found ${failures} blocking failure(s).`,
  );
  return failures === 0 ? 0 : 1;
}

const isMain =
  process.argv[1] !== undefined && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  process.exitCode = await runDoctor();
}
