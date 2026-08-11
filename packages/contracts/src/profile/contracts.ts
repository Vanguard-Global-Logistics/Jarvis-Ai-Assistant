import { z } from 'zod';

/**
 * Profile — who this installation belongs to, and how their orb looks
 * (ADR 0013).
 *
 * The governing decision: **one Jarvis, many skins.** The assistant is always
 * Jarvis — same name, same personality, answers to "Jarvis" for everyone. What
 * is personal is the *presentation*: the name on the orb and its accent colour.
 * A profile therefore carries appearance and identity, and grants **no
 * capability whatsoever**. It is not an account, not a login, and not a
 * permission boundary; separation of data comes from each person having their
 * own OS user account (ADR 0012), not from this field.
 */

/**
 * The family accents, as a closed set drawn from the approved orb artwork
 * (`docs/design/ORB-FAMILY.md`).
 *
 * `ashton` is deliberately a **crimson, not the alert red**. The design system
 * reserves pure red (`accent.danger`) for critical state, and an identity that
 * used it would make "Jarvis is thinking" and "Jarvis is alarmed" the same
 * colour on Ashton's machine. Identity must never be able to impersonate a
 * warning.
 */
export const PROFILE_ACCENTS = {
  jarvis: '#5ad1ff',
  amy: '#2ee6c8',
  jayden: '#ffc61a',
  ashton: '#e0523c',
} as const;

export const ProfileAccentSchema = z.enum(
  Object.keys(PROFILE_ACCENTS) as [ProfileAccentId, ...ProfileAccentId[]],
);

export type ProfileAccentId = keyof typeof PROFILE_ACCENTS;

/** Resolve an accent id to its hex value. Total over the closed set. */
export function profileAccentColor(id: ProfileAccentId): string {
  return PROFILE_ACCENTS[id];
}

export const ProfileSchema = z
  .object({
    /**
     * The name shown on the orb — "JAYDEN", "AMY". This is a label, not an
     * identity claim: it changes nothing about what the software may do.
     */
    displayName: z.string().min(1).max(24),
    accent: ProfileAccentSchema,
  })
  .strict();

export type Profile = z.infer<typeof ProfileSchema>;

/**
 * The profile a fresh installation starts with. Deliberately plain "Jarvis" in
 * Jarvis blue: an unconfigured machine must not claim to belong to a particular
 * person.
 */
export const DEFAULT_PROFILE: Profile = {
  displayName: 'Jarvis',
  accent: 'jarvis',
};
