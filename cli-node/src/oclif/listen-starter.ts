import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const ACCEPT_EVENT_PY = `"""Commit an event before the CLI acknowledges it. No SDK or network required."""
import json
import os
from pathlib import Path
import sqlite3
import sys
import uuid

INBOX = Path(__file__).resolve().parent / ".primitive-inbox"


def open_inbox():
    os.umask(0o077)
    INBOX.mkdir(mode=0o700, exist_ok=True)
    if INBOX.is_symlink() or not INBOX.is_dir():
        raise ValueError("Inbox must be a private directory")
    INBOX.chmod(0o700)
    path = INBOX / "events.sqlite3"
    fd = os.open(path, os.O_CREAT | os.O_RDWR | getattr(os, "O_NOFOLLOW", 0), 0o600)
    os.fchmod(fd, 0o600)
    os.close(fd)
    db = sqlite3.connect(path, timeout=5)
    db.execute("PRAGMA synchronous=FULL")
    db.execute("""CREATE TABLE IF NOT EXISTS events (
        event_id TEXT PRIMARY KEY, event_type TEXT NOT NULL,
        delivery_id TEXT NOT NULL, body BLOB NOT NULL,
        received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        processed_at TEXT
    )""")
    return db


def accept_event(event_id, event_type, delivery_id, body):
    # Replace this ONE function with your agent's existing durable inbox write.
    # Return only after commit; event_id is the stable deduplication key.
    db = open_inbox()
    try:
        with db:
            db.execute("INSERT INTO events(event_id,event_type,delivery_id,body) VALUES(?,?,?,?) ON CONFLICT(event_id) DO NOTHING",
                       (event_id, event_type, delivery_id, body))
    finally:
        db.close()


def main():
    event_id = str(uuid.UUID(os.environ["PRIMITIVE_EVENT_ID"]))
    delivery_id = str(uuid.UUID(os.environ["PRIMITIVE_DELIVERY_ID"]))
    event_type = os.environ["PRIMITIVE_EVENT_TYPE"]
    if not event_type:
        raise ValueError("Missing event type")
    body = sys.stdin.buffer.read()
    if not isinstance(json.loads(body), dict):
        raise ValueError("Expected an event object")
    accept_event(event_id, event_type, delivery_id, body)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        # Never print the body, API keys or arbitrary exception messages.
        print("Event was not durably accepted", file=sys.stderr)
        sys.exit(1)
`;

export const PROCESS_EVENTS_PY = `"""A separate, restartable example processor. Run one worker per inbox."""
import argparse
import fcntl
import json
import os
import time
from uuid import UUID
import primitive
from primitive.api.api.emails import get_conversation
from accept_event import INBOX, open_inbox


def create_client():
    # This independent Python process does not read the CLI's saved config.
    origin = os.environ.get("PRIMITIVE_API_BASE_URL")
    sending_origin = os.environ.get("PRIMITIVE_API_BASE_URL_2")
    options = {}
    if origin is not None:
        if not origin.strip() or (sending_origin is not None and not sending_origin.strip()):
            raise ValueError("API origins must not be empty")
        # Custom environments stay on that host for BOTH SDK clients unless
        # their operator explicitly provides a separate sending host.
        options = {"api_base_url_1": origin, "api_base_url_2": sending_origin or origin}
    elif sending_origin is not None:
        raise ValueError("Set PRIMITIVE_API_BASE_URL with a custom sending origin")
    return primitive.client(api_key=os.environ["PRIMITIVE_API_KEY"], **options)


def process_event(event_id, event_type, body, reply_text):
    event = primitive.parse_webhook_event(json.loads(body), event_type=event_type)
    if not primitive.is_email_received_event(event):
        # Payment, interaction and future events do not require email lookups.
        print(event_id, event_type, flush=True)
        return
    email = primitive.normalize_received_email(event)
    client = create_client()
    try:
        response = get_conversation.sync_detailed(UUID(email.id), client=client.api_client)
        if response.status_code != 200:
            raise RuntimeError("Conversation unavailable")
        # Pass response.parsed to your agent/model. Work may take >30 seconds.
        print(event_id, event_type, "conversation loaded", flush=True)
        if reply_text is not None:
            # Sending is explicitly opt-in. Stable keys prevent duplicate replies
            # if the process stops after sending but before marking this row done.
            client.reply(email, reply_text, idempotency_key="listener-reply-" + event_id)
    finally:
        client.api_client.get_httpx_client().close()
        client.api_send_client.get_httpx_client().close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--once", action="store_true", help="Process at most one pending event")
    parser.add_argument("--reply-text", help="Opt into sending this reply to each email")
    args = parser.parse_args()
    db = open_inbox()
    # Unix advisory lock prevents two processors from handling the same row.
    # The receiver never takes this lock and keeps accepting during long work.
    with open(INBOX / "processor.lock", "a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        try:
            while True:
                row = db.execute("SELECT event_id,event_type,body FROM events WHERE processed_at IS NULL ORDER BY received_at,event_id LIMIT 1").fetchone()
                if row:
                    process_event(*row, args.reply_text)
                    with db:
                        db.execute("UPDATE events SET processed_at=CURRENT_TIMESTAMP WHERE event_id=?", (row[0],))
                if args.once:
                    return
                if row is None:
                    time.sleep(1)
        finally:
            db.close()


if __name__ == "__main__":
    main()
`;

export function listenStarterFiles(): Record<string, string> {
  return {
    "accept_event.py": ACCEPT_EVENT_PY,
    "process_events.py": PROCESS_EVENTS_PY,
    "requirements.txt": "primitivedotdev\n",
    ".gitignore": ".primitive-inbox/\n.venv/\n.env\n.env.*\n__pycache__/\n",
    "README.md": `# Receive events locally

Python 3.10+; the optional processor uses a Unix advisory lock (macOS/Linux).

1. Configure the Primitive CLI with your API key using your usual login/config.
2. Start receiving (no Python dependencies needed for this hook):

    primitive listen --subscription my-agent --exec 'python3 accept_event.py'

The hook receives the full existing JSON body on stdin and the canonical event
type, stable occurrence UUID, and attempt UUID in PRIMITIVE_EVENT_TYPE,
PRIMITIVE_EVENT_ID, and PRIMITIVE_DELIVERY_ID. No webhook signature verification
headers are invented: delivery comes from the authenticated CLI connection.

Replace only accept_event() with your agent's existing durable inbox write.
Commit before returning, deduplicate by event_id, and raise on failure. Keep
model calls and other slow work outside this hook. Exit 0 acknowledges receipt.
The included SQLite example preserves the first body and delivery metadata for
each occurrence; later attempts do not overwrite it.

## Separate processing example

    python3 -m venv .venv
    . .venv/bin/activate
    pip install -r requirements.txt
    export PRIMITIVE_API_KEY='<your key>'
    python3 process_events.py

The worker uses the existing Python SDK to parse the canonical event type and
normalize email events, then get the conversation by email ID. Related events
are handled without email lookups. Replace process_event() with your agent work.
The independent Python worker does not read saved CLI configuration. For a custom
API environment, explicitly export PRIMITIVE_API_BASE_URL in its terminal. This
sets both its reading and sending API origins; PRIMITIVE_API_BASE_URL_2 can
override a separate sending origin. Without overrides it uses SDK defaults.
It runs independently of the CLI, so processing can exceed 30 seconds. --once
processes at most one row. A failure leaves the row pending and exits; fix the
cause and restart. A stopped worker resumes pending rows on its next run.

No mail is sent by default. --reply-text 'Your message' explicitly enables a
reply for every email processed. The SDK replies by the normalized email ID,
with a stable idempotency key. Other external effects also need idempotency:
restarting after an effect but before the local commit can repeat processing.

The app owns .primitive-inbox/events.sqlite3 (directory 0700, files 0600). It
contains private event bodies and must stay out of git. Completed rows remain
for your retention policy; back up or prune them according to your needs.
This is a starting application, not a CLI-managed queue or worker service.
`,
  };
}

export function writeListenStarter({ outDir }: { outDir: string }): void {
  // Atomic create refuses existing directories, including symlinks.
  mkdirSync(outDir, { recursive: false, mode: 0o700 });
  try {
    for (const [name, contents] of Object.entries(listenStarterFiles())) {
      writeFileSync(join(outDir, name), contents, { flag: "wx", mode: 0o600 });
    }
  } catch (error) {
    rmSync(outDir, { recursive: true, force: true });
    throw error;
  }
}
