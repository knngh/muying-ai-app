# Knowledge Content Optimization Plan

## Goals

- Reduce authority-article translation wait time from "open detail and block" to "mostly cache-hit or background-ready".
- Increase Chinese authority article coverage, especially for official CN sources.
- Keep emergency high-risk content gated while allowing common maternal/infant guidance into the knowledge cache.

## Current Bottlenecks

### Translation

- Detail pages currently depend on `/articles/:slug/translation` to prepare Chinese reading support.
- Full-body translation can be triggered too late, after the user has already entered the detail page.
- Translation cache exists, but misses still create user-visible latency.

### Chinese source coverage

- Existing authority snapshot is still dominated by English sources.
- Official CN sources such as `mayo-clinic-zh`, `msd-manuals-cn`, `nhc-*`, and `chinacdc-*` underperform relative to configured source coverage.
- Previous publication rules were too strict for short official notices and yellow-risk symptom articles.

## Phase 1: Immediate Wins

### Translation

- Return translation status as `ready` or `processing` instead of blocking the request on a full translation run.
- Start translation in the background on first request and when authority list pages are loaded.
- Keep explicit user-triggered translation as a polling workflow instead of a single long synchronous request.
- Prewarm translations for the first visible English authority articles on list/detail entry.

### Chinese coverage

- Publish yellow-risk common guidance by default.
- Keep only red-risk content in manual review.
- Lower official-source minimum content length to allow concise CN notices and vaccination bulletins.
- Export previously reviewed non-red records into the authority snapshot.
- Default authority sorting to latest-first and Chinese-first on the same day.

## Phase 2: Source Expansion

### Priority sources

1. `mayo-clinic-zh`
2. `msd-manuals-cn`
3. `nhc-fys`
4. `nhc-rkjt`
5. `chinacdc-immunization`
6. `chinacdc-nutrition`

### Work items

- Expand entry URLs for maternal/infant sections.
- Broaden pagination and index discovery coverage.
- Add source-specific fixtures for real page structures.
- Relax over-strict article matching rules where official CN pages are being skipped.
- Improve正文抽取 for short notices, mixed-layout pages, and PDF-linked content pages.

## Phase 3: Stabilization

- Persist translation cache beyond ad-hoc JSON usage when traffic grows.
- Add daily reporting for:
  - authority snapshot total
  - Chinese article ratio
  - per-source published count
  - translation cache hit rate
  - translation processing duration
- Add regression fixtures for:
  - short CN official notices
  - vaccination guidance
  - symptom content
  - noisy government pages with heavy chrome

## Acceptance Criteria

- First detail-page visit for a new English authority article no longer blocks on a long translation request.
- Reopening the same article should usually hit translation cache.
- Official CN sources should contribute materially beyond `gov.cn` policy interpretation pages.
- Authority list pages should show recent Chinese articles before same-day English items.
