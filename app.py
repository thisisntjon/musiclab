"""Local entrypoint for MusicLab Studio (http://127.0.0.1:8765)."""

from __future__ import annotations

import argparse
import json
import sys
import tempfile
import threading
from pathlib import Path
from urllib.request import Request, urlopen

from src.app_shell.server import create_studio_server


def run_smoke_test() -> int:
    """Start server on an ephemeral 127.0.0.1 port, verify UI, compilation, and WAV bounce, then exit."""
    with tempfile.TemporaryDirectory() as tmpdir:
        server = create_studio_server(host="127.0.0.1", port=0, workspace_dir=Path(tmpdir))
        port = server.server_address[1]
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base_url = f"http://127.0.0.1:{port}"
        try:
            with urlopen(f"{base_url}/") as resp:
                html = resp.read().decode("utf-8")
            assert "<title>MusicLab</title>" in html and 'id="play-flow"' in html

            with urlopen(f"{base_url}/api/songs/heavy_bass_110") as resp:
                data = json.loads(resp.read().decode("utf-8"))
                assert data["compiled"]["bpm"] == 110.0
                assert len(data["compiled"]["events"]) >= 35

            req = Request(
                f"{base_url}/api/render-wav",
                data=json.dumps({"song": data["song"]}).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urlopen(req) as resp:
                wav_res = json.loads(resp.read().decode("utf-8"))
                metrics = wav_res["metrics"]
                assert -6.0 <= metrics["peak_dbfs"] <= -3.0 + 0.01
                assert metrics["clipped_samples"] == 0

            print(
                json.dumps(
                    {
                        "smoke_test": "ok",
                        "url": base_url,
                        "events": len(data["compiled"]["events"]),
                        "wav_metrics": metrics,
                    }
                )
            )
            return 0
        finally:
            server.shutdown()
            server.server_close()


def main() -> int:
    parser = argparse.ArgumentParser(description="MusicLab local music studio")
    parser.add_argument("--host", default="127.0.0.1", help="Bind host (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8765, help="Bind port (default: 8765)")
    parser.add_argument("--smoke-test", action="store_true", help="Run automated smoke test and exit")
    args = parser.parse_args()

    if args.smoke_test:
        return run_smoke_test()
    if args.host not in ("127.0.0.1", "localhost"):
        parser.error("MusicLab is local only: --host must be 127.0.0.1 or localhost")

    server = create_studio_server(host=args.host, port=args.port)
    actual_port = server.server_address[1]
    print(f"MusicLab Studio running locally at http://{args.host}:{actual_port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
