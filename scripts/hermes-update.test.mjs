import { describe, expect, it } from 'vitest';

import {
  parseEnv,
  parseReleaseVersion,
  validateCandidate,
  validateManifest,
} from '../jarvis-hermes/scripts/stage-hermes-update.mjs';

const manifest = validateManifest(
  parseEnv(
    [
      'HERMES_RELEASE_VERSION=0.20.0',
      'HERMES_RELEASE_TAG=v2026.8.3',
      'HERMES_RELEASE_TAG_OBJECT=7de39e700d2c329e15d32eb0b96e2f7cdd9fbdb2',
      'HERMES_RELEASE_COMMIT=3c27eb6234bf91b8ceee9e9071591b31e9b148cb',
      'HERMES_RELEASE_REPO=https://github.com/NousResearch/hermes-agent.git',
      'HERMES_RELEASE_GITHUB_REPO=NousResearch/hermes-agent',
    ].join('\n'),
  ),
);

const release = {
  tag_name: 'v2026.8.4',
  name: 'Hermes Agent v0.20.1',
  draft: false,
  prerelease: false,
  published_at: '2026-08-04T00:00:00Z',
  html_url: 'https://github.com/NousResearch/hermes-agent/releases/tag/v2026.8.4',
};
const ref = {
  ref: 'refs/tags/v2026.8.4',
  object: { type: 'tag', sha: 'a'.repeat(40) },
};
const annotatedTag = {
  tag: 'v2026.8.4',
  object: { type: 'commit', sha: 'b'.repeat(40) },
  verification: { verified: true, reason: 'valid' },
};

describe('Hermes release intake policy', () => {
  it('parses the pinned manifest without executing it', () => {
    expect(manifest.HERMES_RELEASE_VERSION).toBe('0.20.0');
    expect(manifest.HERMES_RELEASE_COMMIT).toHaveLength(40);
  });

  it('extracts a semantic version from an official release name', () => {
    expect(parseReleaseVersion(release)).toBe('0.20.1');
  });

  it('accepts a stable signed annotated date tag', () => {
    expect(validateCandidate(manifest, release, ref, annotatedTag)).toMatchObject({
      version: '0.20.1',
      tag: 'v2026.8.4',
      tagObject: 'a'.repeat(40),
      commit: 'b'.repeat(40),
    });
  });

  it.each([
    [
      'unsigned tag',
      release,
      ref,
      { ...annotatedTag, verification: { verified: false, reason: 'unsigned' } },
    ],
    [
      'lightweight tag',
      release,
      { ...ref, object: { type: 'commit', sha: 'a'.repeat(40) } },
      annotatedTag,
    ],
    ['prerelease', { ...release, prerelease: true }, ref, annotatedTag],
    [
      'path-like tag',
      { ...release, tag_name: '../../escape' },
      { ...ref, ref: 'refs/tags/../../escape' },
      { ...annotatedTag, tag: '../../escape' },
    ],
  ])('rejects %s', (_name, badRelease, badRef, badTag) => {
    expect(() => validateCandidate(manifest, badRelease, badRef, badTag)).toThrow();
  });

  it('rejects a noncanonical repository', () => {
    expect(() =>
      validateManifest({
        ...manifest,
        HERMES_RELEASE_REPO: 'https://example.com/hermes.git',
      }),
    ).toThrow(/canonical/);
  });
});
