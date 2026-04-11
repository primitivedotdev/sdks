from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / "json-schema" / "email-received-event.schema.json"
DEST = ROOT / "src" / "primitive_sdk" / "schemas" / "email_received_event.schema.json"


def main() -> None:
    DEST.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(SOURCE, DEST)


if __name__ == "__main__":
    main()
