from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path

SDK_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = Path(__file__).resolve().parents[2]
SPEC_PATH = REPO_ROOT / "openapi" / "primitive-api.codegen.json"
TARGET_PATH = SDK_ROOT / "api"
GENERATOR_VERSION = "v1.20.3"


def remove_generated_files() -> None:
    TARGET_PATH.mkdir(parents=True, exist_ok=True)

    for path in TARGET_PATH.glob("oas_*_gen.go"):
        path.unlink()


def main() -> None:
    with tempfile.TemporaryDirectory(prefix="primitive-go-api-") as temp_dir:
        output_path = Path(temp_dir) / "generated"
        subprocess.run(
            [
                "go",
                "run",
                f"github.com/ogen-go/ogen/cmd/ogen@{GENERATOR_VERSION}",
                "--target",
                str(output_path),
                "--package",
                "api",
                str(SPEC_PATH),
            ],
            check=True,
            cwd=SDK_ROOT,
        )

        remove_generated_files()
        for source in output_path.glob("*.go"):
            shutil.copy2(source, TARGET_PATH / source.name)


if __name__ == "__main__":
    main()
