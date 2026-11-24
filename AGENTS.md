# Repository guidance

## Product and science

- Use official source observations only. Never create synthetic statistics or convert missing/suppressed values to zero.
- Preserve raw estimate labels, units, standard errors, footnotes, source workbook, sheet, and row references.
- Keep ORS 2023 and CFOI 2024 population and reference-year differences visible. Do not imply worker-level linkage or causation.
- Do not match occupations by title alone, assign parent values to detailed occupations, average rates, or build an occupational danger score.
- Body-region links are illustrative activity navigation, not measured biomechanics or injury data.
- If a source asset is unavailable, show the source status and an honest unavailable state.

## Frontend

- The dashboard is React + TypeScript + Vite in `web/src/`.
- Use pnpm and the committed lockfile. Resolve current stable compatible packages through the package manager; do not pin versions from memory.
- Keep API access in typed asynchronous requests and keep scientific calculations out of presentational components.
- Respect reduced motion, keyboard navigation, color-independent labels, and responsive layouts.
- Keep Vite's `/api` proxy in sync with the local API address.

## Data and API

- `scripts/data.py` owns source acquisition, workbook inspection, and materialization.
- `server.py` is a local read-only API. Use parameterized SQL and bounded pagination. Never expose arbitrary SQL.
- Inspect a release workbook before adding release-specific parsing logic.
- Raw workbooks and generated analytical databases belong under ignored `data/raw/` and `data/processed/`.

## Useful commands

- `pnpm dev` — local API and Vite dashboard.
- `pnpm build` — TypeScript type check and production dashboard build.
- `python3 scripts/data.py status|inspect|build` — data pipeline status and processing.
- `python3 -m py_compile server.py scripts/data.py` — Python syntax check.
