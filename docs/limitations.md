# Limitations and implementation status

## Current data

- ORS 2023 final second-wave source data is acquired and materialized. Its source strings, standard errors, footnote codes, and sheet/row provenance are retained.
- CFOI 2024 occupation-event and hours-based-rate workbooks are listed in the source catalog but are not present locally. Download attempts returned HTTP 403. The dashboard and API show explicit unavailable states; no CFOI values have been synthesized.
- ORS estimates are source-faithful, not yet harmonized into an interval/status model. The occupation hierarchy, population compatibility review, and cross-source SOC mapping are not implemented.
- The SQLite database is a local analytical store. Parquet, DuckDB, cached aggregates, and a production data service are not implemented.
- The API is a typed-by-convention, standard-library Python service with bounded parameterized queries. FastAPI/Pydantic contracts, OpenAPI, structured request logging, and production caching are not implemented.

## Product capabilities

- Working ORS workflows include occupation lookup and profile, physical requirements, environmental conditions, five-category strength tables, selected-occupation comparison by identical source estimate code, a source inspector, and filtered CSV exports.
- The occupation landscape currently plots a selected numeric source estimate against its published standard error. Threshold and suppressed values remain in the table but are omitted from the numeric plot; axis selection, zoom/lasso interactions, occupation grouping, fullscreen, and richer point encodings remain unfinished.
- The anatomy workspace has a procedural 3D schematic mannequin with pointer rotation and region selection, plus an accessible 2D SVG/button fallback. It is an illustrative activity navigator, not a licensed anatomical reference model or a measure of biomechanical loading.
- The movement lab currently demonstrates three conceptual motion sequences (reach, stoop, and lift/carry) with play, pause, reset, and frame scrubbing. It does not yet implement the full activity list or measured worker motion.
- Comparison supports up to six exact 2018 SOC occupations, aligned only on identical ORS estimate codes, and shareable SOC selections in the URL. It does not yet provide the full set of comparison charts or valid difference modes described in the product plan.
- The profile and workspace set is source-oriented: occupation descriptions/hierarchy, locally saved named configurations, recent/bookmarked occupations, command palette, profile report, and shareable profile routes are not implemented.
- The landscape supports one source series at a time and plots its numeric estimate against standard error. Independent X/Y measure selection, zoom/pan, rectangle/lasso selection, group filters, and cross-chart linked selection are not implemented.
- Physical and environmental workspaces are source series tables with charts and CSV output; the occupation-by-indicator matrix, virtualized drill-down, and full condition/requirement definitions are not implemented. The dataset browser is limited to occupations, ORS source series, and coverage/validation rather than all source records and crosswalks.
- Fatal injury counts/rates, event composition, cross-source comparison, correlations, and historical trends remain unavailable until compatible official CFOI data and classification mappings are acquired and reviewed.
- Data browser currently covers occupation classifications, selected physical/environment series, and source validation/readiness. It does not yet provide a normalized cross-dataset contract or a complete record-level original-cell inspector.
- Export currently covers ORS source tables and landscape points as CSV. JSON, Parquet, chart image, and printable report exports are not implemented.

## Engineering and QA

- The API is a local standard-library read-only server, not a hosted service or a stable public contract.
- A manual browser review covered the overview, an occupation profile, anatomy region selection and mapped ORS records, movement lab, comparison route, and CFOI unavailable page; the anatomy and movement views were also inspected at a 390 × 844 viewport. Formal WCAG 2.2 AA audit, the full planned viewport matrix, broader browser review, scientific regression coverage, end-to-end workflows, and production operational deployment remain outstanding.
- Responsive layouts, keyboard controls, visible text status, and reduced-motion styles are implemented, but have not been formally certified.
- The dashboard uses original CSS/SVG illustrations and procedural Three.js geometry rather than licensed documentary photography or a sourced scientific anatomical asset.

These gaps are kept visible in the UI and source documentation. Continue with the CFOI workbook acquisition and inspection before implementing release-specific parsing or cross-source analysis.
