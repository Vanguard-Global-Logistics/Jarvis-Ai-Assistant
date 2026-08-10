# ADR 0019 — Relentless SEO product standard

- Status: accepted
- Date: 2026-08-09
- Owner: William Lavold

## Context

William wants every public-facing program built by Jarvis—including every sold Peptastic
tenant—to launch with an enduring search-growth capability instead of treating SEO as an
afterthought.

Hermes Agent 0.20.0 does not include an official SEO Agent in its release notes or bundled
source. Hermes does include an Agent Skills-compatible skills system, progressive disclosure,
skill bundles, scheduled blueprints, and approval gates. That is the verified integration seam.

The MIT-licensed community project `AgriciDaniel/claude-seo` was evaluated as a source of
ideas, not adopted as a dependency. It is Claude-specific, carries a large script and dependency
surface, includes optional credentialed services, and injects third-party promotional copy into
major outputs. No community code or branding is copied into Jarvis.

## Decision

Create a Jarvis-owned Hermes skill named **Relentless SEO** and make its release gate a standing
requirement for every public-facing Vanguard-built program.

“Relentless” means continuously measured, evidence-led improvement. It never means spam,
deception, fake reviews, guaranteed rankings, doorway pages, keyword stuffing, fabricated local
presence, or unapproved medical or regulatory claims.

The shared capability provides:

1. a pre-release technical SEO gate;
2. source-grounded site and page audit procedures;
3. local business truth and Google Business Profile consistency checks;
4. city/state opportunity and competitor-gap research;
5. helpful-content briefs based on real expertise and customer needs;
6. structured-data proposals that match visible page content;
7. Search Console, Business Profile, analytics, and conversion measurement when separately
   authorized;
8. drift monitoring, correction history, and owner-visible run evidence.

Every business and every Peptastic customer receives a separate profile, vault, credentials,
metrics, history, and approval policy. Cross-tenant keyword, patient, customer, review, analytics,
or competitive data is forbidden unless it is public evidence and the sharing policy explicitly
allows it.

## Autonomy

- A0: inspect public pages and approved read-only metrics.
- A1 default: prepare audits, content briefs, schema, code patches, and local-growth proposals.
- A2: publish a page, edit a Business Profile, respond to a review, submit a sitemap, or send
  outreach only after explicit approval for that action.
- A3/A4: unavailable until AEGIS, Tool Bridge, rollback, tenant isolation, written owner policy,
  and repeated acceptance evidence exist.

No SEO task may silently spend money, create an advertising campaign, buy links, solicit or write
fake reviews, mass-generate location pages, or change production.

## Peptastic product rule

Every Peptastic deployment must include the Relentless SEO contract and tenant-local onboarding
surface. It remains disabled until the customer enrolls the exact business identity, verified
locations or service areas, domains, owners/approvers, regulated-claims approver, target market,
and authorized data connections.

Peptastic may help a clinic or med spa become more discoverable through truthful local information,
technical quality, useful content, reputation-response drafts, and measured iteration. It cannot
promise city or state dominance and cannot publish diagnosis, dosing, treatment, outcome, licensing,
or compliance claims without qualified human approval and authoritative evidence.

## Program release gate

A public program is not SEO-ready until evidence covers crawl/index controls, canonical URLs,
unique titles and descriptions, sitemap, robots policy, correct structured data, mobile rendering,
Core Web Vitals observation, accessibility basics, broken links, social previews, organization or
local identity accuracy, analytics consent, Search Console ownership plan, and an initial measurement
baseline. A failed gate blocks the SEO-ready claim; it does not necessarily block an internal preview.

## Consequences

- The capability is owned by Jarvis and remains portable across model and engine changes.
- Product teams cannot forget SEO because the release contract and project instructions require it.
- A skill package does not itself prove search improvement. Rankings depend on relevance, distance,
  prominence, competition, site quality, and platform decisions outside Jarvis's control.
- Actual publishing, Google integrations, continuous rank monitoring, and Peptastic UI/API work remain
  separate implementations with their own acceptance evidence.

## Primary references

- Hermes Agent v0.20.0 release: <https://github.com/NousResearch/hermes-agent/releases/tag/v2026.8.3>
- Hermes skills system: <https://hermes-agent.nousresearch.com/docs/user-guide/features/skills>
- Google SEO Starter Guide: <https://developers.google.com/search/docs/fundamentals/seo-starter-guide>
- Google AI search optimization guide: <https://developers.google.com/search/docs/fundamentals/ai-optimization-guide>
- Google spam policies: <https://developers.google.com/search/docs/essentials/spam-policies>
- Google local ranking guidance: <https://support.google.com/business/answer/7091>
