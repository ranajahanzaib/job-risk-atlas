"""Acquire and inspect the exact official BLS source workbooks."""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import json
import sqlite3
import time
import urllib.error
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
SOURCES = {
    "ors-2023": ("https://www.bls.gov/ors/xlsx/2023-complete-dataset.xlsx", "ors-2023.xlsx", 2023),
    "cfoi-events-2024": ("https://www.bls.gov/iif/fatal-injuries-tables/fatal-occupational-injuries-table-a-5-2024.xlsx", "cfoi-events-2024.xlsx", 2024),
    "cfoi-rates-2024": ("https://www.bls.gov/iif/fatal-injuries-tables/fatal-occupational-injuries-hours-based-rates-2024.xlsx", "cfoi-rates-2024.xlsx", 2024),
}
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main", "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships", "p": "http://schemas.openxmlformats.org/package/2006/relationships"}


def inspect(path: Path) -> dict:
    """Read workbook metadata and preview cells using Python's standard library."""
    with zipfile.ZipFile(path) as book:
        wb = ET.fromstring(book.read("xl/workbook.xml"))
        rels = ET.fromstring(book.read("xl/_rels/workbook.xml.rels"))
        targets = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels}
        shared = []
        if "xl/sharedStrings.xml" in book.namelist():
            root = ET.fromstring(book.read("xl/sharedStrings.xml"))
            shared = ["".join(t.text or "" for t in si.findall(".//m:t", NS)) for si in root.findall("m:si", NS)]
        sheets = []
        for sheet in wb.findall("m:sheets/m:sheet", NS):
            rel_id = sheet.attrib[f"{{{NS['r']}}}id"]
            target = targets[rel_id].lstrip("/")
            member = target if target.startswith("xl/") else "xl/" + target
            root = ET.fromstring(book.read(member))
            dim = root.find("m:dimension", NS)
            rows = []
            for row in root.findall("m:sheetData/m:row", NS)[:8]:
                vals = []
                for cell in row.findall("m:c", NS)[:16]:
                    value = cell.find("m:v", NS)
                    text = value.text if value is not None else ""
                    if cell.attrib.get("t") == "s" and text:
                        text = shared[int(text)]
                    inline = cell.find("m:is/m:t", NS)
                    if inline is not None:
                        text = inline.text or ""
                    vals.append(text)
                rows.append(vals)
            sheet_info = {"name": sheet.attrib["name"], "dimension": dim.attrib.get("ref") if dim is not None else None, "preview": rows}
            if sheet.attrib["name"] == "ORS 2023 dataset":
                headers = rows[0]
                summary = {
                    "records": 0,
                    "unique_series_ids": set(),
                    "occupations": set(),
                    "requirements": Counter(),
                    "estimate_types": Counter(),
                    "estimate_markers": Counter(),
                    "footnote_codes": Counter(),
                    "examples_by_requirement": {},
                }

                def cells(row_element: ET.Element) -> list[str]:
                    values = []
                    for cell in row_element.findall("m:c", NS):
                        value = cell.find("m:v", NS)
                        value_text = value.text if value is not None else ""
                        if cell.attrib.get("t") == "s" and value_text:
                            value_text = shared[int(value_text)]
                        inline = cell.find("m:is/m:t", NS)
                        if inline is not None:
                            value_text = inline.text or ""
                        values.append(value_text)
                    return values

                with book.open(member) as sheet_file:
                    for _, row_element in ET.iterparse(sheet_file, events=("end",)):
                        if row_element.tag != f"{{{NS['m']}}}row":
                            continue
                        values = cells(row_element)
                        row_element.clear()
                        if not values or values[0] == "SERIES ID":
                            continue
                        values += [""] * max(0, len(headers) - len(values))
                        record = dict(zip(headers, values))
                        summary["records"] += 1
                        summary["unique_series_ids"].add(record["SERIES ID"])
                        summary["occupations"].add((record["SOC 2018 CODE"], record["OCCUPATION"]))
                        summary["requirements"][record["REQUIREMENT"]] += 1
                        summary["estimate_types"][record["DATATYPE"]] += 1
                        summary["estimate_markers"][record["ESTIMATE"] or "<blank>"] += 1
                        summary["footnote_codes"][record["DATA FOOTNOTE"] or "<blank>"] += 1
                        req = record["REQUIREMENT"]
                        if req not in summary["examples_by_requirement"]:
                            summary["examples_by_requirement"][req] = {
                                key: record.get(key, "") for key in (
                                    "SOC 2018 CODE", "OCCUPATION", "ESTIMATE CODE", "ESTIMATE TEXT",
                                    "CATEGORY", "ADDITIVE", "DATATYPE", "ESTIMATE", "STANDARD ERROR", "DATA FOOTNOTE"
                                )
                            }
                summary["unique_series_ids"] = len(summary["unique_series_ids"])
                summary["occupation_count_including_aggregate_codes"] = len(summary["occupations"])
                summary.pop("occupations")
                for key in ("requirements", "estimate_types", "estimate_markers", "footnote_codes"):
                    summary[key] = dict(summary[key].most_common())
                sheet_info["data_summary"] = summary
            sheets.append(sheet_info)
        return {"file": path.name, "bytes": path.stat().st_size, "sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "sheets": sheets}


def acquire(name: str, force: bool = False) -> Path:
    url, filename, _ = SOURCES[name]
    RAW.mkdir(parents=True, exist_ok=True)
    target = RAW / filename
    if target.exists() and not force:
        raise SystemExit(f"Refusing to overwrite existing file: {target}. Pass --force to replace it.")
    request = urllib.request.Request(url, headers={"User-Agent": "JobRiskAtlas/0.1 (public-data research)"})
    last_error = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                data = response.read()
            if not data.startswith(b"PK\x03\x04"):
                raise ValueError(f"Source did not return an XLSX ZIP workbook: {url}")
            temporary = target.with_suffix(target.suffix + ".part")
            temporary.write_bytes(data)
            temporary.replace(target)
            return target
        except (urllib.error.URLError, TimeoutError, ValueError) as error:
            last_error = error
            if attempt < 2:
                time.sleep(2 ** attempt)
    raise SystemExit(f"Download failed for {url}: {last_error}. Download the workbook manually from the BLS source page into {RAW}.")


def build_ors(path: Path | None = None) -> Path:
    """Materialize source-faithful ORS rows and footnotes into a local SQLite file."""
    source = path or RAW / SOURCES["ors-2023"][1]
    if not source.exists():
        raise SystemExit(f"Missing official ORS workbook: {source}. Run acquire or place the official file there.")
    processed = ROOT / "data" / "processed"
    processed.mkdir(parents=True, exist_ok=True)
    target = processed / "ors-2023.sqlite3"
    temporary = processed / "ors-2023.sqlite3.part"
    temporary.unlink(missing_ok=True)
    with zipfile.ZipFile(source) as book:
        wb = ET.fromstring(book.read("xl/workbook.xml"))
        rels = ET.fromstring(book.read("xl/_rels/workbook.xml.rels"))
        targets = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels}
        shared = []
        if "xl/sharedStrings.xml" in book.namelist():
            root = ET.fromstring(book.read("xl/sharedStrings.xml"))
            shared = ["".join(t.text or "" for t in si.findall(".//m:t", NS)) for si in root.findall("m:si", NS)]
        members = {}
        for sheet in wb.findall("m:sheets/m:sheet", NS):
            target_name = targets[sheet.attrib[f"{{{NS['r']}}}id"]].lstrip("/")
            member = target_name if target_name.startswith("xl/") else "xl/" + target_name
            members[sheet.attrib["name"]] = member
        conn = sqlite3.connect(temporary)
        conn.executescript("""
          PRAGMA journal_mode=OFF;
          PRAGMA synchronous=OFF;
          CREATE TABLE observations (
            series_id TEXT PRIMARY KEY, series_title TEXT NOT NULL, soc_code TEXT NOT NULL,
            occupation TEXT NOT NULL, requirement TEXT NOT NULL, estimate_code TEXT NOT NULL,
            estimate_text TEXT NOT NULL, category_code TEXT NOT NULL, category TEXT NOT NULL,
            additive_code TEXT NOT NULL, additive TEXT NOT NULL, datatype_code TEXT NOT NULL,
            datatype TEXT NOT NULL, estimate_raw TEXT NOT NULL, standard_error_raw TEXT NOT NULL,
            footnote_raw TEXT NOT NULL, source_sheet TEXT NOT NULL, source_row INTEGER NOT NULL
          );
          CREATE INDEX observations_soc_req ON observations(soc_code, requirement, category);
          CREATE INDEX observations_title ON observations(occupation COLLATE NOCASE);
          CREATE TABLE occupations AS SELECT DISTINCT soc_code, occupation FROM observations WHERE 0;
          CREATE UNIQUE INDEX occupations_soc ON occupations(soc_code);
          CREATE TABLE footnotes (code TEXT PRIMARY KEY, text TEXT NOT NULL);
        """)

        def values_for(row_element: ET.Element) -> list[str]:
            output = []
            for cell in row_element.findall("m:c", NS):
                value = cell.find("m:v", NS)
                text = value.text if value is not None else ""
                if cell.attrib.get("t") == "s" and text:
                    text = shared[int(text)]
                inline = cell.find("m:is/m:t", NS)
                if inline is not None:
                    text = inline.text or ""
                output.append(text)
            return output

        foot_member = members.get("Footnote codes")
        if foot_member:
            with book.open(foot_member) as input_file:
                for _, row in ET.iterparse(input_file, events=("end",)):
                    if row.tag != f"{{{NS['m']}}}row":
                        continue
                    values = values_for(row)
                    row.clear()
                    if len(values) >= 2 and values[0] not in ("", "Footnote code"):
                        conn.execute("INSERT OR REPLACE INTO footnotes VALUES (?, ?)", (values[0], values[1]))

        expected = ["SERIES ID", "SERIES TITLE", "SOC 2018 CODE", "OCCUPATION", "REQUIREMENT", "ESTIMATE CODE", "ESTIMATE TEXT", "CATEGORY CODE", "CATEGORY", "ADDITIVE CODE", "ADDITIVE", "DATATYPE CODE", "DATATYPE", "ESTIMATE", "STANDARD ERROR", "DATA FOOTNOTE"]
        dataset_member = members.get("ORS 2023 dataset")
        if not dataset_member:
            conn.close()
            temporary.unlink(missing_ok=True)
            raise SystemExit("The expected 'ORS 2023 dataset' sheet was not found.")
        inserted = 0
        with book.open(dataset_member) as input_file:
            for _, row in ET.iterparse(input_file, events=("end",)):
                if row.tag != f"{{{NS['m']}}}row":
                    continue
                source_row = int(row.attrib.get("r", "0"))
                values = values_for(row)
                row.clear()
                if not values or values[0] == "SERIES ID":
                    continue
                if len(values) < len(expected):
                    values += [""] * (len(expected) - len(values))
                record = dict(zip(expected, values))
                if not record["SERIES ID"] or not record["SOC 2018 CODE"].isdigit() or len(record["SOC 2018 CODE"]) != 6:
                    conn.close()
                    temporary.unlink(missing_ok=True)
                    raise SystemExit(f"Invalid series or 2018 SOC code at workbook row {source_row}.")
                conn.execute("INSERT INTO observations VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", (
                    record["SERIES ID"], record["SERIES TITLE"], record["SOC 2018 CODE"], record["OCCUPATION"],
                    record["REQUIREMENT"], record["ESTIMATE CODE"], record["ESTIMATE TEXT"], record["CATEGORY CODE"],
                    record["CATEGORY"], record["ADDITIVE CODE"], record["ADDITIVE"], record["DATATYPE CODE"],
                    record["DATATYPE"], record["ESTIMATE"], record["STANDARD ERROR"], record["DATA FOOTNOTE"],
                    "ORS 2023 dataset", source_row
                ))
                inserted += 1
        conn.execute("INSERT INTO occupations SELECT DISTINCT soc_code, occupation FROM observations")
        conn.commit()
        row_count = conn.execute("SELECT COUNT(*) FROM observations").fetchone()[0]
        unique_codes = conn.execute("SELECT COUNT(*) FROM occupations").fetchone()[0]
        conn.close()
        if row_count != inserted or row_count != 128398 or unique_codes != 500:
            temporary.unlink(missing_ok=True)
            raise SystemExit(f"ORS validation failed: rows={row_count}, inserted={inserted}, occupations={unique_codes}.")
    temporary.replace(target)
    validation = {"dataset": "ors-2023", "source_sheet": "ORS 2023 dataset", "reference_year": 2023, "observations": inserted, "unique_series_ids": inserted, "occupation_code_title_pairs": 500, "status": "valid", "raw_estimates_preserved_as_text": True}
    (processed / "ors-2023-validation.json").write_text(json.dumps(validation, indent=2) + "\n")
    return target


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("acquire", "inspect", "record", "build", "status"))
    parser.add_argument("dataset", nargs="?", choices=tuple(SOURCES))
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    if args.command == "acquire":
        names = [args.dataset] if args.dataset else list(SOURCES)
        records = []
        for name in names:
            path = acquire(name, args.force)
            records.append({"id": name, "source_url": SOURCES[name][0], "retrieved_at_utc": datetime.now(timezone.utc).isoformat(), **inspect(path)})
            print(f"Acquired {path}")
        manifest = ROOT / "data" / "manifests" / "downloads.json"
        manifest.parent.mkdir(parents=True, exist_ok=True)
        existing = json.loads(manifest.read_text()) if manifest.exists() else {"datasets": []}
        by_id = {row["id"]: row for row in existing["datasets"]}
        by_id.update({row["id"]: row for row in records})
        manifest.write_text(json.dumps({"datasets": list(by_id.values())}, indent=2) + "\n")
    elif args.command == "inspect":
        for name in ([args.dataset] if args.dataset else SOURCES):
            path = RAW / SOURCES[name][1]
            if path.exists():
                print(json.dumps({"id": name, **inspect(path)}, indent=2))
            else:
                print(json.dumps({"id": name, "status": "not_acquired"}))
    elif args.command == "build":
        if args.dataset not in (None, "ors-2023"):
            raise SystemExit("Only the acquired ORS 2023 workbook currently has a validated materializer.")
        print(f"Built {build_ors()}")
    elif args.command == "record":
        names = [args.dataset] if args.dataset else list(SOURCES)
        manifest = ROOT / "data" / "manifests" / "downloads.json"
        manifest.parent.mkdir(parents=True, exist_ok=True)
        existing = json.loads(manifest.read_text()) if manifest.exists() else {"datasets": []}
        by_id = {row["id"]: row for row in existing["datasets"]}
        for name in names:
            path = RAW / SOURCES[name][1]
            if not path.exists():
                print(f"Skipped {name}: no source file at {path}")
                continue
            by_id[name] = {"id": name, "source_url": SOURCES[name][0], "retrieved_at_utc": datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat(), **inspect(path)}
        manifest.write_text(json.dumps({"datasets": list(by_id.values())}, indent=2) + "\n")
        print(f"Wrote {manifest}")
    else:
        print(json.dumps([{"id": name, "file": SOURCES[name][1], "status": "acquired" if (RAW / SOURCES[name][1]).exists() else "not_acquired", "source_url": SOURCES[name][0]} for name in SOURCES], indent=2))


if __name__ == "__main__":
    main()
