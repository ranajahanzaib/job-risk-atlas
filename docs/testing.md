# Verification and testing status

This document records the automated and manual verification suite for the Job Risk Atlas application, pipeline, and API.

## Automated test suite

The test suite is executable via `python3 -m unittest discover -s tests -v` (or `pnpm test`). All 19 tests currently pass:

1. **Pipeline & scientific integrity (`tests/test_pipeline.py`)**:
   - `test_record_counts`: Validates the database contains exactly 128,398 observations across 500 unique 2018 SOC occupations from the official BLS ORS 2023 final wave.
   - `test_raw_estimates_preserved_as_text`: Ensures suppressed and threshold text markers (`<0.5`, `>99.5`, `<15`, `>90`, `-`) are preserved as text and never coerced to 0 or arbitrary numbers.
   - `test_no_null_critical_fields`: Ensures zero nulls across SOC codes, raw estimates, and requirement domains.
   - `test_strength_categories_coverage`: Confirms all 5 official BLS strength categories (Sedentary, Light work, Medium work, Heavy work, Very heavy work) are present.
   - `test_footnotes_table`: Confirms official BLS footnote codes (e.g. 36 for `>99.5 percent`) are stored and mapped.
   - `test_validation_report_file`: Verifies `data/processed/ors-2023-validation.json` status and observation count.

2. **REST API & endpoints (`tests/test_api.py`)**:
   - `test_health`: Checks `/api/v1/health` status, ORS 2023 readiness, and CFOI 2024 unacquired status.
   - `test_coverage`: Validates `/api/v1/coverage` reporting reference years, observation counts, and requirement domains.
   - `test_metadata`: Confirms dataset provenance and SHA-256 checksums.
   - `test_validation`: Verifies the validation report endpoint.
   - `test_occupation_search_by_title`: Tests case-insensitive text search.
   - `test_occupation_search_with_and_without_hyphen`: Ensures both hyphenated (`47-2061`) and raw (`472061`) SOC codes match correctly.
   - `test_occupation_detail_with_and_without_hyphen`: Validates SOC code normalization on occupation profile routes.
   - `test_occupation_requirements`: Tests paginated requirements retrieval and workbook provenance.
   - `test_series_lookup_short_and_padded`: Verifies 5-digit zero-padding on series codes (e.g. `/series/139` normalizes to `00139`).
   - `test_strength_matrix`: Verifies the 5-category occupational strength matrix.
   - `test_cfoi_unavailable_endpoints`: Confirms `/api/v1/events`, `/relationships`, `/trends`, and occupation fatal injury endpoints return HTTP 503 `dataset_unavailable`.
   - `test_do_head_support`: Validates HTTP HEAD requests and `Content-Length` headers.
   - `test_pagination_validation`: Checks HTTP 400 validation for malformed limit/offset parameters.

## Frontend verification

- **TypeScript type checking & production build**: `./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build` passed with zero errors.
- **Bundle code splitting**: Cohesive `three-vendor` (Three.js / React Three Fiber) and `chart-vendor` (Recharts) chunks prevent runtime selector initialization issues.
- **Route and parameter handling**: Hash routing cleanly separates route IDs from query parameters (`#compare?compare=...`), enabling direct URL sharing.

## Status of external datasets

- **ORS 2023**: Fully acquired, inspected, materialized, and verified.
- **CFOI 2024**: Catalogued with official URLs and checksum manifests. Requests to BLS 2024 XLSX tables return HTTP 403 in sandboxed/restricted environments; the UI transparently displays the unavailable state rather than synthetic or fabricated data.
