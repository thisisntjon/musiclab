"""Open-release audit B1: the local server (python app.py, launch.cmd) sends the hosted script policy too.

A shared song file once put markup into the page. Escaping is the fix; this policy is the second wall, so that on a
local run no injected script runs either. The script-src directive must be exactly the hosted one
(hosting/musiclab-worker.mjs CSP_HEADER), with the two hashes of static/index.html worked out the way
hosting/stage-musiclab-cloudflare.mjs packageCsp does.
"""

from __future__ import annotations

import base64
import hashlib
import http.client
import re
import tempfile
import threading
import unittest
from pathlib import Path

from src.app_shell import create_studio_server

ROOT = Path(__file__).resolve().parent.parent


def hosted_directives() -> dict[str, str]:
    worker = (ROOT / "hosting" / "musiclab-worker.mjs").read_text(encoding="utf-8")
    block = re.search(r"export const CSP_HEADER = \[(.*?)\]\.join", worker, re.S).group(1)
    parts = [a or b for a, b in re.findall(r"""^\s*(?:"([^"]*)"|'([^']*)'),?\s*$""", block, re.M)]
    return {p.split(" ", 1)[0]: p for p in parts}


def page_hashes() -> list[str]:
    html = (ROOT / "static" / "index.html").read_text(encoding="utf-8")
    boot = re.search(r"<script\b[^>]*\bid=[\"']boot-check[\"'][^>]*>([\s\S]*?)</script>", html).group(1)
    handlers = list(dict.fromkeys(re.findall(r'\bon\w+="([^"]*)"', html)))
    sources = [boot.replace("\r\n", "\n").replace("\r", "\n"), *handlers]
    return ["'sha256-" + base64.b64encode(hashlib.sha256(s.encode("utf-8")).digest()).decode() + "'" for s in sources]


def directives(header: str) -> dict[str, str]:
    return {d.strip().split(" ", 1)[0]: d.strip() for d in header.split(";") if d.strip()}


class LocalContentSecurityPolicyTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.server = create_studio_server(host="127.0.0.1", port=0, workspace_dir=Path(self._tmp.name) / "ws")
        self.port = self.server.server_address[1]
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def tearDown(self) -> None:
        self.server.shutdown()
        self.server.server_close()
        self._tmp.cleanup()

    def _headers(self, path: str):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=30)
        try:
            conn.request("GET", path, headers={"Host": f"127.0.0.1:{self.port}"})
            resp = conn.getresponse()
            resp.read()
            return resp.status, resp
        finally:
            conn.close()

    def test_every_page_and_script_carries_the_hosted_script_policy(self) -> None:
        hosted = hosted_directives()
        expected_script = hosted["script-src"].replace("__MUSICLAB_SCRIPT_HASHES__", " ".join(page_hashes()))
        for path in ["/", "/index.html", "/static/index.html", "/static/parents.html", "/ui/app.js", "/static/ui/app.js"]:
            with self.subTest(path=path):
                status, resp = self._headers(path)
                self.assertEqual(status, 200)
                policy = resp.getheader("Content-Security-Policy")
                self.assertIsNotNone(policy, "the local server sends a policy")
                got = directives(policy)
                self.assertEqual(got["script-src"], expected_script, "script policy is the hosted one")
                self.assertNotIn("'unsafe-inline'", got["script-src"])
                for name in ["default-src", "object-src", "base-uri", "frame-ancestors", "connect-src", "worker-src", "form-action"]:
                    self.assertEqual(got.get(name), hosted[name], name)
                self.assertEqual(resp.getheader("X-Content-Type-Options"), "nosniff")
                self.assertEqual(resp.getheader("X-Frame-Options"), "DENY")
                self.assertEqual(resp.getheader("Referrer-Policy"), "no-referrer")

    def test_policy_hashes_cover_only_the_two_known_inline_pieces(self) -> None:
        # Control: the page has exactly one inline script and one inline handler, so two hashes.
        status, resp = self._headers("/")
        hashes = re.findall(r"'sha256-[^']+'", directives(resp.getheader("Content-Security-Policy"))["script-src"])
        self.assertEqual(hashes, page_hashes())
        self.assertEqual(len(hashes), 2)
        other = "'sha256-" + base64.b64encode(hashlib.sha256(b"document.title='XSS-RAN'").digest()).decode() + "'"
        self.assertNotIn(other, hashes)

    def test_plain_http_on_this_computer_is_not_upgraded(self) -> None:
        status, resp = self._headers("/")
        self.assertNotIn("upgrade-insecure-requests", resp.getheader("Content-Security-Policy"))
        self.assertIsNone(resp.getheader("Strict-Transport-Security"))


if __name__ == "__main__":
    unittest.main()
