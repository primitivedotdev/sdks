from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any

import pytest


def _shared_fixtures_root() -> Path:
    current = Path(__file__).resolve()
    candidates = (
        current.parents[2] / "test-fixtures",
        current.parents[1] / "test-fixtures",
    )
    for candidate in candidates:
        if candidate.exists():
            return candidate
    raise FileNotFoundError("Could not locate shared test-fixtures directory")


SHARED_FIXTURES = _shared_fixtures_root()


@pytest.fixture
def valid_payload() -> dict[str, Any]:
    payload = json.loads(
        (SHARED_FIXTURES / "webhook" / "valid-email-received.json").read_text()
    )
    return deepcopy(payload)
