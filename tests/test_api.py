"""Automated tests for Job Risk Atlas REST API and static file serving."""
import json
import sqlite3
import unittest
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "data" / "processed" / "ors-2023.sqlite3"
PORT = 8080
BASE_URL = f"http://127.0.0.1:{PORT}"


@unittest.skipUnless(DB_PATH.exists(), "Processed ORS 2023 SQLite database is required.")
class TestJobRiskAtlasApi(unittest.TestCase):
    def get(self, path: str) -> tuple[int, dict, dict]:
        req = Request(f"{BASE_URL}{path}")
        try:
            with urlopen(req, timeout=5) as res:
                body = res.read().decode("utf-8")
                headers = dict(res.headers)
                return res.status, json.loads(body) if body else {}, headers
        except HTTPError as e:
            try:
                body = e.read().decode("utf-8")
                return e.code, json.loads(body) if body else {}, dict(e.headers)
            finally:
                e.close()

    def head(self, path: str) -> tuple[int, dict]:
        req = Request(f"{BASE_URL}{path}", method="HEAD")
        try:
            with urlopen(req, timeout=5) as res:
                return res.status, dict(res.headers)
        except HTTPError as e:
            return e.code, dict(e.headers)

    def test_health(self):
        status, data, _ = self.get("/api/v1/health")
        self.assertEqual(status, 200)
        self.assertEqual(data.get("status"), "ok")
        self.assertTrue(data.get("ors_2023_ready"))
        self.assertFalse(data.get("cfoi_2024_ready"))

    def test_coverage(self):
        status, data, _ = self.get("/api/v1/coverage")
        self.assertEqual(status, 200)
        ors = data["datasets"]["ors_2023"]
        self.assertEqual(ors["status"], "processed")
        self.assertEqual(ors["observations"], 128398)
        self.assertEqual(ors["occupations"], 500)
        self.assertEqual(data["datasets"]["cfoi_2024"]["status"], "not_acquired")

    def test_metadata(self):
        status, data, _ = self.get("/api/v1/metadata")
        self.assertEqual(status, 200)
        self.assertEqual(data.get("processing_status"), "ors_2023_only")
        datasets = {d["id"]: d for d in data.get("datasets", [])}
        self.assertIn("ors-2023", datasets)
        self.assertEqual(datasets["ors-2023"]["status"], "processed")

    def test_validation(self):
        status, data, _ = self.get("/api/v1/validation")
        self.assertEqual(status, 200)
        self.assertEqual(data.get("dataset"), "ors-2023")
        self.assertEqual(data.get("observations"), 128398)
        self.assertEqual(data.get("occupation_code_title_pairs"), 500)

    def test_occupation_search_by_title(self):
        status, data, _ = self.get("/api/v1/occupations?q=nurse&limit=5")
        self.assertEqual(status, 200)
        self.assertGreater(data.get("total", 0), 0)
        items = data.get("items", [])
        self.assertTrue(any("nurse" in item["occupation"].lower() for item in items))

    def test_occupation_search_with_and_without_hyphen(self):
        # Searching 47-2061 vs 472061 (Construction laborers)
        status1, data1, _ = self.get("/api/v1/occupations?q=47-2061")
        status2, data2, _ = self.get("/api/v1/occupations?q=472061")
        self.assertEqual(status1, 200)
        self.assertEqual(status2, 200)
        self.assertEqual(data1["total"], data2["total"])
        self.assertEqual(data1["items"][0]["soc_code"], "472061")
        self.assertEqual(data2["items"][0]["soc_code"], "472061")

    def test_occupation_detail_with_and_without_hyphen(self):
        status1, data1, _ = self.get("/api/v1/occupations/291141")
        status2, data2, _ = self.get("/api/v1/occupations/29-1141")
        self.assertEqual(status1, 200)
        self.assertEqual(status2, 200)
        self.assertEqual(data1["occupation"], "Registered nurses")
        self.assertEqual(data2["occupation"], "Registered nurses")

    def test_occupation_requirements(self):
        status, data, _ = self.get("/api/v1/occupations/291141/requirements?limit=5")
        self.assertEqual(status, 200)
        self.assertEqual(data["soc_code"], "291141")
        self.assertGreater(data["total"], 0)
        self.assertEqual(len(data["items"]), 5)
        # Check source provenance
        self.assertEqual(data["provenance"]["workbook"], "ors-2023.xlsx")

    def test_series_lookup_short_and_padded(self):
        status1, data1, _ = self.get("/api/v1/series/00139?limit=2")
        status2, data2, _ = self.get("/api/v1/series/139?limit=2")
        self.assertEqual(status1, 200)
        self.assertEqual(status2, 200)
        self.assertEqual(data1["estimate_code"], "00139")
        self.assertEqual(data2["estimate_code"], "00139")

    def test_strength_matrix(self):
        status, data, _ = self.get("/api/v1/strength?limit=5")
        self.assertEqual(status, 200)
        self.assertEqual(len(data["categories"]), 5)
        self.assertIn("sedentary", data["categories"][0].lower())
        self.assertEqual(len(data["items"]), 5)

    def test_cfoi_unavailable_endpoints(self):
        for path in ("/api/v1/events", "/api/v1/relationships", "/api/v1/trends", "/api/v1/occupations/291141/fatal-injuries"):
            status, data, _ = self.get(path)
            self.assertEqual(status, 503)
            self.assertEqual(data.get("error", {}).get("code"), "dataset_unavailable")

    def test_do_head_support(self):
        status, headers = self.head("/api/v1/health")
        self.assertEqual(status, 200)
        self.assertIn("content-length", [k.lower() for k in headers.keys()])

    def test_pagination_validation(self):
        status, data, _ = self.get("/api/v1/occupations?limit=invalid")
        self.assertEqual(status, 400)
        self.assertEqual(data.get("error", {}).get("code"), "invalid_pagination")


if __name__ == "__main__":
    unittest.main()
