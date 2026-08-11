import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROFILE,
  PROFILE_ACCENTS,
  ProfileSchema,
  profileAccentColor,
} from './contracts.js';

describe('ProfileSchema', () => {
  it('accepts a family profile', () => {
    const profile = { displayName: 'Jayden', accent: 'jayden' as const };
    expect(ProfileSchema.parse(profile)).toEqual(profile);
  });

  it('rejects an arbitrary colour — the accent is a closed set', () => {
    // A free-form colour could impersonate the alert red, so the boundary only
    // accepts named family accents.
    expect(ProfileSchema.safeParse({ displayName: 'X', accent: '#ff0000' }).success).toBe(false);
    expect(ProfileSchema.safeParse({ displayName: 'X', accent: 'danger' }).success).toBe(false);
  });

  it('rejects an empty or oversized display name, and any extra field', () => {
    expect(ProfileSchema.safeParse({ displayName: '', accent: 'amy' }).success).toBe(false);
    expect(ProfileSchema.safeParse({ displayName: 'x'.repeat(25), accent: 'amy' }).success).toBe(
      false,
    );
    // .strict() — a "profile" must never grow a permissions field by accident.
    expect(
      ProfileSchema.safeParse({ displayName: 'X', accent: 'amy', canSpendMoney: true }).success,
    ).toBe(false);
  });
});

describe('the family accents', () => {
  it("keeps Ashton's identity distinct from the alert red", () => {
    // The design system reserves #ff5a5a for danger. If an identity could wear
    // it, "thinking" and "alarmed" would look identical on that machine.
    expect(PROFILE_ACCENTS.ashton).not.toBe('#ff5a5a');
    expect(profileAccentColor('ashton')).toBe(PROFILE_ACCENTS.ashton);
  });

  it('resolves every accent id to a hex colour', () => {
    for (const id of Object.keys(PROFILE_ACCENTS) as (keyof typeof PROFILE_ACCENTS)[]) {
      expect(profileAccentColor(id)).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe('DEFAULT_PROFILE', () => {
  it('is plain Jarvis — an unconfigured machine claims no owner', () => {
    expect(ProfileSchema.parse(DEFAULT_PROFILE)).toEqual(DEFAULT_PROFILE);
    expect(DEFAULT_PROFILE.displayName).toBe('Jarvis');
    expect(DEFAULT_PROFILE.accent).toBe('jarvis');
  });
});
