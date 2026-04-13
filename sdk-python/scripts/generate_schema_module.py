from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "src" / "primitive" / "schemas" / "email_received_event.schema.json"


def _source_path() -> Path:
    repo_source = ROOT.parent / "json-schema" / "email-received-event.schema.json"
    if repo_source.exists():
        return repo_source
    packaged_source = ROOT / "json-schema" / "email-received-event.schema.json"
    if packaged_source.exists():
        return packaged_source
    raise FileNotFoundError("Could not locate email-received-event.schema.json")


def main() -> None:
    DEST.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(_source_path(), DEST)


if __name__ == "__main__":
    main()
