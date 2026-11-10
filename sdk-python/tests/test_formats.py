"""The schema's date-time and uri checks match the Node SDK's validator."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import pytest
from jsonschema import Draft7Validator

from primitive._formats import (
    DATE_TIME_PATTERN,
    URI_PATTERN,
    is_date_time,
    is_uri,
    webhook_format_checker,
)


def _repo_root() -> Path:
    current = Path(__file__).resolve()
    for candidate in (current.parents[2], current.parents[1]):
        if (candidate / "test-fixtures").exists():
            return candidate
    raise FileNotFoundError("Could not locate shared test-fixtures directory")


REPO_ROOT = _repo_root()
CASES: dict[str, Any] = json.loads(
    (REPO_ROOT / "test-fixtures" / "formats" / "cases.json").read_text()
)
CHECKS = {"date-time": is_date_time, "uri": is_uri}


def _node_regex(name: str) -> tuple[str, str]:
    path = REPO_ROOT / "sdk-node" / "scripts" / "validator-ajv.ts"
    if not path.exists():
        pytest.skip("the Node SDK sources are not in this checkout")
    source = path.read_text()
    match = re.search(rf"const {name} =\s*/(.+)/([a-z]*);\n", source)
    assert match, f"{name} not found in validator-ajv.ts"
    return match.group(1), match.group(2)


@pytest.mark.parametrize(
    ("name", "pattern", "flags"),
    [("DATE_TIME_RE", DATE_TIME_PATTERN, ""), ("URI_RE", URI_PATTERN, "i")],
)
def test_patterns_are_the_node_validator_patterns(
    name: str, pattern: str, flags: str
) -> None:
    assert _node_regex(name) == (pattern, flags)


@pytest.mark.parametrize(
    ("format_name", "value", "valid"),
    [
        (format_name, case["value"], case["valid"])
        for format_name in CHECKS
        for case in CASES[format_name]
    ],
)
def test_shared_format_cases(format_name: str, value: str, valid: bool) -> None:
    assert CHECKS[format_name](value) is valid

    schema = {"type": "string", "format": format_name}
    validator = Draft7Validator(schema, format_checker=webhook_format_checker())
    assert validator.is_valid(value) is valid


def test_format_checks_leave_other_types_to_the_type_keyword() -> None:
    validator = Draft7Validator(
        {"format": "date-time"}, format_checker=webhook_format_checker()
    )
    assert validator.is_valid(3)
