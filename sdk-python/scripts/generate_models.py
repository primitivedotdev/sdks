from __future__ import annotations

import importlib.util
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = ROOT / "src" / "primitive_sdk" / "schemas" / "email_received_event.schema.json"
OUTPUT = ROOT / "src" / "primitive_sdk" / "models_generated.py"


def _run_ruff(*args: str) -> None:
    preferred = [sys.executable, "-m", "ruff", *args]
    if importlib.util.find_spec("ruff") is not None:
        subprocess.run(preferred, check=True)
        return

    fallback_env = os.environ.copy()
    fallback_env["PATH"] = ":".join(
        entry
        for entry in fallback_env.get("PATH", "").split(":")
        if entry and Path(entry) != ROOT / ".venv" / "bin"
    )
    subprocess.run(["ruff", *args], check=True, env=fallback_env)
def main() -> None:
    subprocess.run(
        [
            sys.executable,
            "-m",
            "datamodel_code_generator",
            "--input",
            str(SCHEMA),
            "--input-file-type",
            "jsonschema",
            "--output",
            str(OUTPUT),
            "--output-model-type",
            "pydantic_v2.BaseModel",
            "--snake-case-field",
            "--field-constraints",
            "--target-python-version",
            "3.11",
            "--disable-timestamp",
            "--use-annotated",
            "--use-union-operator",
            "--reuse-model",
            "--allow-extra-fields",
        ],
        check=True,
    )
    _run_ruff("check", "--fix", str(OUTPUT))
    _run_ruff("format", str(OUTPUT))


if __name__ == "__main__":
    main()
