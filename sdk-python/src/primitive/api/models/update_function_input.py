from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.update_function_input_files import UpdateFunctionInputFiles





T = TypeVar("T", bound="UpdateFunctionInput")



@_attrs_define
class UpdateFunctionInput:
    """ 
        Attributes:
            code (str | Unset): New pre-built handler. Same rules as CreateFunctionInput.code. Provide either `code` or
                `files`, not both.
            source_map (str | Unset):
            files (UpdateFunctionInputFiles | Unset): Source files for a managed build, as a map of path to file
                contents. Provide this INSTEAD of `code` to rebuild and
                redeploy from source. Same rules as CreateFunctionInput.files.
     """

    code: str | Unset = UNSET
    source_map: str | Unset = UNSET
    files: UpdateFunctionInputFiles | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.update_function_input_files import UpdateFunctionInputFiles
        code = self.code

        source_map = self.source_map

        files: dict[str, Any] | Unset = UNSET
        if not isinstance(self.files, Unset):
            files = self.files.to_dict()


        field_dict: dict[str, Any] = {}

        field_dict.update({
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
        from ..models.update_function_input_files import UpdateFunctionInputFiles
        d = dict(src_dict)
        code = d.pop("code", UNSET)

        source_map = d.pop("sourceMap", UNSET)

        _files = d.pop("files", UNSET)
        files: UpdateFunctionInputFiles | Unset
        if isinstance(_files,  Unset):
            files = UNSET
        else:
            files = UpdateFunctionInputFiles.from_dict(_files)




        update_function_input = cls(
            code=code,
            source_map=source_map,
            files=files,
        )

        return update_function_input

