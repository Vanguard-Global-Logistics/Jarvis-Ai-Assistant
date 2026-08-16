import { buildFamilyProfileMemories, FamilyProfileSeedSchema } from './family-profile.js';
import type { MemoryWriteContext } from './policy.js';
import type { MemoryRememberResult } from './service.js';

export interface FamilyProfileMemoryWriter {
  remember(candidate: unknown, context: MemoryWriteContext): MemoryRememberResult;
}

export interface FamilyProfileImportContext {
  actorProfileId: string;
  memoryWriteAllowed: boolean;
  authorizedTargetProfileIds?: readonly string[];
  sharedWriteApproved?: boolean;
  restrictedWriteApproved?: boolean;
}

export interface FamilyProfileImportResult {
  profileId: string;
  attempted: number;
  stored: number;
  corrected: number;
  unchanged: number;
  denied: number;
  deniedReasons: readonly string[];
}

/**
 * Owner/guardian bootstrap path for Jarvis Pro Family Brain.
 *
 * Cross-profile access is default-deny. The caller must provide an explicit
 * authorizedTargetProfileIds grant for any profile other than the actor. This
 * service does not discover guardianship, infer consent, or grant permissions.
 */
export class FamilyProfileImportService {
  public constructor(private readonly memory: FamilyProfileMemoryWriter) {}

  public importProfile(
    candidate: unknown,
    context: FamilyProfileImportContext,
    options: { now?: string; sourceRef?: string } = {},
  ): FamilyProfileImportResult {
    const seed = FamilyProfileSeedSchema.parse(candidate);
    const crossProfile = seed.profileId !== context.actorProfileId;
    const targetAuthorized =
      !crossProfile || context.authorizedTargetProfileIds?.includes(seed.profileId) === true;

    const records = buildFamilyProfileMemories(seed, options);
    if (!targetAuthorized) {
      return {
        profileId: seed.profileId,
        attempted: records.length,
        stored: 0,
        corrected: 0,
        unchanged: 0,
        denied: records.length,
        deniedReasons: ['target-profile-not-authorized'],
      };
    }

    let stored = 0;
    let corrected = 0;
    let unchanged = 0;
    let denied = 0;
    const deniedReasons = new Set<string>();

    for (const record of records) {
      const result = this.memory.remember(record, {
        actorProfileId: context.actorProfileId,
        memoryWriteAllowed: context.memoryWriteAllowed,
        crossProfileWriteApproved: crossProfile,
        sharedWriteApproved: context.sharedWriteApproved,
        restrictedWriteApproved: context.restrictedWriteApproved,
      });

      if (!result.stored) {
        denied += 1;
        for (const reason of result.decision.reasons) deniedReasons.add(reason);
      } else if (result.unchanged) {
        unchanged += 1;
      } else if (result.supersededId) {
        corrected += 1;
      } else {
        stored += 1;
      }
    }

    return {
      profileId: seed.profileId,
      attempted: records.length,
      stored,
      corrected,
      unchanged,
      denied,
      deniedReasons: [...deniedReasons].sort(),
    };
  }
}
