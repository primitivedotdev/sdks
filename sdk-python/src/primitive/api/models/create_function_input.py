from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.create_function_input_files import CreateFunctionInputFiles





T = TypeVar("T", bound="CreateFunctionInput")



@_attrs_define
class CreateFunctionInput:
    """ 
        Attributes:
            name (str): Slug-style name. Lowercase letters, digits, hyphens, and
                underscores. 1 to 64 characters. Must be unique within the
                org; a 409 is returned on collision.
            code (str | Unset): Pre-built handler as a single ESM module. Up to 1 MiB UTF-8.
                Must export a default `{ async fetch(req, env, ctx) { ... } }`
                object. Provide either `code` or `files`, not both.
            source_map (str | Unset): Optional source map for the bundle. Up to 5 MiB UTF-8.
                Stored with the deployment attempt and sent to the runtime
                to symbolicate stack traces in the function's logs. Only
                valid with `code`.
            files (CreateFunctionInputFiles | Unset): Source files for a managed build, as a map of path to file
                contents (for example {"package.json": "...",
                "src/index.ts": "..."}). Provide this INSTEAD of `code` to
                have the server install dependencies and bundle the source
                for the Workers runtime before deploying. Include a
                package.json (its `dependencies` are installed). Provide
                either `code` or `files`, not both.
     """

    name: str
    code: str | Unset = UNSET
    source_map: str | Unset = UNSET
    files: CreateFunctionInputFiles | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.create_function_input_files import CreateFunctionInputFiles
        name = self.name

        code = self.code

        source_map = self.source_map

        files: dict[str, Any] | Unset = UNSET
        if not isinstance(self.files, Unset):
            files = self.files.to_dict()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "name": name,
        })
        if code is not UNSET:
            field_dict["code"] = code
        if source_map is not UNSET:
            field_dict["sourceMap"] = source_map
        if files is not UNSET:
            field_dict["files"] = files

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.create_function_input_files import CreateFunctionInputFiles
        d = dict(src_dict)
        name = d.pop("name")

        code = d.pop("code", UNSET)

        source_map = d.pop("sourceMap", UNSET)

        _files = d.pop("files", UNSET)
        files: CreateFunctionInputFiles | Unset
        if isinstance(_files,  Unset):
            files = UNSET
        else:
            files = CreateFunctionInputFiles.from_dict(_files)




        create_function_input = cls(
            name=name,
            code=code,
            source_map=source_map,
            files=files,
        )

        return create_function_input

