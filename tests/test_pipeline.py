"""Automated tests for scientific pipeline and data integrity."""
import json
import sqlite3
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
DB_PATH = DATA / "processed" / "ors-2023.sqlite3"
VALIDATION_PATH = DATA / "processed" / "ors-2023-validation.json"


@unittest.skipUnless(DB_PATH.exists(), "Processed ORS 2023 SQLite database is required.")
class TestScientificDataIntegrity(unittest.TestCase):
    def setUp(self):
        self.conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
        self.conn.row_factory = sqlite3.Row

    def tearDown(self):
        self.conn.close()

    def test_record_counts(self):
        obs_count = self.conn.execute("SELECT COUNT(*) FROM observations").fetchone()[0]
        occ_count = self.conn.execute("SELECT COUNT(*) FROM occupations").fetchone()[0]
        self.assertEqual(obs_count, 128398, "Official BLS ORS 2023 final wave must contain exactly 128,398 observations.")
        self.assertEqual(occ_count, 500, "Official BLS ORS 2023 must contain 500 unique occupations.")

    def test_raw_estimates_preserved_as_text(self):
        # Estimates must never be converted to 0 or arbitrary floats; text markers like '<0.5', '>99.5', '-' must be preserved
        markers = self.conn.execute(
            "SELECT DISTINCT estimate_raw FROM observations WHERE estimate_raw IN ('<0.5', '>99.5', '<15', '>90', '-') ORDER BY estimate_raw"
        ).fetchall()
        found = {row[0] for row in markers}
        self.assertTrue({"<0.5", ">99.5"}.issubset(found), "Suppressed/threshold string markers must be preserved.")

    def test_no_null_critical_fields(self):
        null_soc = self.conn.execute("SELECT COUNT(*) FROM observations WHERE soc_code IS NULL OR soc_code = ''").fetchone()[0]
        null_est = self.conn.execute("SELECT COUNT(*) FROM observations WHERE estimate_raw IS NULL").fetchone()[0]
        null_req = self.conn.execute("SELECT COUNT(*) FROM observations WHERE requirement IS NULL").fetchone()[0]
        self.assertEqual(null_soc, 0, "All observations must have a valid SOC code.")
        self.assertEqual(null_est, 0, "All observations must have an estimate string (even if suppressed or marker).")
        self.assertEqual(null_req, 0, "All observations must belong to a requirement domain.")

    def test_strength_categories_coverage(self):
        categories = self.conn.execute(
            "SELECT DISTINCT estimate_text FROM observations WHERE requirement='Physical demands' AND category='Strength'"
        ).fetchall()
        names = {row[0].lower() for row in categories}
        expected = {"sedentary", "light work", "medium work", "heavy work", "very heavy work"}
        matched = {exp for exp in expected if any(exp in name for name in names)}
        self.assertEqual(matched, expected, "All 5 official BLS strength categories must be present in the database.")

    def test_footnotes_table(self):
        count = self.conn.execute("SELECT COUNT(*) FROM footnotes").fetchone()[0]
        self.assertGreater(count, 0, "Footnotes lookup table must be populated.")
        # Footnote 36 is commonly used for '>99.5 percent'
        row = self.conn.execute("SELECT text FROM footnotes WHERE code='36'").fetchone()
        self.assertIsNotNone(row)
        self.assertIn("greater than 99.5 percent", row[0].lower())

    def test_validation_report_file(self):
        self.assertTrue(VALIDATION_PATH.exists(), "Validation JSON report must exist.")
        data = json.loads(VALIDATION_PATH.read_text())
        self.assertEqual(data.get("dataset"), "ors-2023")
        self.assertEqual(data.get("status"), "valid")
        self.assertEqual(data.get("observations"), 128398)
        self.assertTrue(data.get("raw_estimates_preserved_as_text"))


if __name__ == "__main__":
    unittest.main()
