#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { lookup as dnsLookup } from 'node:dns/promises';
import {
  appendFileSync,
  chmodSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { isIP } from 'node:net';
import { pathToFileURL } from 'node:url';

const SAFE_ID = /^[a-z0-9][a-z0-9._:-]{1,127}$/;
const SAFE_TOPIC = /^[a-z0-9][a-z0-9._:-]{1,159}$/;
const SUPPORTED_MONITOR_HOSTS = new Set(['api.github.com']);
const ALLOWED_CONFIG_KEYS = new Set([
  'schemaVersion',
  'enabled',
  'ownerProfileId',
  'monitorIntervalSeconds',
  'reviewHour',
  'reviewMinute',
  'lookbackDays',
  'requestTimeoutMs',
  'maxResponseBytes',
  'maxSources',
  'allowedHosts',
  'sources',
]);
const ALLOWED_SOURCE_KEYS = new Set([
  'id',
  'companyId',
  'topic',
  'kind',
  'authority',
  'enabled',
  'url',
]);
const SOURCE_KINDS = ['github-release'];
const SOURCE_AUTHORITIES = ['primary'];
const EVENT_TYPES = ['baselined', 'changed', 'unchanged', 'failed'];
const FAILURE_CATEGORIES = [
  'timeout',
  'unsafe-resolution',
  'redirect-rejected',
  'response-limit',
  'http-error',
  'invalid-response',
  'network-or-validation-error',
];
const ALLOWED_EVENT_KEYS = new Set([
  'schemaVersion',
  'id',
  'observedAt',
  'profileId',
  'companyId',
  'sourceId',
  'topic',
  'eventType',
  'failureCategory',
  'consecutiveFailures',
  'evidence',
]);
const ALLOWED_EVIDENCE_KEYS = new Set([
  'sourceUrl',
  'authority',
  'fingerprint',
  'previousFingerprint',
  'version',
  'canonicalUrl',
  'publishedAt',
]);

function requireObject(value, name) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
  return value;
}

function rejectUnknownKeys(value, allowed, name) {
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    throw new Error(`${name} contains unsupported fields: ${unknown.join(', ')}`);
  }
}

function requireString(value, name, maximum = 512) {
  if (typeof value !== 'string') throw new Error(`${name} must be a string`);
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maximum) {
    throw new Error(`${name} must contain 1-${maximum} characters`);
  }
  return trimmed;
}

function requireInteger(value, name, minimum, maximum) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}`);
  }
  return value;
}

function requireBoolean(value, name) {
  if (typeof value !== 'boolean') throw new Error(`${name} must be a boolean`);
  return value;
}

function requireTimestamp(value, name) {
  const timestamp = requireString(value, name, 64);
  if (!Number.isFinite(Date.parse(timestamp))) {
    throw new Error(`${name} must be a timestamp`);
  }
  return new Date(timestamp).toISOString();
}

function validateId(value, name) {
  const id = requireString(value, name, 128);
  if (!SAFE_ID.test(id)) throw new Error(`${name} must be normalized`);
  return id;
}

function validateTopic(value) {
  const topic = requireString(value, 'topic', 160);
  if (!SAFE_TOPIC.test(topic)) throw new Error('topic must be normalized');
  return topic;
}

function validateAllowedHost(value) {
  const host = requireString(value, 'allowed host', 253).toLowerCase();
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    isIP(host) !== 0 ||
    !/^[a-z0-9.-]+$/.test(host)
  ) {
    throw new Error(`unsafe allowed host: ${host}`);
  }
  if (!SUPPORTED_MONITOR_HOSTS.has(host)) {
    throw new Error(`monitor host is not supported by this release: ${host}`);
  }
  return host;
}

function validateSourceUrl(value, allowedHosts) {
  const raw = requireString(value, 'source url', 1024);
  const url = new URL(raw);
  if (url.protocol !== 'https:') throw new Error('source url must use HTTPS');
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('source url cannot contain credentials, query parameters, or fragments');
  }
  const hostname = url.hostname.toLowerCase();
  if (!allowedHosts.has(hostname)) throw new Error(`source host is not allowed: ${hostname}`);
  if (isIP(hostname) !== 0 || hostname === 'localhost' || hostname.endsWith('.local')) {
    throw new Error('source url cannot use a local host or literal IP');
  }
  return url.toString();
}

function validateEvidenceUrl(value, name) {
  const raw = requireString(value, name, 1024);
  const url = new URL(raw);
  const hostname = url.hostname.toLowerCase();
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    isIP(hostname) !== 0
  ) {
    throw new Error(`${name} is unsafe`);
  }
  return url.toString();
}

function validateFingerprint(value, name) {
  const fingerprint = requireString(value, name, 64);
  if (!/^[0-9a-f]{64}$/.test(fingerprint)) {
    throw new Error(`${name} must be a SHA-256 fingerprint`);
  }
  return fingerprint;
}

export function validateResearchConfig(value) {
  const raw = requireObject(value, 'research config');
  rejectUnknownKeys(raw, ALLOWED_CONFIG_KEYS, 'research config');
  if (raw.schemaVersion !== 1) throw new Error('schemaVersion must be 1');

  if (!Array.isArray(raw.allowedHosts) || raw.allowedHosts.length === 0) {
    throw new Error('allowedHosts must contain at least one host');
  }
  const allowedHosts = [...new Set(raw.allowedHosts.map(validateAllowedHost))].sort();
  const allowedHostSet = new Set(allowedHosts);
  const maxSources = requireInteger(raw.maxSources, 'maxSources', 1, 50);
  if (!Array.isArray(raw.sources) || raw.sources.length > maxSources) {
    throw new Error(`sources must be an array with at most ${maxSources} entries`);
  }

  const seen = new Set();
  const sources = raw.sources.map((value, index) => {
    const source = requireObject(value, `source ${index + 1}`);
    rejectUnknownKeys(source, ALLOWED_SOURCE_KEYS, `source ${index + 1}`);
    const id = validateId(source.id, 'source id');
    if (seen.has(id)) throw new Error(`duplicate source id: ${id}`);
    seen.add(id);
    const kind = requireString(source.kind, 'source kind', 64);
    const authority = requireString(source.authority, 'source authority', 64);
    if (!SOURCE_KINDS.includes(kind)) throw new Error(`unsupported source kind: ${kind}`);
    if (!SOURCE_AUTHORITIES.includes(authority)) {
      throw new Error(`unsupported source authority: ${authority}`);
    }
    return Object.freeze({
      id,
      companyId: validateId(source.companyId, 'companyId'),
      topic: validateTopic(source.topic),
      kind,
      authority,
      enabled: requireBoolean(source.enabled, 'source enabled'),
      url: validateSourceUrl(source.url, allowedHostSet),
    });
  });

  return Object.freeze({
    schemaVersion: 1,
    enabled: requireBoolean(raw.enabled, 'enabled'),
    ownerProfileId: validateId(raw.ownerProfileId, 'ownerProfileId'),
    monitorIntervalSeconds: requireInteger(
      raw.monitorIntervalSeconds,
      'monitorIntervalSeconds',
      900,
      86_400,
    ),
    reviewHour: requireInteger(raw.reviewHour, 'reviewHour', 0, 23),
    reviewMinute: requireInteger(raw.reviewMinute, 'reviewMinute', 0, 59),
    lookbackDays: requireInteger(raw.lookbackDays, 'lookbackDays', 1, 30),
    requestTimeoutMs: requireInteger(raw.requestTimeoutMs, 'requestTimeoutMs', 1000, 30_000),
    maxResponseBytes: requireInteger(raw.maxResponseBytes, 'maxResponseBytes', 1024, 1_048_576),
    maxSources,
    allowedHosts,
    sources,
  });
}

function isPrivateOrReservedIpv4(address) {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateOrReservedAddress(address, family) {
  if (family === 4) return isPrivateOrReservedIpv4(address);
  const normalized = address.toLowerCase();
  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    /^fe[89ab]/.test(normalized) ||
    normalized.startsWith('::ffff:127.') ||
    normalized.startsWith('::ffff:10.') ||
    normalized.startsWith('::ffff:192.168.')
  );
}

export async function assertPublicResolution(hostname, lookupImpl = dnsLookup) {
  const addresses = await lookupImpl(hostname, { all: true, verbatim: true });
  if (!Array.isArray(addresses) || addresses.length === 0) {
    throw new Error('source host did not resolve');
  }
  for (const entry of addresses) {
    if (
      !entry ||
      (entry.family !== 4 && entry.family !== 6) ||
      isPrivateOrReservedAddress(entry.address, entry.family)
    ) {
      throw new Error('source host resolved to a private or reserved address');
    }
  }
  return addresses;
}

function ensurePrivateDirectory(path) {
  mkdirSync(path, { recursive: true, mode: 0o700 });
  chmodSync(path, 0o700);
}

function atomicWriteJson(path, value) {
  ensurePrivateDirectory(dirname(path));
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  chmodSync(temporary, 0o600);
  renameSync(temporary, path);
}

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (cause) {
    if (cause && typeof cause === 'object' && cause.code === 'ENOENT') return fallback;
    throw cause;
  }
}

function eventId(sourceId, eventType, fingerprint, observedAt) {
  return `research-${createHash('sha256')
    .update(`${sourceId}\0${eventType}\0${fingerprint ?? 'none'}\0${observedAt}`)
    .digest('hex')
    .slice(0, 20)}`;
}

function safeGithubRelease(raw, source) {
  const value = requireObject(raw, 'GitHub release response');
  const version = requireString(value.tag_name, 'release tag', 128);
  const canonicalUrl = validateSourceUrl(
    requireString(value.html_url, 'release url', 1024),
    new Set(['github.com']),
  );
  const publishedAt = requireTimestamp(value.published_at, 'published_at');
  const apiPath = new URL(source.url).pathname.match(
    /^\/repos\/([^/]+)\/([^/]+)\/releases\/latest$/,
  );
  if (!apiPath) throw new Error('GitHub release source path is invalid');
  const expectedPrefix = `/${apiPath[1]}/${apiPath[2]}/releases/tag/`.toLowerCase();
  if (!new URL(canonicalUrl).pathname.toLowerCase().startsWith(expectedPrefix)) {
    throw new Error('release url does not match its enrolled repository');
  }
  return { version, canonicalUrl, publishedAt };
}

function classifyFailure(cause) {
  const message = cause instanceof Error ? cause.message : String(cause);
  if (/abort|timeout/i.test(message)) return 'timeout';
  if (/private or reserved|resolve/i.test(message)) return 'unsafe-resolution';
  if (/redirect/i.test(message)) return 'redirect-rejected';
  if (/response.*large|byte limit|content-length/i.test(message)) return 'response-limit';
  if (/HTTP [0-9]{3}/i.test(message)) return 'http-error';
  if (/JSON|release|response/i.test(message)) return 'invalid-response';
  return 'network-or-validation-error';
}

export async function inspectSource(source, config, previous = null, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const lookupImpl = options.lookupImpl ?? dnsLookup;
  const now = options.now instanceof Date ? options.now : new Date(options.now ?? Date.now());
  if (!Number.isFinite(now.getTime())) throw new Error('now must be a valid date');
  await assertPublicResolution(new URL(source.url).hostname, lookupImpl);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);
  const headers = {
    accept: 'application/vnd.github+json',
    'user-agent': 'Vanguard-Jarvis-Research-Prime/1.0',
    'x-github-api-version': '2022-11-28',
  };
  if (previous?.etag) headers['if-none-match'] = previous.etag;
  if (previous?.lastModified) headers['if-modified-since'] = previous.lastModified;

  try {
    const response = await fetchImpl(source.url, {
      method: 'GET',
      headers,
      redirect: 'manual',
      signal: controller.signal,
    });
    if (response.status === 304 && previous?.fingerprint) {
      return {
        eventType: 'unchanged',
        state: {
          ...previous,
          lastCheckedAt: now.toISOString(),
          consecutiveFailures: 0,
          lastFailureCategory: null,
        },
      };
    }
    if (response.status >= 300 && response.status < 400) {
      throw new Error('source redirect was rejected');
    }
    if (!response.ok) throw new Error(`source returned HTTP ${response.status}`);
    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > config.maxResponseBytes) {
      throw new Error('source response exceeds its byte limit');
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > config.maxResponseBytes) {
      throw new Error('source response exceeds its byte limit');
    }
    const fingerprint = createHash('sha256').update(bytes).digest('hex');
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const release = safeGithubRelease(JSON.parse(decoded), source);
    const eventType = previous?.fingerprint
      ? previous.fingerprint === fingerprint
        ? 'unchanged'
        : 'changed'
      : 'baselined';
    return {
      eventType,
      state: {
        schemaVersion: 1,
        sourceId: source.id,
        companyId: source.companyId,
        topic: source.topic,
        sourceUrl: source.url,
        authority: source.authority,
        fingerprint,
        version: release.version,
        canonicalUrl: release.canonicalUrl,
        publishedAt: release.publishedAt,
        etag: response.headers.get('etag') ?? null,
        lastModified: response.headers.get('last-modified') ?? null,
        firstObservedAt: previous?.firstObservedAt ?? now.toISOString(),
        lastChangedAt:
          eventType === 'changed' || eventType === 'baselined'
            ? now.toISOString()
            : (previous?.lastChangedAt ?? now.toISOString()),
        lastCheckedAt: now.toISOString(),
        consecutiveFailures: 0,
        lastFailureCategory: null,
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

function appendEvent(path, event) {
  ensurePrivateDirectory(dirname(path));
  appendFileSync(path, `${JSON.stringify(event)}\n`, { encoding: 'utf8', mode: 0o600 });
  chmodSync(path, 0o600);
}

function createEvent(source, result, previous, observedAt, profileId) {
  const fingerprint = result.state.fingerprint ?? previous?.fingerprint ?? null;
  return {
    schemaVersion: 1,
    id: eventId(source.id, result.eventType, fingerprint, observedAt),
    observedAt,
    profileId,
    companyId: source.companyId,
    sourceId: source.id,
    topic: source.topic,
    eventType: result.eventType,
    evidence: {
      sourceUrl: source.url,
      authority: source.authority,
      fingerprint,
      ...(result.state.version ? { version: result.state.version } : {}),
      ...(result.state.canonicalUrl ? { canonicalUrl: result.state.canonicalUrl } : {}),
      ...(result.state.publishedAt ? { publishedAt: result.state.publishedAt } : {}),
      ...(previous?.fingerprint && result.eventType === 'changed'
        ? { previousFingerprint: previous.fingerprint }
        : {}),
    },
  };
}

export async function monitorResearchSources(configValue, options = {}) {
  const config = validateResearchConfig(configValue);
  const now = options.now instanceof Date ? options.now : new Date(options.now ?? Date.now());
  if (!Number.isFinite(now.getTime())) throw new Error('now must be a valid date');
  const stateRoot = resolve(options.stateRoot ?? join(homedir(), '.jarvis', 'research-prime'));
  const eventPath = join(stateRoot, 'observations.jsonl');
  const summary = { checked: 0, baselined: 0, changed: 0, unchanged: 0, failed: 0 };

  if (!config.enabled) return { ...summary, disabled: true };
  for (const source of config.sources.filter((item) => item.enabled)) {
    const statePath = join(stateRoot, 'sources', `${source.id}.json`);
    const previous = readJson(statePath, null);
    summary.checked += 1;
    try {
      const result = await inspectSource(source, config, previous, { ...options, now });
      atomicWriteJson(statePath, result.state);
      summary[result.eventType] += 1;
      if (result.eventType !== 'unchanged') {
        appendEvent(
          eventPath,
          createEvent(source, result, previous, now.toISOString(), config.ownerProfileId),
        );
      }
    } catch (cause) {
      const category = classifyFailure(cause);
      const failedState = {
        ...(previous ?? {
          schemaVersion: 1,
          sourceId: source.id,
          companyId: source.companyId,
          topic: source.topic,
          sourceUrl: source.url,
          authority: source.authority,
          fingerprint: null,
          firstObservedAt: now.toISOString(),
          lastChangedAt: null,
        }),
        lastCheckedAt: now.toISOString(),
        consecutiveFailures: (previous?.consecutiveFailures ?? 0) + 1,
        lastFailureCategory: category,
      };
      atomicWriteJson(statePath, failedState);
      summary.failed += 1;
      appendEvent(eventPath, {
        schemaVersion: 1,
        id: eventId(source.id, 'failed', category, now.toISOString()),
        observedAt: now.toISOString(),
        profileId: config.ownerProfileId,
        companyId: source.companyId,
        sourceId: source.id,
        topic: source.topic,
        eventType: 'failed',
        failureCategory: category,
        consecutiveFailures: failedState.consecutiveFailures,
        evidence: { sourceUrl: source.url, authority: source.authority },
      });
    }
  }
  atomicWriteJson(join(stateRoot, 'last-monitor.json'), {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    ...summary,
    autoPromote: false,
  });
  return summary;
}

export function parseResearchEvents(source) {
  const events = [];
  for (const [index, line] of source.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    try {
      const event = requireObject(JSON.parse(line), 'research event');
      rejectUnknownKeys(event, ALLOWED_EVENT_KEYS, 'research event');
      if (event.schemaVersion !== 1) throw new Error('schemaVersion must be 1');
      if (!EVENT_TYPES.includes(event.eventType)) throw new Error('eventType is invalid');
      const evidence = requireObject(event.evidence, 'evidence');
      rejectUnknownKeys(evidence, ALLOWED_EVIDENCE_KEYS, 'evidence');
      const fingerprint =
        evidence.fingerprint === null || evidence.fingerprint === undefined
          ? null
          : validateFingerprint(evidence.fingerprint, 'fingerprint');
      const previousFingerprint =
        evidence.previousFingerprint === undefined
          ? undefined
          : validateFingerprint(evidence.previousFingerprint, 'previousFingerprint');
      const failureCategory =
        event.failureCategory === undefined
          ? undefined
          : requireString(event.failureCategory, 'failureCategory', 64);
      if (failureCategory !== undefined && !FAILURE_CATEGORIES.includes(failureCategory)) {
        throw new Error('failureCategory is invalid');
      }
      events.push({
        schemaVersion: 1,
        id: validateId(event.id, 'event id'),
        observedAt: requireTimestamp(event.observedAt, 'observedAt'),
        profileId: validateId(event.profileId, 'profileId'),
        companyId: validateId(event.companyId, 'companyId'),
        sourceId: validateId(event.sourceId, 'sourceId'),
        topic: validateTopic(event.topic),
        eventType: event.eventType,
        ...(failureCategory === undefined ? {} : { failureCategory }),
        ...(event.consecutiveFailures === undefined
          ? {}
          : {
              consecutiveFailures: requireInteger(
                event.consecutiveFailures,
                'consecutiveFailures',
                1,
                1_000_000,
              ),
            }),
        evidence: {
          sourceUrl: validateEvidenceUrl(evidence.sourceUrl, 'sourceUrl'),
          authority: requireString(evidence.authority, 'authority', 64),
          fingerprint,
          ...(previousFingerprint === undefined ? {} : { previousFingerprint }),
          ...(evidence.version === undefined
            ? {}
            : { version: requireString(evidence.version, 'version', 128) }),
          ...(evidence.canonicalUrl === undefined
            ? {}
            : { canonicalUrl: validateEvidenceUrl(evidence.canonicalUrl, 'canonicalUrl') }),
          ...(evidence.publishedAt === undefined
            ? {}
            : { publishedAt: requireTimestamp(evidence.publishedAt, 'publishedAt') }),
        },
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      throw new Error(`invalid research event on line ${index + 1}: ${message}`);
    }
  }
  return events;
}

function proposalId(event, date) {
  return `knowledge-${createHash('sha256')
    .update(`${event.companyId}\0${event.topic}\0${event.sourceId}\0${date}`)
    .digest('hex')
    .slice(0, 20)}`;
}

export function buildDailyResearchReview(events, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now ?? Date.now());
  if (!Number.isFinite(now.getTime())) throw new Error('now must be a valid date');
  const lookbackDays = requireInteger(options.lookbackDays ?? 7, 'lookbackDays', 1, 30);
  const profileId = validateId(options.profileId ?? 'william', 'profileId');
  const start = new Date(now.getTime() - lookbackDays * 86_400_000);
  const eligible = events
    .filter((event) => event.profileId === profileId)
    .filter((event) => {
      const timestamp = Date.parse(event.observedAt);
      return timestamp >= start.getTime() && timestamp <= now.getTime();
    });
  const latestChanges = new Map();
  for (const event of eligible.filter((item) => item.eventType === 'changed')) {
    const key = `${event.companyId}\0${event.topic}\0${event.sourceId}`;
    const previous = latestChanges.get(key);
    if (!previous || Date.parse(event.observedAt) > Date.parse(previous.observedAt)) {
      latestChanges.set(key, event);
    }
  }
  const date = now.toISOString().slice(0, 10);
  const proposals = [...latestChanges.values()]
    .sort((left, right) =>
      `${left.companyId}:${left.topic}:${left.sourceId}`.localeCompare(
        `${right.companyId}:${right.topic}:${right.sourceId}`,
      ),
    )
    .map((event) => ({
      schemaVersion: 1,
      id: proposalId(event, date),
      companyId: event.companyId,
      topic: event.topic,
      sourceId: event.sourceId,
      status: 'proposed',
      autonomy: 'A1',
      question: `Review the verified ${event.topic} source change for a safe Jarvis or business improvement.`,
      evidence: [event.evidence],
      requiredGates: [
        'source-comparison',
        'prompt-injection-review',
        'independent-review',
        'owner-approval',
        'sandbox-test-if-executable',
        'rollback-proof-if-promoted',
      ],
      acceptanceCriteria: [
        'new claim is supported by authoritative evidence',
        'contradictory and negative evidence is recorded',
        'company and profile boundaries remain intact',
        'outcome metric and freshness rule are defined',
      ],
      autoPromote: false,
      knowledgeWrites: [],
    }));
  const failures = eligible
    .filter((event) => event.eventType === 'failed')
    .map((event) => ({
      companyId: event.companyId,
      sourceId: event.sourceId,
      category: event.failureCategory ?? 'unknown',
      observedAt: event.observedAt,
      consecutiveFailures: event.consecutiveFailures ?? 1,
    }));
  return {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    profileId,
    window: { start: start.toISOString(), end: now.toISOString(), lookbackDays },
    eventCount: eligible.length,
    proposals,
    sourceFailures: failures,
    promoted: [],
    canonicalKnowledgeWrites: [],
    invariant:
      'Research Prime monitors approved public evidence and drafts candidates only; it never promotes knowledge, changes code or policy, sends messages, spends money, or changes AEGIS.',
  };
}

export function runDailyResearchReview(configValue, options = {}) {
  const config = validateResearchConfig(configValue);
  const stateRoot = resolve(options.stateRoot ?? join(homedir(), '.jarvis', 'research-prime'));
  let events = [];
  try {
    events = parseResearchEvents(readFileSync(join(stateRoot, 'observations.jsonl'), 'utf8'));
  } catch (cause) {
    if (!(cause && typeof cause === 'object' && cause.code === 'ENOENT')) throw cause;
  }
  const report = buildDailyResearchReview(events, {
    ...options,
    lookbackDays: config.lookbackDays,
    profileId: config.ownerProfileId,
  });
  const date = report.generatedAt.slice(0, 10);
  atomicWriteJson(join(stateRoot, 'reports', `${date}.json`), report);
  atomicWriteJson(join(stateRoot, 'last-daily-review.json'), report);
  return report;
}

export function initializeResearchConfig(defaultsPath, configPath) {
  const defaults = validateResearchConfig(readJson(defaultsPath, null));
  const existingRaw = readJson(configPath, null);
  if (existingRaw === null) {
    atomicWriteJson(configPath, defaults);
    return { created: true, addedSourceIds: defaults.sources.map((source) => source.id) };
  }
  const existing = validateResearchConfig(existingRaw);
  const known = new Set(existing.sources.map((source) => source.id));
  const additions = defaults.sources.filter((source) => !known.has(source.id));
  const merged = validateResearchConfig({
    ...existing,
    allowedHosts: [...new Set([...existing.allowedHosts, ...defaults.allowedHosts])],
    sources: [...existing.sources, ...additions],
  });
  atomicWriteJson(configPath, merged);
  return { created: false, addedSourceIds: additions.map((source) => source.id) };
}

function parseArguments(argv) {
  const options = { mode: 'monitor' };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--mode') options.mode = argv[++index];
    else if (argument === '--config') options.configPath = argv[++index];
    else if (argument === '--defaults') options.defaultsPath = argv[++index];
    else if (argument === '--state-root') options.stateRoot = argv[++index];
    else if (argument === '--now') options.now = new Date(argv[++index]);
    else throw new Error(`unknown argument: ${argument}`);
  }
  return options;
}

async function main(argv) {
  const options = parseArguments(argv);
  const stateRoot = resolve(options.stateRoot ?? join(homedir(), '.jarvis', 'research-prime'));
  const configPath = resolve(options.configPath ?? join(stateRoot, 'config.json'));
  if (options.mode === 'init') {
    if (!options.defaultsPath) throw new Error('--defaults is required for init mode');
    const result = initializeResearchConfig(resolve(options.defaultsPath), configPath);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  const config = validateResearchConfig(readJson(configPath, null));
  if (options.mode === 'monitor') {
    const result = await monitorResearchSources(config, { ...options, stateRoot });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  if (options.mode === 'review') {
    const report = runDailyResearchReview(config, { ...options, stateRoot });
    process.stdout.write(
      `${JSON.stringify({ eventCount: report.eventCount, proposalCount: report.proposals.length, report: join(stateRoot, 'last-daily-review.json') })}\n`,
    );
    return;
  }
  throw new Error(`unsupported mode: ${options.mode}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    await main(process.argv.slice(2));
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    process.stderr.write(`ERROR: ${message}\n`);
    process.exitCode = 1;
  }
}
