from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="CreateFunctionInput")



@_attrs_define
class CreateFunctionInput:
    """ 
        Attributes:
            name (str): Slug-style name. Lowercase letters, digits, hyphens, and
                underscores. 1 to 64 characters. Must be unique within the
                org; a 409 is returned on collision.
            code (str): Bundled handler as a single ESM module. Up to 1 MiB UTF-8.
                Must export a default `{ async fetch(req, env, ctx) { ... } }`
                object.
            source_map (str | Unset): Optional source map for the bundle. Up to 5 MiB UTF-8.
                Stored only on the runtime side (not in Primitive's
                database) and used to symbolicate stack traces in the
                function's logs.
     """

    name: str
    code: str
    source_map: str | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        name = self.name

        code = self.code

        source_map = self.source_map


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "name": name,
            "code": code,
        })
        if source_map is not UNSET:
            field_dict["sourceMap"] = source_map

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        name = d.pop("name")

        code = d.pop("code")

        source_map = d.pop("sourceMap", UNSET)

        create_function_input = cls(
            name=name,
            code=code,
            source_map=source_map,
        )

        return create_function_input

