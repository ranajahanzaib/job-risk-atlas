# Architecture

The dashboard is a React 19 + TypeScript application built by Vite 8 from `web/`. Recharts is loaded on demand for quantitative plots. Vite proxies `/api` to a Python standard-library HTTP server in `server.py` during development. In production, the same server serves the generated `dist/` dashboard and read-only API.

The browser provides the global navigation, occupation search, persistent comparison selection (up to six occupations), searchable source tables, a procedural 3D schematic anatomy view with an SVG/button fallback, an illustrative movement lab, source status, methodology pages, responsive layouts, and explicit unavailable states. ORS workspaces use real API observations and preserve raw values and provenance.

`data/raw/` holds original BLS workbooks and is git-ignored. `data/manifests/downloads.json` records acquisition provenance. `scripts/data.py` materializes ORS source-faithful rows and footnotes to a local SQLite database; `server.py` provides parameterized read-only search, profile, coverage, validation, and source-series queries. CFOI parsing, canonical cross-source contracts, a reviewed classification crosswalk, and CFOI query services remain blocked until the official workbook is acquired and inspected. The current XLSX requests returned HTTP 403.
