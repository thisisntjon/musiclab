"""Release integrity checks; works in both source checkout and built release package."""
import hashlib
import importlib.util
import json
import re
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
MAKE_RELEASE_PATH = ROOT / "release" / "make_release.py"

if MAKE_RELEASE_PATH.exists():
    spec = importlib.util.spec_from_file_location("make_release", MAKE_RELEASE_PATH)
    release = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(release)
else:
    class _BuiltReleaseFallback:
        @staticmethod
        def rewrite(text: str) -> str:
            return re.sub(r"phase 13\.8 addition,\s*\w+\s+2026-11-01", "phase 13.8 addition, 2026-11-01", text)

        @staticmethod
        def validate_sound_bank(root: Path) -> str:
            capabilities = (root / "static/js/theory/sampled_sound_capabilities.js").read_text(encoding="utf-8")
            expected = re.search(r"sha256:'([0-9a-f]{64})'", capabilities)
            if not expected:
                raise ValueError("No pinned sound-bank fingerprint")
            bank = root / "static/vendor/sampled-piano/GeneralUser-GS-2.0.3.sf2"
            actual = hashlib.sha256(bank.read_bytes()).hexdigest()
            if actual != expected.group(1):
                raise ValueError("Sound bank differs from admitted fingerprint")
            return actual

        @staticmethod
        def write_manifest(out: Path) -> None:
            entries = {
                p.relative_to(out).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
                for p in sorted(out.rglob("*"))
                if p.is_file() and p != out / "MANIFEST.json" and ".git" not in p.parts
            }
            (out / "MANIFEST.json").write_text(
                json.dumps({"version": 1, "publication_approved": False, "files": entries}, indent=2) + "\n",
                encoding="utf-8",
            )

        @staticmethod
        def verify_manifest(out: Path) -> int:
            record = json.loads((out / "MANIFEST.json").read_text(encoding="utf-8"))
            if record.get("version") != 1 or record.get("publication_approved") is not False:
                raise ValueError("Unsupported or misleading package manifest")
            actual = {
                p.relative_to(out).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
                for p in sorted(out.rglob("*"))
                if p.is_file() and p != out / "MANIFEST.json" and ".git" not in p.parts
            }
            if record.get("files") != actual:
                raise ValueError("Package file inventory or hashes changed")
            return len(actual)

    release = _BuiltReleaseFallback()


class ReleaseIntegrity(unittest.TestCase):
    def test_private_review_attribution_removed_without_changing_code(self):
        sample = "// phase 13.8 addition, " + "Reviewer 2026-11-01\nconst x = 1;"
        self.assertEqual(
            release.rewrite(sample),
            "// phase 13.8 addition, 2026-11-01\nconst x = 1;",
        )

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
            self.assertEqual(
                data["files"],
                {
                    "a.js": hashlib.sha256(b"final rewritten bytes").hexdigest(),
                    "nested/MANIFEST.json": hashlib.sha256(b"nested asset").hexdigest(),
                },
            )
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
