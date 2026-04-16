from __future__ import annotations

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


if __name__ == "__main__":
    main()
