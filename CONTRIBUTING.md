# Contributing

Contributions that improve the data pipeline, scientific interpretation, accessibility, or application are welcome. For substantial changes, open an issue to discuss the approach before submitting a pull request.

## Local development

The application uses Python's standard library and browser-native HTML, CSS, and JavaScript. No package installation is required.

```bash
python3 server.py
python3 -m py_compile server.py scripts/data.py
node --check web/app.js
```

To acquire and inspect the official source workbooks, see [Data sources](docs/data-sources.md) and [Data pipeline](docs/data-pipeline.md). Raw workbooks and generated databases are local artifacts and are excluded from version control.

## Contribution guidelines

- Preserve source values, footnotes, suppression markers, and provenance.
- Do not infer zero from missing or suppressed data.
- Do not join ORS and CFOI by occupation title alone or distribute aggregate values to detailed occupations.
- Keep source years and population differences visible.
- Do not introduce causal claims or individual risk predictions.
- Include focused tests or reproducible verification steps with behavior changes.
- Describe scientific, data, or interface changes and their verification in the pull request.

Report bugs and propose features through the repository issue tracker.
