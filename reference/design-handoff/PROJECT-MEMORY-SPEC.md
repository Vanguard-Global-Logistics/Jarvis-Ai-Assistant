# PROJECT MEMORY SPEC

The repository — not conversational memory — is the production source of truth.

## Per-project permanent files
- PROJECT-BRAIN.md — purpose, architecture, key context
- CURRENT-STATE.md — model, environment, repo, branch, Vercel project, domain, milestone, last verified result
- LOCKED-DECISIONS.md — decisions that may not silently change
- DESIGN-HANDOFF.md — design → code contract
- DEPLOYMENT-STATUS.md — preview/production truth
- KNOWN-ISSUES.md — defects, mocked features, dev-only behavior
- NEXT-ACTION.md — the exact next smallest safe task
- COST-PLAN.md — budget, monthly cost, break-even
- VERIFICATION.md — evidence: commands run, results, screenshots

## Rules
- Update state files only after checks confirm the recorded state.
- Never write "complete" without verification evidence.
- Claude sessions read these files before planning; conversation history never overrides locked repository rules.
- Forge's five-fact model (claimed / committed / tested / previewed / approved) maps 1:1 onto DEPLOYMENT-STATUS.md.
