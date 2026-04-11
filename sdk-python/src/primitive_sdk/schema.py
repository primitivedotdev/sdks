from __future__ import annotations

import json
from importlib.resources import files
from typing import Any


def _load_schema() -> dict[str, Any]:
    schema_path = files("primitive_sdk").joinpath(
        "schemas/email_received_event.schema.json"
    )
    with schema_path.open("r", encoding="utf-8") as schema_file:
        return json.load(schema_file)


email_received_event_json_schema: dict[str, Any] = _load_schema()
