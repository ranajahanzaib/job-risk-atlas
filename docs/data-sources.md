# Data sources

## Occupational Requirements Survey

The target is the BLS **final second-wave complete dataset, reference year 2023**: [ORS databases](https://www.bls.gov/ors/data.htm). Do not replace it with preliminary third-wave estimates. ORS describes job requirements for its covered worker population, not individual physical capability or injury outcomes.

## Census of Fatal Occupational Injuries

The target release is 2024: [CFOI current and revised tables](https://www.bls.gov/iif/fatal-injuries-tables.htm). The acquisition catalog includes the occupation-by-event-or-exposure workbook and national hours-based fatal injury rates workbook. CFOI reports observed fatal work injuries under its definitions.

## Release and population distinctions

ORS reference year 2023 and CFOI reference year 2024 are not linked records and do not necessarily describe the same worker populations. ORS excludes several populations, including agricultural establishments, self-employed workers, federal workers, and private household workers. Missing ORS coverage must remain unavailable, not zero.

## Acquisition status

`python3 scripts/data.py acquire` fetches catalogued original XLSX files, checks file signatures, and writes checksums/retrieval metadata. Existing raw files are protected unless `--force` is passed. A manual download from the BLS pages is supported when the host is unreachable. Current code inspects workbook structure but does not yet normalize observations or provide record-level cell provenance.

## Inspected ORS 2023 workbook

The acquired workbook has three sheets: `File information` (A1:B20), `Footnote codes` (A1:B36), and `ORS 2023 dataset` (A1:R128399). The estimates sheet has 16 populated columns: `SERIES ID`, `SERIES TITLE`, `SOC 2018 CODE`, `OCCUPATION`, `REQUIREMENT`, `ESTIMATE CODE`, `ESTIMATE TEXT`, `CATEGORY CODE`, `CATEGORY`, `ADDITIVE CODE`, `ADDITIVE`, `DATATYPE CODE`, `DATATYPE`, `ESTIMATE`, `STANDARD ERROR`, and `DATA FOOTNOTE` (two trailing columns in the declared range are empty). The sheet contains 128,398 observations and series IDs; 500 occupation code/title pairs including aggregate codes. Requirements include physical demands, environmental conditions, education/training/experience, and cognitive/mental requirements. Datatypes include Percentage, Hours, Days, and Pounds. Estimate strings include threshold forms such as `<0.5`, `>99.5`, and `<0.05`; retain these as published values rather than coercing them to arbitrary point estimates. The series IDs use the second-wave `OA` prefix. The workbook file-information sheet states that estimates aggregate five annual samples collected September 2018–July 2023 and represent final second-wave estimates.

CFOI 2024 occupation-event and hours-based-rate files have not been acquired or processed. CFOI measures are therefore not displayed by the application.
