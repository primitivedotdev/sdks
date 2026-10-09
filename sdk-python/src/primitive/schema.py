from __future__ import annotations

import json
from importlib.resources import files
from typing import Any


def _load_schema(name: str) -> dict[str, Any]:
    schema_path = files("primitive").joinpath(f"schemas/{name}")
    with schema_path.open("r", encoding="utf-8") as schema_file:
        return json.load(schema_file)


email_received_event_json_schema: dict[str, Any] = _load_schema(
    "email_received_event.schema.json"
)
sent_email_event_json_schema: dict[str, Any] = _load_schema(
    "sent_email_event.schema.json"
)
