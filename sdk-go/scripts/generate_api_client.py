from __future__ import annotations

import re
import shutil
import subprocess
import tempfile
from pathlib import Path

SDK_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = Path(__file__).resolve().parents[2]
SPEC_PATH = REPO_ROOT / "openapi" / "primitive-api.codegen.json"
TARGET_PATH = SDK_ROOT / "api"
GENERATOR_VERSION = "v1.20.3"


# ogen rejects a response whose enum value is not in the spec, and has no
# option or template hook for it, so its validators are adjusted here: a value
# the API added after this client was generated is kept instead of failing the
# whole response. A request parameter stays strict, through validateKnown: an
# unsupported filter is still refused.
_ENUM_VALIDATOR = re.compile(
    r"func \(s (?P<receiver>\*?\w+)\) Validate\(\) error \{\n"
    r"\tswitch s \{\n"
    r"(?P<cases>(?:\tcase [^\n]+:\n\t\treturn nil\n)+)"
    r"\tdefault:\n"
    r"\t\treturn errors\.Errorf\(\"invalid value: %v\", s\)\n"
    r"\t\}\n"
    r"\}\n"
)

_PARAMETER_VALIDATE_CALL = "if err := value.Validate(); err != nil {"

_VALIDATE_PARAMETER_HELPER = """
// validateParameter refuses an enum value the spec does not list. Validate
// tolerates one, because it also runs on decoded responses.
func validateParameter(value interface{ Validate() error }) error {
\tif known, ok := value.(interface{ validateKnown() error }); ok {
\t\treturn known.validateKnown()
\t}
\treturn value.Validate()
}
"""


def tolerate_unknown_enum_values(directory: Path) -> None:
    path = directory / "oas_validators_gen.go"
    text = path.read_text()
    strict: list[str] = []

    def adjust(match: re.Match[str]) -> str:
        receiver, cases = match.group("receiver"), match.group("cases")
        strict.append(
            f"\nfunc (s {receiver}) validateKnown() error {{\n\tswitch s {{\n{cases}"
            '\tdefault:\n\t\treturn errors.Errorf("invalid value: %v", s)\n\t}\n}\n'
        )
        return (
            f"func (s {receiver}) Validate() error {{\n\tswitch s {{\n{cases}"
            "\tdefault:\n\t\t// Added to the API after this client was generated.\n\t\treturn nil\n\t}\n}\n"
        )

    new_text, count = _ENUM_VALIDATOR.subn(adjust, text)
    if count == 0:
        raise SystemExit(f"no enum validators found in {path}")
    if "invalid value: %v" in new_text:
        raise SystemExit(f"an enum validator in {path} was not adjusted")
    path.write_text(new_text + "".join(strict) + _VALIDATE_PARAMETER_HELPER)

    parameters = directory / "oas_parameters_gen.go"
    parameter_text = parameters.read_text()
    if _PARAMETER_VALIDATE_CALL not in parameter_text:
        raise SystemExit(f"no parameter validation found in {parameters}")
    parameters.write_text(
        parameter_text.replace(
            _PARAMETER_VALIDATE_CALL,
            "if err := validateParameter(value); err != nil {",
        )
    )


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
        tolerate_unknown_enum_values(TARGET_PATH)


if __name__ == "__main__":
    main()
