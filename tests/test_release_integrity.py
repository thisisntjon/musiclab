"""Release integrity checks; no publication or approval inference."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("make_release", ROOT / "release/make_release.py")
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


class ReleaseIntegrity(unittest.TestCase):
    def test_private_review_attribution_removed_without_changing_code(self):
        self.assertEqual(release.rewrite("// phase 13.8 addition, 2026-11-01\nconst x = 1;"),
                         "// phase 13.8 addition, 2026-11-01\nconst x = 1;")

    def test_actual_bank_matches_admitted_identity(self):
        self.assertEqual(len(release.validate_sound_bank(ROOT)), 64)

    def test_changed_bank_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            caps = root / "static/js/theory/sampled_sound_capabilities.js"
            bank = root / "static/vendor/sampled-piano/GeneralUser-GS-2.0.3.sf2"
            caps.parent.mkdir(parents=True)
            bank.parent.mkdir(parents=True)
            caps.write_text("sha256:'" + hashlib.sha256(b"original").hexdigest() + "'", encoding="utf-8")
            bank.write_bytes(b"changed")
            with self.assertRaisesRegex(ValueError, "differs"):
                release.validate_sound_bank(root)

    def test_manifest_is_final_byte_inventory_and_not_release_approval(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "a.js").write_bytes(b"final rewritten bytes")
            (root / "nested").mkdir()
            (root / "nested/MANIFEST.json").write_bytes(b"nested asset")
            release.write_manifest(root)
            data = json.loads((root / "MANIFEST.json").read_text(encoding="utf-8"))
            self.assertFalse(data["publication_approved"])
            self.assertEqual(data["files"], {"a.js": hashlib.sha256(b"final rewritten bytes").hexdigest(),
                "nested/MANIFEST.json": hashlib.sha256(b"nested asset").hexdigest()})
            release.write_manifest(root)
            self.assertEqual(data, json.loads((root / "MANIFEST.json").read_text(encoding="utf-8")))
            self.assertEqual(release.verify_manifest(root), 2)
            (root / "a.js").write_bytes(b"tampered")
            with self.assertRaisesRegex(ValueError, "changed"):
                release.verify_manifest(root)

    def test_manifest_rejects_missing_and_extra_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "app.js").write_bytes(b"app")
            release.write_manifest(root)
            (root / "extra.js").write_bytes(b"unexpected")
            with self.assertRaisesRegex(ValueError, "changed"):
                release.verify_manifest(root)
            (root / "extra.js").unlink()
            (root / "app.js").unlink()
            with self.assertRaisesRegex(ValueError, "changed"):
                release.verify_manifest(root)


if __name__ == "__main__":
    unittest.main()
