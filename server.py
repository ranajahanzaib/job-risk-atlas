"""Small dependency-free development server for the Job Risk Atlas shell."""
from __future__ import annotations

import json
import mimetypes
import hashlib
import re
import sqlite3
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse
from urllib.parse import parse_qs

ROOT = Path(__file__).parent
DATA = ROOT / "data"
DB_PATH = DATA / "processed" / "ors-2023.sqlite3"


def get_web_dir() -> Path:
    dist = ROOT / "dist"
    return dist if (dist / "index.html").exists() else ROOT / "web"


class Handler(BaseHTTPRequestHandler):
    def do_HEAD(self) -> None:
        self.do_GET()

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/api/v1/health":
            self.send_json({"status": "ok", "ors_2023_ready": DB_PATH.exists(), "cfoi_2024_ready": False})
            return
        if path == "/api/v1/metadata":
            manifest = DATA / "processed" / "manifest.json"
            if manifest.exists():
                self.send_json(json.loads(manifest.read_text()))
            else:
                files = [("ors-2023", 2023, "data/raw/ors-2023.xlsx", "https://www.bls.gov/ors/data.htm"),
                         ("cfoi-events-2024", 2024, "data/raw/cfoi-events-2024.xlsx", "https://www.bls.gov/iif/fatal-injuries-tables.htm"),
                         ("cfoi-rates-2024", 2024, "data/raw/cfoi-rates-2024.xlsx", "https://www.bls.gov/iif/fatal-injuries-tables.htm")]
                datasets = []
                for dataset_id, year, relative, source in files:
                    file = ROOT / relative
                    datasets.append({"id": dataset_id, "year": year, "source": source, "status": "acquired_unprocessed" if file.exists() else "not_acquired", "sha256": hashlib.sha256(file.read_bytes()).hexdigest() if file.exists() else None})
                if DB_PATH.exists():
                    datasets[0]["status"] = "processed"
                acquired = any(row["status"] == "acquired_unprocessed" for row in datasets)
                processed = any(row["status"] == "processed" for row in datasets)
                self.send_json({"status": "partial" if processed else "source_files_acquired" if acquired else "unavailable", "processing_status": "ors_2023_only" if processed else "not_processed", "message": "ORS observations are queryable; CFOI source workbooks are unavailable." if processed else "Source workbooks are not yet transformed into queryable research observations.", "datasets": datasets})
            return
        if path == "/api/v1/coverage":
            if DB_PATH.exists():
                conn = self.db()
                ors = conn.execute("SELECT COUNT(*) AS observations, COUNT(DISTINCT soc_code) AS occupations FROM observations").fetchone()
                domains = conn.execute("SELECT requirement, COUNT(DISTINCT estimate_code) AS series FROM observations GROUP BY requirement ORDER BY requirement").fetchall()
                conn.close()
                self.send_json({"reference_years": {"ors": 2023, "cfoi": 2024}, "datasets": {"ors_2023": {"status": "processed", "observations": ors["observations"], "occupations": ors["occupations"], "classification": "2018 SOC"}, "cfoi_2024": {"status": "not_acquired", "reason": "Official workbook request returned HTTP 403."}}, "ors_series_by_requirement": {row["requirement"]: row["series"] for row in domains}})
            else:
                self.send_json({"datasets": {"ors_2023": {"status": "not_processed"}, "cfoi_2024": {"status": "not_acquired"}}}, 503)
            return
        if path == "/api/v1/validation":
            report = DATA / "processed" / "ors-2023-validation.json"
            if not report.exists():
                self.send_json({"error": {"code": "validation_unavailable", "message": "No ORS validation report has been generated."}}, 404)
            else:
                self.send_json(json.loads(report.read_text()))
            return
        if path in {"/api/v1/events", "/api/v1/relationships", "/api/v1/trends"} or re.fullmatch(r"/api/v1/occupations/(\d{2}-?\d{4}|\d{6})/(fatal-injuries|events|trends)", path):
            self.send_json({"error": {"code": "dataset_unavailable", "message": "CFOI 2024 workbooks have not been acquired and processed; no fatal injury observations are available."}, "dataset": "CFOI", "reference_year": 2024, "status": "unavailable"}, 503)
            return
        if path == "/api/v1/occupations":
            self.occupation_search(parse_qs(urlparse(self.path).query))
            return
        if path == "/api/v1/series":
            self.series_catalog(parse_qs(urlparse(self.path).query))
            return
        if path == "/api/v1/strength":
            self.strength_matrix(parse_qs(urlparse(self.path).query))
            return
        series_match = re.fullmatch(r"/api/v1/series/(\d{1,5})", path)
        if series_match:
            self.series_observations(series_match.group(1).zfill(5), parse_qs(urlparse(self.path).query))
            return
        match = re.fullmatch(r"/api/v1/occupations/(\d{2}-?\d{4}|\d{6})(?:/(requirements))?", path)
        if match:
            clean_soc = match.group(1).replace("-", "")
            if not DB_PATH.exists():
                self.send_json({"error": {"code": "data_unavailable", "message": "ORS 2023 has not been processed."}}, 503)
            elif match.group(2):
                self.occupation_requirements(clean_soc, parse_qs(urlparse(self.path).query))
            else:
                self.occupation_detail(clean_soc)
            return
        web_dir = get_web_dir()
        target = web_dir / ("index.html" if path == "/" else path.lstrip("/"))
        try:
            resolved = target.resolve()
            if web_dir.resolve() not in resolved.parents:
                raise FileNotFoundError
            payload = resolved.read_bytes()
        except (OSError, ValueError):
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header("Content-Type", mimetypes.guess_type(target.name)[0] or "application/octet-stream")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(payload)

    def db(self) -> sqlite3.Connection:
        connection = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA query_only=ON")
        return connection

    def occupation_search(self, query: dict[str, list[str]]) -> None:
        if not DB_PATH.exists():
            self.send_json({"error": {"code": "data_unavailable", "message": "ORS 2023 has not been processed."}}, 503)
            return
        term = query.get("q", [""])[0].strip()
        if len(term) > 120:
            self.send_json({"error": {"code": "query_too_long", "message": "Search terms are limited to 120 characters."}}, 400)
            return
        try:
            limit = max(1, min(100, int(query.get("limit", ["20"])[0])))
            offset = max(0, int(query.get("offset", ["0"])[0]))
        except ValueError:
            self.send_json({"error": {"code": "invalid_pagination", "message": "limit and offset must be integers."}}, 400)
            return
        conn = self.db()
        if term:
            pattern = f"%{term}%"
            clean_soc = term.replace("-", "").strip()
            where = "WHERE soc_code LIKE ? OR soc_code LIKE ? OR occupation LIKE ? COLLATE NOCASE"
            params = (pattern, f"%{clean_soc}%", pattern)
            count = conn.execute(f"SELECT COUNT(DISTINCT soc_code) FROM observations {where}", params).fetchone()[0]
            rows = conn.execute(f"SELECT soc_code, occupation, COUNT(*) AS observation_count FROM observations {where} GROUP BY soc_code, occupation ORDER BY CASE WHEN occupation LIKE ? COLLATE NOCASE THEN 0 ELSE 1 END, occupation LIMIT ? OFFSET ?", (*params, f"{term}%", limit, offset)).fetchall()
        else:
            count = conn.execute("SELECT COUNT(*) FROM occupations").fetchone()[0]
            rows = conn.execute("SELECT o.soc_code, o.occupation, COUNT(v.series_id) AS observation_count FROM occupations o JOIN observations v USING(soc_code) GROUP BY o.soc_code, o.occupation ORDER BY o.occupation LIMIT ? OFFSET ?", (limit, offset)).fetchall()
        conn.close()
        self.send_json({"items": [dict(row) for row in rows], "total": count, "limit": limit, "offset": offset, "datasets": {"ors_2023": "available", "cfoi_2024": "unavailable"}})

    def series_catalog(self, query: dict[str, list[str]]) -> None:
        """List source-defined ORS estimate series for a requirement domain."""
        if not DB_PATH.exists():
            self.send_json({"error": {"code": "data_unavailable", "message": "ORS 2023 has not been processed."}}, 503)
            return
        requirement = query.get("requirement", ["Physical demands"])[0]
        if requirement not in {"Physical demands", "Environmental conditions"}:
            self.send_json({"error": {"code": "invalid_requirement", "message": "Choose a supported ORS requirement domain."}}, 400)
            return
        conn = self.db()
        rows = conn.execute("""SELECT estimate_code, MIN(series_title) AS series_title, estimate_text, category, datatype,
            COUNT(DISTINCT soc_code) AS occupation_count FROM observations
            WHERE requirement=? GROUP BY estimate_code, estimate_text, category, datatype
            ORDER BY category, estimate_text""", (requirement,)).fetchall()
        conn.close()
        self.send_json({"requirement": requirement, "reference_year": 2023, "items": [dict(row) for row in rows], "source": "https://www.bls.gov/ors/data.htm"})

    def strength_matrix(self, query: dict[str, list[str]]) -> None:
        if not DB_PATH.exists():
            self.send_json({"error": {"code": "data_unavailable", "message": "ORS 2023 has not been processed."}}, 503)
            return
        try:
            limit = max(1, min(200, int(query.get("limit", ["100"])[0])))
            offset = max(0, int(query.get("offset", ["0"])[0]))
        except ValueError:
            self.send_json({"error": {"code": "invalid_pagination", "message": "limit and offset must be integers."}}, 400)
            return
        term = query.get("q", [""])[0].strip()
        if len(term) > 120:
            self.send_json({"error": {"code": "query_too_long", "message": "Search terms are limited to 120 characters."}}, 400)
            return
        conn = self.db()
        where = "requirement='Physical demands' AND category='Strength'"
        params: tuple[object, ...] = ()
        if term:
            clean_soc = term.replace("-", "").strip()
            where += " AND (occupation LIKE ? COLLATE NOCASE OR soc_code LIKE ? OR soc_code LIKE ?)"
            params = (f"%{term}%", f"%{term}%", f"%{clean_soc}%")
        total = conn.execute(f"SELECT COUNT(DISTINCT soc_code) FROM observations WHERE {where}", params).fetchone()[0]
        category_rows = conn.execute("SELECT DISTINCT estimate_text FROM observations WHERE requirement='Physical demands' AND category='Strength'").fetchall()
        strength_order = ("sedentary", "light work", "medium work", "heavy work", "very heavy work")
        category_labels = sorted((row["estimate_text"] for row in category_rows), key=lambda label: next((i for i, suffix in enumerate(strength_order) if label.lower().endswith(suffix)), len(strength_order)))
        occupations = conn.execute(f"SELECT soc_code, occupation FROM observations WHERE {where} GROUP BY soc_code, occupation ORDER BY occupation LIMIT ? OFFSET ?", (*params, limit, offset)).fetchall()
        rows = []
        if occupations:
            codes = [row["soc_code"] for row in occupations]
            marks = ",".join("?" for _ in codes)
            rows = conn.execute(f"""SELECT series_id, soc_code, occupation, estimate_text, category,
                estimate_code, estimate_raw, standard_error_raw, footnote_raw, source_sheet, source_row
                FROM observations WHERE soc_code IN ({marks}) AND requirement='Physical demands' AND category='Strength'
                ORDER BY occupation, estimate_text""", codes).fetchall()
        footnote_codes = sorted({code.strip() for row in rows for code in row["footnote_raw"].split(",") if code.strip()})
        footnotes = {}
        if footnote_codes:
            marks = ",".join("?" for _ in footnote_codes)
            footnotes = {row["code"]: row["text"] for row in conn.execute(f"SELECT code,text FROM footnotes WHERE code IN ({marks})", footnote_codes)}
        conn.close()
        groups: dict[str, dict[str, object]] = {row["soc_code"]: {"soc_code": row["soc_code"], "occupation": row["occupation"], "categories": {}} for row in occupations}
        for row in rows:
            item = dict(row)
            item["footnotes"] = [{"code": code.strip(), "text": footnotes.get(code.strip())} for code in item["footnote_raw"].split(",") if code.strip()]
            groups[row["soc_code"]]["categories"][row["estimate_text"]] = item
        self.send_json({"reference_year": 2023, "categories": category_labels, "items": list(groups.values()), "total": total, "limit": limit, "offset": offset, "source": "https://www.bls.gov/ors/data.htm"})

    def series_observations(self, estimate_code: str, query: dict[str, list[str]]) -> None:
        """Return exact published observations for a source-defined estimate across occupations."""
        if not DB_PATH.exists():
            self.send_json({"error": {"code": "data_unavailable", "message": "ORS 2023 has not been processed."}}, 503)
            return
        try:
            limit = max(1, min(500, int(query.get("limit", ["100"])[0])))
            offset = max(0, int(query.get("offset", ["0"])[0]))
        except ValueError:
            self.send_json({"error": {"code": "invalid_pagination", "message": "limit and offset must be integers."}}, 400)
            return
        conn = self.db()
        requirement = query.get("requirement", [""])[0]
        if requirement and requirement not in {"Physical demands", "Environmental conditions"}:
            self.send_json({"error": {"code": "invalid_requirement", "message": "Choose a supported ORS requirement domain."}}, 400)
            return
        catalog_where = "estimate_code=? AND requirement IN ('Physical demands','Environmental conditions')"
        catalog_params: tuple[object, ...] = (estimate_code,)
        where = catalog_where
        params: tuple[object, ...] = catalog_params
        if requirement:
            where += " AND requirement=?"
            catalog_where += " AND requirement=?"
            params += (requirement,)
            catalog_params += (requirement,)
        term = query.get("q", [""])[0].strip()
        if len(term) > 120:
            conn.close()
            self.send_json({"error": {"code": "query_too_long", "message": "Search terms are limited to 120 characters."}}, 400)
            return
        if term:
            clean_soc = term.replace("-", "").strip()
            where += " AND (occupation LIKE ? COLLATE NOCASE OR soc_code LIKE ? OR soc_code LIKE ?)"
            params += (f"%{term}%", f"%{term}%", f"%{clean_soc}%")
        total = conn.execute(f"SELECT COUNT(*) FROM observations WHERE {where}", params).fetchone()[0]
        catalog_row = conn.execute(f"SELECT estimate_text, category, datatype, requirement FROM observations WHERE {catalog_where} LIMIT 1", catalog_params).fetchone()
        rows = conn.execute(f"""SELECT series_id, soc_code, occupation, requirement, category,
            estimate_code, estimate_text, datatype, estimate_raw, standard_error_raw,
            footnote_raw, source_sheet, source_row FROM observations WHERE {where}
            ORDER BY occupation LIMIT ? OFFSET ?""", (*params, limit, offset)).fetchall()
        footnote_codes = sorted({code.strip() for row in rows for code in row["footnote_raw"].split(",") if code.strip()})
        footnotes = {}
        if footnote_codes:
            marks = ",".join("?" for _ in footnote_codes)
            footnotes = {row["code"]: row["text"] for row in conn.execute(f"SELECT code,text FROM footnotes WHERE code IN ({marks})", footnote_codes)}
        conn.close()
        if not rows and not term:
            self.send_json({"error": {"code": "series_not_found", "message": f"No ORS source series {estimate_code} is present."}}, 404)
            return
        if not rows:
            if catalog_row is None:
                self.send_json({"error": {"code": "series_not_found", "message": f"No ORS source series {estimate_code} is present."}}, 404)
                return
            self.send_json({"estimate_code": estimate_code, "estimate_text": catalog_row["estimate_text"], "category": catalog_row["category"], "datatype": catalog_row["datatype"], "requirement": catalog_row["requirement"], "reference_year": 2023, "items": [], "total": 0, "limit": limit, "offset": offset, "provenance": {"workbook": "ors-2023.xlsx", "sheet": "ORS 2023 dataset", "source": "https://www.bls.gov/ors/data.htm"}})
            return
        items = []
        for row in rows:
            item = dict(row)
            item["footnotes"] = [{"code": code.strip(), "text": footnotes.get(code.strip())} for code in item["footnote_raw"].split(",") if code.strip()]
            items.append(item)
        first = rows[0]
        self.send_json({"estimate_code": estimate_code, "estimate_text": first["estimate_text"], "category": first["category"], "datatype": first["datatype"], "requirement": first["requirement"], "reference_year": 2023, "items": items, "total": total, "limit": limit, "offset": offset, "provenance": {"workbook": "ors-2023.xlsx", "sheet": "ORS 2023 dataset", "source": "https://www.bls.gov/ors/data.htm"}})

    def occupation_detail(self, soc_code: str) -> None:
        conn = self.db()
        row = conn.execute("SELECT soc_code, occupation, COUNT(*) AS observation_count FROM observations WHERE soc_code=? GROUP BY soc_code, occupation", (soc_code,)).fetchone()
        conn.close()
        if row is None:
            self.send_json({"error": {"code": "occupation_not_found", "message": f"No ORS 2023 classification {soc_code} is present."}}, 404)
        else:
            self.send_json({**dict(row), "reference_year": 2023, "classification": "2018 SOC", "datasets": {"ors_2023": "available", "cfoi_2024": "unavailable"}, "match_status": "no CFOI comparison available"})

    def occupation_requirements(self, soc_code: str, query: dict[str, list[str]]) -> None:
        try:
            limit = max(1, min(200, int(query.get("limit", ["100"])[0])))
            offset = max(0, int(query.get("offset", ["0"])[0]))
        except ValueError:
            self.send_json({"error": {"code": "invalid_pagination", "message": "limit and offset must be integers."}}, 400)
            return
        category_filter = query.get("requirement", [""])[0]
        estimate_category = query.get("category", [""])[0]
        conn = self.db()
        occupation = conn.execute("SELECT occupation FROM occupations WHERE soc_code=?", (soc_code,)).fetchone()
        where = "soc_code=?"
        params: tuple[object, ...] = (soc_code,)
        if category_filter:
            where += " AND requirement=?"
            params += (category_filter,)
        if estimate_category:
            where += " AND category=?"
            params += (estimate_category,)
        total = conn.execute(f"SELECT COUNT(*) FROM observations WHERE {where}", params).fetchone()[0]
        rows = conn.execute(f"SELECT series_id, series_title, soc_code, occupation, requirement, estimate_code, estimate_text, category_code, category, additive_code, additive, datatype_code, datatype, estimate_raw, standard_error_raw, footnote_raw, source_sheet, source_row FROM observations WHERE {where} ORDER BY requirement, category, estimate_code LIMIT ? OFFSET ?", (*params, limit, offset)).fetchall()
        codes = sorted({code.strip() for row in rows for code in row["footnote_raw"].split(",") if code.strip()})
        footnotes: dict[str, str] = {}
        if codes:
            placeholders = ",".join("?" for _ in codes)
            footnotes = {row["code"]: row["text"] for row in conn.execute(f"SELECT code, text FROM footnotes WHERE code IN ({placeholders})", codes).fetchall()}
        conn.close()
        if occupation is None:
            self.send_json({"error": {"code": "occupation_not_found", "message": f"No ORS 2023 classification {soc_code} is present."}}, 404)
        else:
            items = []
            for row in rows:
                item = dict(row)
                item["footnotes"] = [{"code": code, "text": footnotes.get(code)} for code in item["footnote_raw"].split(",") if code]
                items.append(item)
            self.send_json({"occupation": occupation[0], "soc_code": soc_code, "reference_year": 2023, "items": items, "total": total, "limit": limit, "offset": offset, "provenance": {"workbook": "ors-2023.xlsx", "sheet": "ORS 2023 dataset", "source": "https://www.bls.gov/ors/data.htm"}})

    def send_json(self, value: object, status: int = 200) -> None:
        payload = json.dumps(value, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(payload)

    def log_message(self, fmt: str, *args: object) -> None:
        print("%s - %s" % (self.address_string(), fmt % args))


if __name__ == "__main__":
    port = int(__import__("os").environ.get("PORT", "8000"))
    print(f"Job Risk Atlas: http://localhost:{port}")
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
