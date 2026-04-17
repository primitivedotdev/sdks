from __future__ import annotations

import re
import shutil
import subprocess
import tempfile
from pathlib import Path

SDK_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = Path(__file__).resolve().parents[2]
SPEC_PATH = REPO_ROOT / "openapi" / "primitive-api.codegen.json"
CONFIG_PATH = SDK_ROOT / "openapi-python-client-config.yml"
TARGET_PATH = SDK_ROOT / "src" / "primitive" / "api"
GENERATED_ITEMS = ["api", "client.py", "errors.py", "models", "types.py"]

# Only matches module-level imports (no leading whitespace). Indented imports
# inside TYPE_CHECKING blocks or function bodies are intentionally preserved,
# since removing a runtime-local import can cause NameError at runtime.
_IMPORT_LINE = re.compile(r"^from\s+\S+\s+import\s+.+$")


def remove_existing_generated_items() -> None:
    TARGET_PATH.mkdir(parents=True, exist_ok=True)

    for name in GENERATED_ITEMS:
        path = TARGET_PATH / name
        if path.is_dir():
            shutil.rmtree(path)
        elif path.exists():
            path.unlink()


def copy_generated_items(output_path: Path) -> None:
    for name in GENERATED_ITEMS:
        source = output_path / name
        destination = TARGET_PATH / name

        if source.is_dir():
            shutil.copytree(source, destination)
        else:
            shutil.copy2(source, destination)


def dedupe_imports(directory: Path) -> None:
    # openapi-python-client 0.28.3 occasionally emits the same "from X import ..."
    # twice (e.g. "from ..types import UNSET, Unset" in 201-response models).
    # Duplicate imports are no-ops semantically but trip strict linters downstream.
    for py_file in directory.rglob("*.py"):
        seen: set[str] = set()
        new_lines: list[str] = []
        for line in py_file.read_text().splitlines(keepends=True):
            if _IMPORT_LINE.match(line):
                key = line.rstrip()
                if key in seen:
                    continue
                seen.add(key)
            new_lines.append(line)
        py_file.write_text("".join(new_lines))


def main() -> None:
    with tempfile.TemporaryDirectory(prefix="primitive-python-api-") as temp_dir:
        output_path = Path(temp_dir) / "generated"
        subprocess.run(
            [
                "openapi-python-client",
                "generate",
                "--meta",
                "none",
                "--config",
                str(CONFIG_PATH),
                "--path",
                str(SPEC_PATH),
                "--output-path",
                str(output_path),
            ],
            check=True,
            cwd=SDK_ROOT,
        )

        remove_existing_generated_items()
        copy_generated_items(output_path)
        dedupe_imports(TARGET_PATH)


if __name__ == "__main__":
    main()
