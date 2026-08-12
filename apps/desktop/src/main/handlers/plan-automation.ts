import type { AutomationPlan } from '@jarvis/contracts';
import { jarvisPlanAutomationContract } from '@jarvis/contracts';
import type { JarvisModelProvider } from '@jarvis/jarvis-core';
import type { JarvisFacingAegis } from '@jarvis/aegis';
import { handleContract } from '../ipc.js';
import { toSafeModelError } from './model-error.js';
import { assertSendingAllowed } from './sending-guard.js';

/**
 * `jarvis:plan-automation` — an outcome in, a written plan out (ADR 0024).
 *
 * Wired exactly like `jarvis:chat` and `jarvis:amplify`, and that is the point:
 * it is the SAME authority, not a new kind. One model call. No screen capture,
 * no computer control, no filesystem, no shell, no credential.
 *
 * Those absences are not an oversight to be filled in later without discussion.
 * Screen Vision and computer control are precisely what AEGIS YELLOW exists to
 * revoke (`SECURITY-BOUNDARIES.md`), and `services/aegis` is empty by choice —
 * building the capability before its restraint is the wrong order, and the
 * decision is recorded in ADR 0024 rather than left implicit here.
 *
 * The provider is READ per call rather than captured, so the brain picker
 * (ADR 0022) applies to planning too — switching to Claude mid-session changes
 * who writes the next plan.
 */
export function registerPlanAutomationHandler(
  getProvider: () => JarvisModelProvider,
  aegis: JarvisFacingAegis,
): void {
  handleContract(jarvisPlanAutomationContract, async (request): Promise<AutomationPlan> => {
    try {
      const provider = getProvider();
      // BEFORE the call, never after: a refusal that arrives once the words have
      // already reached a vendor is not a refusal (ADR 0026).
      assertSendingAllowed(aegis, provider.id);
      return await provider.planAutomation(request.outcome);
    } catch (cause) {
      throw toSafeModelError(cause);
    }
  });
}
