from __future__ import annotations

import importlib.util
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = ROOT / "src" / "primitive_sdk" / "schemas" / "email_received_event.schema.json"
OUTPUT = ROOT / "src" / "primitive_sdk" / "models_generated.py"


def _should_fall_back_to_system_ruff(result: subprocess.CompletedProcess[str]) -> bool:
    stderr = result.stderr or ""
    return result.returncode == 127 or "No module named ruff" in stderr


def _run_ruff(*args: str) -> None:
    preferred = [sys.executable, "-m", "ruff", *args]
    if importlib.util.find_spec("ruff") is not None:
        result = subprocess.run(preferred, check=False, text=True, capture_output=True)
        if result.returncode == 0:
            return
        if not _should_fall_back_to_system_ruff(result):
            raise subprocess.CalledProcessError(
                result.returncode,
                preferred,
                output=result.stdout,
                stderr=result.stderr,
            )

    fallback_env = os.environ.copy()
    venv_scripts_dir = ROOT / ".venv" / ("Scripts" if os.name == "nt" else "bin")
    fallback_env["PATH"] = os.pathsep.join(
        entry
        for entry in fallback_env.get("PATH", "").split(os.pathsep)
        if entry and Path(entry) != venv_scripts_dir
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
            "--formatters",
            "black",
            "isort",
        ],
        check=True,
    )
    _run_ruff("check", "--fix", str(OUTPUT))
    _run_ruff("format", str(OUTPUT))


if __name__ == "__main__":
    main()
