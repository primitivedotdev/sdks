from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.template_install_mode import TemplateInstallMode
from typing import cast






T = TypeVar("T", bound="TemplateInstall")



@_attrs_define
class TemplateInstall:
    """ 
        Attributes:
            mode (TemplateInstallMode):
            edit_files (list[str]):
            reason (str):  Default: ''.
     """

    mode: TemplateInstallMode
    edit_files: list[str]
    reason: str = ''





    def to_dict(self) -> dict[str, Any]:
        mode = self.mode.value

        edit_files = self.edit_files



        reason = self.reason


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "mode": mode,
            "editFiles": edit_files,
            "reason": reason,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        mode = TemplateInstallMode(d.pop("mode"))




        edit_files = cast(list[str], d.pop("editFiles"))


        reason = d.pop("reason")

        template_install = cls(
            mode=mode,
            edit_files=edit_files,
            reason=reason,
        )

        return template_install

