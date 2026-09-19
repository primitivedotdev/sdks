#!/usr/bin/env python3
"""Local crash/retry proof. Never contacts an email service or sends real mail."""

import argparse
import base64
import hashlib
import json
import shutil
import sqlite3
import subprocess
import tarfile
import tempfile
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

ROOT = Path(__file__).resolve().parents[1]
NOW = 1800000000123
SCOPE = "account-one"


def command(args, cwd, timeout=600):
    completed = subprocess.run(
        args, cwd=cwd, capture_output=True, text=True, timeout=timeout
    )
    if completed.returncode:
        raise RuntimeError(f"{args!r}\n{completed.stdout}\n{completed.stderr}")
    return completed.stdout


def artifacts(output):
    """Install deployable artifacts outside the workspace and compile a Go consumer."""
    packs = output / "artifacts"
    packs.mkdir()
    command(
        ["npm", "pack", "--silent", "--pack-destination", str(packs)], ROOT / "sdk-node"
    )
    wheels = list((ROOT / "sdk-python/dist").glob("*.whl"))
    assert len(wheels) == 1, "build exactly one current Python wheel first"
    wheel = Path(shutil.copy(wheels[0], packs))
    node = output / "node"
    node.mkdir()
    (node / "package.json").write_text('{"private":true,"type":"module"}')
    command(
        [
            "npm",
            "install",
            "--ignore-scripts",
            "--no-audit",
            "--no-fund",
            str(next(packs.glob("*.tgz"))),
        ],
        node,
    )
    shutil.copy(ROOT / "scripts/signal-retry/node.mjs", node / "caller.mjs")
    environment = output / "python"
    command(["uv", "venv", str(environment)], output)
    python = environment / "bin/python"
    command(["uv", "pip", "install", "--python", str(python), str(wheel)], output)
    shutil.copy(ROOT / "scripts/signal-retry/caller.py", output / "caller.py")
    # Go distributes source modules. Archive tracked module files, then consume
    # that snapshot from a separate module without workspace imports or symlinks.
    archive = packs / "sdk-go.tar.gz"
    paths = command(["git", "ls-files", "sdk-go"], ROOT).splitlines()
    with tarfile.open(archive, "w:gz") as stream:
        for path in paths:
            stream.add(ROOT / path, arcname=path, recursive=False)
    with tarfile.open(archive) as stream:
        stream.extractall(output, filter="data")
    go = output / "go"
    go.mkdir()
    shutil.copy(ROOT / "scripts/signal-retry/caller.go", go / "main.go")
    (go / "go.mod").write_text(
        "module example.test/signal-retry\n\ngo 1.25.0\n\n"
        "require github.com/primitivedotdev/sdks/sdk-go v0.0.0\n"
        "replace github.com/primitivedotdev/sdks/sdk-go => ../sdk-go\n"
    )
    command(["go", "mod", "tidy"], go)
    command(["go", "build", "-o", str(go / "caller"), "."], go)
    return {
        "node": ["node", str(node / "caller.mjs")],
        "python": [str(python), "-I", str(output / "caller.py")],
        "go": [str(go / "caller")],
    }


class LocalMail:
    """A durable dedup MODEL, not evidence about a deployed service's behavior."""

    def __init__(self, path, withhold):
        self.path, self.withhold = path, withhold
        self.release = threading.Event()
        self.errors = []
        with sqlite3.connect(path) as db:
            db.execute("PRAGMA synchronous=FULL")
            db.execute(
                "CREATE TABLE IF NOT EXISTS accepted (key TEXT PRIMARY KEY, body BLOB, id TEXT)"
            )
            db.execute(
                "CREATE TABLE IF NOT EXISTS attempts (key TEXT, body BLOB, path TEXT)"
            )
        model = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *_args):
                pass

            def do_POST(self):
                try:
                    assert self.path == "/v1/send-mail"
                    size = int(self.headers["Content-Length"])
                    assert 0 < size < 65536
                    raw = self.rfile.read(size)
                    assert len(raw) == size
                    body = json.loads(raw)
                    key = self.headers["Idempotency-Key"]
                    assert key
                    with sqlite3.connect(path) as db:
                        db.execute("PRAGMA synchronous=FULL")
                        previous = db.execute(
                            "SELECT body,id FROM accepted WHERE key=?", (key,)
                        ).fetchone()
                        if previous:
                            assert previous[0] == raw, (
                                "same key changed serialized request bytes"
                            )
                        identifier = str(uuid5(NAMESPACE_URL, key))
                        db.execute(
                            "INSERT OR IGNORE INTO accepted VALUES (?,?,?)",
                            (key, raw, identifier),
                        )
                        db.execute(
                            "INSERT INTO attempts VALUES (?,?,?)", (key, raw, self.path)
                        )
                    # Acceptance is durably committed, but no response headers or
                    # bytes have reached the caller. The harness kills that process.
                    if model.withhold:
                        model.release.wait(30)
                        self.close_connection = True
                        return
                    response = json.dumps(
                        {
                            "success": True,
                            "data": {
                                "id": identifier,
                                "status": "submitted_to_agent",
                                "from": body["from"],
                                "queue_id": None,
                                "accepted": [body["to"]],
                                "rejected": [],
                                "client_idempotency_key": key,
                                "request_id": "local-fixture",
                                "content_hash": hashlib.sha256(raw).hexdigest(),
                                "idempotent_replay": previous is not None,
                            },
                        }
                    ).encode()
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.send_header("Content-Length", str(len(response)))
                    self.end_headers()
                    self.wfile.write(response)
                except Exception as error:
                    model.errors.append(repr(error))
                    self.close_connection = True

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.url = f"http://127.0.0.1:{self.server.server_port}/v1"

    def close(self):
        self.release.set()
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=5)
        assert not self.errors, self.errors

    def rows(self, table):
        assert table in {"attempts", "accepted"}
        with sqlite3.connect(self.path) as db:
            return db.execute(f"SELECT * FROM {table}").fetchall()


def saved(record):
    raw = json.loads(record.read_text())
    return {
        "request": raw.get("requestJson", raw.get("request_json")),
        "key": raw.get("idempotencyKey", raw.get("idempotency_key")),
        "expires": raw.get("expiresAtMs", raw.get("expires_at_ms")),
    }


def verify_request(model, record, kind):
    prepared = saved(record)
    expected = json.loads(prepared["request"])
    attempts = model.rows("attempts")
    assert len(model.rows("accepted")) == 1
    assert len({(row[0], row[1]) for row in attempts}) == 1
    for key, raw, path in attempts:
        assert key == prepared["key"] and path == "/v1/send-mail"
        request = json.loads(raw)
        assert request == expected
        assert request["from"] == "agent@example.test"
        assert request["to"] == "owner@example.test"
        assert request["subject"] == "Research café"
        assert request["in_reply_to"] == "<parent@example.test>"
        assert request["references"] == [
            "<ancestor@example.test>",
            "<parent@example.test>",
        ]
        actual_part = base64.b64decode(
            request["attachments"][0]["content_base64"], validate=True
        )
        expected_part = base64.b64decode(
            expected["attachments"][0]["content_base64"], validate=True
        )
        assert actual_part == expected_part
        envelope = json.loads(actual_part)
        assert envelope["interaction_version"] == envelope["protocol_version"] == 1
        assert envelope["protocol"] == envelope["step"] == kind
        assert envelope["prev_step_id"] is None
        assert prepared["key"] == "signal-" + envelope["step_id"]
        assert envelope["payload"]["subject_message_id"] == "<parent@example.test>"
        if kind == "ack":
            assert envelope["payload"]["status"] == "received"
        if kind == "typing":
            assert request["body_text"] == "I am composing a reply to your message."
            assert envelope["payload"] == {"subject_message_id": "<parent@example.test>"}
        if kind in ("working", "typing"):
            assert prepared["expires"] == NOW + 60000
            expected_expiry = (
                datetime.fromtimestamp(prepared["expires"] / 1000, timezone.utc)
                .isoformat(timespec="milliseconds")
                .replace("+00:00", "Z")
            )
            assert envelope["expires_at"] == expected_expiry
        else:
            assert prepared["expires"] is None and envelope["expires_at"] is None
    return hashlib.sha256(attempts[0][1]).hexdigest()


def scenario(caller, directory, kind, expired_first=False, expired_unknown=False):
    directory.mkdir()
    record = directory / "prepared.json"
    model = LocalMail(directory / "server.sqlite", withhold=True)
    process = None

    def args(mode, clock=NOW, scope=SCOPE):
        return [*caller, mode, str(record), model.url, str(clock), scope, kind]

    def send(clock=NOW, scope=SCOPE):
        return json.loads(command(args("send", clock, scope), directory, timeout=20))

    try:
        command(args("prepare"), directory, timeout=20)
        original = record.read_bytes()
        if expired_first:
            assert send(NOW + 60000) == {
                "status": "expired",
                "idempotencyKey": saved(record)["key"],
            }
            assert not model.rows("attempts") and not model.rows("accepted")
            assert record.read_bytes() == original
            return {
                "case": f"{kind} expired before first attempt",
                "attempts": 0,
                "accepted": 0,
            }
        process = subprocess.Popen(
            args("send"), cwd=directory, stdout=subprocess.PIPE, stderr=subprocess.PIPE
        )
        deadline = time.monotonic() + 15
        while not model.rows("accepted"):
            assert process.poll() is None, process.communicate()
            assert time.monotonic() < deadline, (
                "caller never reached local send endpoint"
            )
            time.sleep(0.02)
        assert process.poll() is None, "caller returned before response was released"
        process.kill()
        stdout, stderr = process.communicate(timeout=5)
        assert process.returncode < 0 and stdout == b"", (stdout, stderr)
        first_pid = process.pid
        model.close()
        # New server instance recovers acceptance from SQLite. No in-memory
        # response/dedup state is shared with the first server or killed caller.
        model = LocalMail(directory / "server.sqlite", withhold=False)
        mismatch = subprocess.run(
            args("send", scope="account-two"),
            cwd=directory,
            capture_output=True,
            timeout=20,
        )
        assert mismatch.returncode != 0 and b"account scope mismatch" in mismatch.stderr
        assert len(model.rows("attempts")) == 1, "scope mismatch reached transport"
        if expired_unknown:
            assert send(NOW + 60000) == {
                "status": "expired",
                "idempotencyKey": saved(record)["key"],
            }
            assert len(model.rows("attempts")) == 1 and len(model.rows("accepted")) == 1
            assert record.read_bytes() == original
            return {
                "case": f"{kind} expired after unknown acceptance",
                "killed_pid": first_pid,
                "attempts": 1,
                "accepted": 1,
                "wire_sha256": verify_request(model, record, kind),
            }
        retries = [send(NOW + 1), send(NOW + 2)]
        for response in retries:
            assert response["status"] == "response"
            assert response["result"]["success"] is True
            assert response["result"]["data"]["idempotent_replay"] is True
        assert retries[0]["result"]["data"]["id"] == retries[1]["result"]["data"]["id"]
        assert retries[0]["result"]["data"]["id"] == model.rows("accepted")[0][2]
        assert len(model.rows("attempts")) == 3
        wire_hash = verify_request(model, record, kind)
        if kind in ("working", "typing"):
            assert send(NOW + 60000) == {
                "status": "expired",
                "idempotencyKey": saved(record)["key"],
            }
            assert len(model.rows("attempts")) == 3
        assert record.read_bytes() == original, "caller mutated durable preparation"
        return {
            "case": kind,
            "killed_pid": first_pid,
            "attempts": 3,
            "accepted": 1,
            "wire_sha256": wire_hash,
        }
    finally:
        if process is not None and process.poll() is None:
            process.kill()
            process.communicate(timeout=5)
        model.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        type=Path,
        help="new directory for artifacts, SQLite evidence and summary",
    )
    options = parser.parse_args()
    output = (
        options.output.resolve()
        if options.output
        else Path(tempfile.mkdtemp(prefix="signal-retry-"))
    )
    if options.output:
        output.mkdir()
    print(f"Local evidence: {output}", flush=True)
    callers = artifacts(output)
    results = []
    for language, caller in callers.items():
        for kind, expiration in [
            ("ack", ""),
            ("read", ""),
            ("working", ""),
            ("working", "first"),
            ("working", "unknown"),
            ("typing", ""),
            ("typing", "first"),
            ("typing", "unknown"),
        ]:
            label = kind + (f"-expired-{expiration}" if expiration else "")
            result = scenario(
                caller,
                output / f"{language}-{label}",
                kind,
                expiration == "first",
                expiration == "unknown",
            )
            results.append({"language": language, **result})
            print(f"PASS {language}: {result['case']}", flush=True)
    summary = {
        "source_commit": command(["git", "rev-parse", "HEAD"], ROOT).strip(),
        "scope": "Local durable dedup model only; no production dedup, SMTP delivery or receiver behavior proven.",
        "artifacts": {
            path.name: hashlib.sha256(path.read_bytes()).hexdigest()
            for path in (output / "artifacts").iterdir()
        },
        "results": results,
    }
    (output / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    print(
        f"Passed {len(results)} scenarios. Evidence: {output / 'summary.json'}",
        flush=True,
    )


if __name__ == "__main__":
    main()
