from __future__ import annotations

import importlib.util
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = ROOT / "src" / "primitive" / "schemas" / "email_received_event.schema.json"
OUTPUT = ROOT / "src" / "primitive" / "models_generated.py"


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
    active_venv = fallback_env.get("VIRTUAL_ENV")
    if active_venv:
        venv_scripts_dir = Path(active_venv) / ("Scripts" if os.name == "nt" else "bin")
    else:
        venv_scripts_dir = ROOT / ".venv" / ("Scripts" if os.name == "nt" else "bin")
    fallback_env["PATH"] = os.pathsep.join(
        entry
        for entry in fallback_env.get("PATH", "").split(os.pathsep)
        if entry and Path(entry) != venv_scripts_dir
    )
    subprocess.run(["ruff", *args], check=True, env=fallback_env)


def _replace_once(text: str, old: str, new: str) -> str:
    if old not in text:
        raise ValueError(f"Expected snippet not found while patching generated models: {old[:80]!r}")
    return text.replace(old, new, 1)


def _patch_generated_models() -> None:
    text = OUTPUT.read_text()

    if "from enum import Enum, StrEnum\n" in text:
        text = text.replace(
            "from enum import Enum, StrEnum\n",
            "from enum import Enum\n\nfrom ._compat import StrEnum\n",
            1,
        )
    elif "from enum import Enum\n" in text and "from ._compat import StrEnum\n" not in text:
        text = text.replace(
            "from enum import Enum\n",
            "from enum import Enum\n\nfrom ._compat import StrEnum\n",
            1,
        )

    for enum_name in (
        "Code",
        "ForwardVerdict",
        "AuthConfidence",
        "SpfResult",
        "DmarcResult",
        "DkimResult",
    ):
        text = text.replace(
            f"class {enum_name}(Enum):",
            f"class {enum_name}(StrEnum):",
        )

    text = _replace_once(
        text,
        "from typing import Annotated, Literal\n\nfrom pydantic import AnyUrl, AwareDatetime, BaseModel, ConfigDict, Field, RootModel\n",
        "from typing import Annotated, Literal, TypeVar\n\n"
        "from pydantic import (\n"
        "    AnyUrl,\n"
        "    AwareDatetime,\n"
        "    BaseModel as PydanticBaseModel,\n"
        "    ConfigDict,\n"
        "    Field,\n"
        "    RootModel as PydanticRootModel,\n"
        "    UrlConstraints,\n"
        "    field_validator,\n"
        ")\n\n"
        "RootT = TypeVar(\"RootT\")\n\n\n"
        "class BaseModel(PydanticBaseModel):\n"
        "    model_config = ConfigDict(extra=\"allow\")\n\n"
        "    def model_dump(self, *args, **kwargs):\n"
        "        kwargs.setdefault(\"by_alias\", True)\n"
        "        kwargs.setdefault(\"exclude_defaults\", True)\n"
        "        kwargs.setdefault(\"mode\", \"json\")\n"
        "        return super().model_dump(*args, **kwargs)\n\n"
        "    def model_dump_json(self, *args, **kwargs):\n"
        "        kwargs.setdefault(\"by_alias\", True)\n"
        "        kwargs.setdefault(\"exclude_defaults\", True)\n"
        "        return super().model_dump_json(*args, **kwargs)\n\n\n"
        "class RootModel(PydanticRootModel[RootT]):\n"
        "    def __getattr__(self, name: str):\n"
        "        return getattr(self.root, name)\n\n"
        "    def model_dump(self, *args, **kwargs):\n"
        "        kwargs.setdefault(\"by_alias\", True)\n"
        "        kwargs.setdefault(\"exclude_defaults\", True)\n"
        "        kwargs.setdefault(\"mode\", \"json\")\n"
        "        return super().model_dump(*args, **kwargs)\n\n"
        "    def model_dump_json(self, *args, **kwargs):\n"
        "        kwargs.setdefault(\"by_alias\", True)\n"
        "        kwargs.setdefault(\"exclude_defaults\", True)\n"
        "        return super().model_dump_json(*args, **kwargs)\n",
    )

    text = _replace_once(
        text,
        "    url: Annotated[\n        AnyUrl,\n",
        "    url: Annotated[\n        Annotated[AnyUrl, UrlConstraints(allowed_schemes=[\"https\"])],\n",
    )

    text = _replace_once(
        text,
        "    attachments_download_url: Annotated[\n        AnyUrl | None,\n",
        "    attachments_download_url: Annotated[\n        Annotated[AnyUrl, UrlConstraints(allowed_schemes=[\"https\"])] | None,\n",
    )

    text = _replace_once(
        text,
        "    ]\n\n\nclass ForwardResult(\n",
        "    ]\n\n"
        "    @field_validator(\"dmarc_spf_aligned\", \"dmarc_dkim_aligned\", mode=\"before\")\n"
        "    @classmethod\n"
        "    def reject_explicit_null_optional_alignment_flags(cls, value):\n"
        "        if value is None:\n"
        "            raise ValueError(\"Field may be omitted but must not be null\")\n"
        "        return value\n\n\n"
        "class ForwardResult(\n",
    )

    text = _replace_once(
        text,
        "    ] = None\n\n\nclass Email(BaseModel):\n",
        "    ] = None\n\n"
        "    @field_validator(\"spamassassin\", \"forward\", mode=\"before\")\n"
        "    @classmethod\n"
        "    def reject_explicit_null_optional_objects(cls, value):\n"
        "        if value is None:\n"
        "            raise ValueError(\"Field may be omitted but must not be null\")\n"
        "        return value\n\n\n"
        "class Email(BaseModel):\n",
    )

    OUTPUT.write_text(text)


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
            "3.10",
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
    _patch_generated_models()
    _run_ruff("check", "--fix", str(OUTPUT))
    _run_ruff("format", str(OUTPUT))


if __name__ == "__main__":
    main()
