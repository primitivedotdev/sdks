from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCHEMAS = {
    "email-received-event.schema.json": "email_received_event.schema.json",
    "sent-email-event.schema.json": "sent_email_event.schema.json",
}


def _source_path(name: str) -> Path:
    repo_source = ROOT.parent / "json-schema" / name
    if repo_source.exists():
        return repo_source
    packaged_source = ROOT / "json-schema" / name
    if packaged_source.exists():
        return packaged_source
    raise FileNotFoundError(f"Could not locate {name}")


def main() -> None:
    dest_dir = ROOT / "src" / "primitive" / "schemas"
    dest_dir.mkdir(parents=True, exist_ok=True)
    for source_name, dest_name in SCHEMAS.items():
        shutil.copyfile(_source_path(source_name), dest_dir / dest_name)


if __name__ == "__main__":
    main()
