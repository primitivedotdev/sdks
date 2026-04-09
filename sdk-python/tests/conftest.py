from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any

import pytest

ROOT = Path(__file__).resolve().parents[2]
SHARED_FIXTURES = ROOT / "test-fixtures"


@pytest.fixture
def valid_payload() -> dict[str, Any]:
    payload = json.loads(
        (SHARED_FIXTURES / "webhook" / "valid-email-received.json").read_text()
    )
    return deepcopy(payload)
