# API

The local development server exposes:

- `GET /api/v1/health` — process health and ORS/CFOI readiness flags.
- `GET /api/v1/metadata` — explicit acquisition/processing status for the three targeted official workbooks.
- `GET /api/v1/coverage` — record and occupation counts by ORS source domain plus dataset readiness.
- `GET /api/v1/validation` — machine-readable ORS build validation report.
- `GET /api/v1/occupations?q=...&limit=...&offset=...` — parameterized occupation search over acquired ORS SOC 2018 codes and titles; page size is bounded to 100.
- `GET /api/v1/occupations/{six-digit-soc}` — ORS coverage and observation count for the exact classification.
- `GET /api/v1/occupations/{six-digit-soc}/requirements?requirement=Physical%20demands&limit=...&offset=...` — original estimate values, standard-error strings, footnote codes and definitions, and sheet/row provenance; page size is bounded to 200.
- `GET /api/v1/series?requirement=Physical%20demands` — source-defined physical or environmental ORS estimate series, grouped by estimate code and label, with occupation coverage counts.
- `GET /api/v1/series/{five-digit-estimate-code}?q=...&limit=...&offset=...` — original observations for one source estimate series across occupations, with footnotes and row provenance; page size is bounded to 500.
- `GET /api/v1/strength?q=...&limit=...&offset=...` — source-defined strength estimates grouped by occupation, preserving the five category values, raw threshold strings, standard errors, footnote codes, and source rows; page size is bounded to 200 occupations.

The physical requirements and environmental condition workspaces use the source-series endpoints; filtered CSV export is generated client-side from the same API data. The strength workspace uses the grouped strength endpoint without creating a composite score. Requests to CFOI event, rate, and historical analysis routes return an explicit `503 dataset_unavailable` response while CFOI data is absent. This is a local read-only API, not a hosted service or a stable public API. The server does not accept SQL or mutate data through HTTP.
