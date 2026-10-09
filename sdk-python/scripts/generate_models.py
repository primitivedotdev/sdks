from __future__ import annotations

import importlib.util
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = ROOT / "src" / "primitive" / "schemas" / "email_received_event.schema.json"
OUTPUT = ROOT / "src" / "primitive" / "models_generated.py"
SENT_EMAIL_SCHEMA = ROOT / "src" / "primitive" / "schemas" / "sent_email_event.schema.json"
SENT_EMAIL_OUTPUT = ROOT / "src" / "primitive" / "sent_email_models_generated.py"


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

    filtered_path = os.pathsep.join(
        entry
        for entry in fallback_env.get("PATH", "").split(os.pathsep)
        if entry and Path(entry) != venv_scripts_dir
    )
    system_ruff = shutil.which("ruff", path=filtered_path)
    if system_ruff:
        subprocess.run([system_ruff, *args], check=True, env=fallback_env)
        return

    ruff_binary = venv_scripts_dir / ("ruff.exe" if os.name == "nt" else "ruff")
    if ruff_binary.exists():
        subprocess.run([str(ruff_binary), *args], check=True, env=fallback_env)
        return

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
        "Event",
        "Type",
        "Category",
        "ClassifiedBy",
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
        "    url: Annotated[\n        Annotated[AnyUrl, UrlConstraints(allowed_schemes=[\"http\", \"https\"])],\n",
    )

    text = _replace_once(
        text,
        "    attachments_download_url: Annotated[\n        AnyUrl | None,\n",
        "    attachments_download_url: Annotated[\n        Annotated[AnyUrl, UrlConstraints(allowed_schemes=[\"http\", \"https\"])] | None,\n",
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
        "    @field_validator(\n"
        "        \"spamassassin\", \"forward\", \"bounce\", \"tls_report\", \"dmarc_report\", mode=\"before\"\n"
        "    )\n"
        "    @classmethod\n"
        "    def reject_explicit_null_optional_objects(cls, value):\n"
        "        if value is None:\n"
        "            raise ValueError(\"Field may be omitted but must not be null\")\n"
        "        return value\n\n\n"
        "class Email(BaseModel):\n",
    )

    OUTPUT.write_text(text)


def _patch_sent_email_models() -> None:
    """Share the email models' BaseModel and RootModel, so both payload
    families dump the same way, and drop the unnamed root wrapper."""
    text = SENT_EMAIL_OUTPUT.read_text()

    text = _replace_once(
        text,
        "from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, RootModel\n",
        "from pydantic import AwareDatetime, ConfigDict, Field\n\n"
        "from .models_generated import BaseModel, RootModel\n",
    )
    if "from enum import StrEnum\n" in text:
        text = text.replace(
            "from enum import StrEnum\n", "from ._compat import StrEnum\n", 1
        )
    elif "from enum import Enum\n" in text:
        text = text.replace("from enum import Enum\n", "from ._compat import StrEnum\n", 1)
        text = text.replace("(Enum):", "(StrEnum):")
    text = text.replace("class Event(StrEnum):", "class SentEmailResultEventType(StrEnum):")
    text = text.replace("    event: Event\n", "    event: SentEmailResultEventType\n")
    text = text.replace("class Result(StrEnum):", "class SentEmailResult(StrEnum):")
    text = text.replace("    result: Result\n", "    result: SentEmailResult\n")
    text = _replace_once(
        text,
        "\n\nclass Model(RootModel[SentEmailEvent]):\n    root: SentEmailEvent\n",
        "\n",
    )

    SENT_EMAIL_OUTPUT.write_text(text)


def _generate(schema: Path, output: Path) -> None:
    subprocess.run(
        [
            sys.executable,
            "-m",
            "datamodel_code_generator",
            "--input",
            str(schema),
            "--input-file-type",
            "jsonschema",
            "--output",
            str(output),
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


def main() -> None:
    _generate(SCHEMA, OUTPUT)
    _patch_generated_models()
    _run_ruff("check", "--fix", str(OUTPUT))
    _run_ruff("format", str(OUTPUT))

    _generate(SENT_EMAIL_SCHEMA, SENT_EMAIL_OUTPUT)
    _patch_sent_email_models()
    _run_ruff("check", "--fix", str(SENT_EMAIL_OUTPUT))
    _run_ruff("format", str(SENT_EMAIL_OUTPUT))


if __name__ == "__main__":
    main()
