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


def repair_shared_error_headers(output_path: Path) -> None:
    """Add a header field omitted by ogen when it aliases error wrappers.

    ogen v1.20.3 shares ErrorResponseHeaders between errors with rate-limit
    headers and errors with Retry-After. Its decoder expects RetryAfter on that
    wrapper, but its schema generator omits it. Keep the generated API usable
    until the generator can emit the union of those headers itself.
    """
    schema_path = output_path / "oas_schemas_gen.go"
    source = schema_path.read_text()
    original = (
        "type ErrorResponseHeaders struct {\n"
        "\tRatelimitLimit  OptInt\n"
        "\tRatelimitPolicy OptString\n"
        "\tResponse        ErrorResponse\n"
        "}\n"
    )
    repaired = (
        "type ErrorResponseHeaders struct {\n"
        "\tRatelimitLimit  OptInt\n"
        "\tRatelimitPolicy OptString\n"
        "\tRetryAfter      OptInt\n"
        "\tResponse        ErrorResponse\n"
        "}\n\n"
        "// GetRetryAfter returns the value of RetryAfter.\n"
        "func (s *ErrorResponseHeaders) GetRetryAfter() OptInt {\n"
        "\treturn s.RetryAfter\n"
        "}\n\n"
        "// SetRetryAfter sets the value of RetryAfter.\n"
        "func (s *ErrorResponseHeaders) SetRetryAfter(val OptInt) {\n"
        "\ts.RetryAfter = val\n"
        "}\n"
    )
    if source.count(original) != 1:
        raise RuntimeError("ogen ErrorResponseHeaders shape changed; review header workaround")
    schema_path.write_text(source.replace(original, repaired, 1))


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

        repair_shared_error_headers(output_path)
        remove_generated_files()
        for source in output_path.glob("*.go"):
            shutil.copy2(source, TARGET_PATH / source.name)


if __name__ == "__main__":
    main()
