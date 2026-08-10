# Public product SEO release gate

Report each item as PASS, NEEDS-FIX, BLOCKED, or NOT-APPLICABLE and attach reproducible evidence.

## Crawl and index

- Production hostname, HTTPS, redirects, status codes, robots policy, and index directives are intentional.
- Canonical URLs resolve to the correct public pages.
- XML sitemap contains only canonical, indexable production URLs and is discoverable.
- Preview, admin, account, private tenant, duplicate, filter, and sensitive pages are not exposed for indexing.

## Page truth and discovery

- Every indexable page has one clear purpose, unique title, useful description, logical headings, and useful internal links.
- Public business, product, service, location, author, price, availability, and contact facts are accurate and sourced.
- Structured data matches visible content and passes the applicable validator.
- Images have appropriate formats, dimensions, loading behavior, filenames, and meaningful alternatives where needed.
- Social preview metadata and icons use approved brand assets.

## Experience and reliability

- Mobile layout, keyboard path, accessible names, contrast, broken links, error pages, and JavaScript rendering are checked.
- Core Web Vitals and page weight have an observed baseline; lab data is not mislabeled as field performance.
- Analytics, consent, Search Console ownership, error monitoring, and conversion events have an owner and privacy boundary.

## Local and multi-tenant

- Location and service-area pages exist only for real, approved operations and contain materially useful local information.
- Name, address/service area, phone, hours, categories, services, and map/profile links are consistent.
- Tenant-private data, another customer's analytics, and another customer's content never appear in output or markup.

## Release evidence

Record domain, build/commit, environment, test time, tester, failures, approved exceptions, approver,
rollback, baseline metrics, and the date of the first post-release review. A passing checklist does not
prove ranking improvement; measure qualified search outcomes after release.
