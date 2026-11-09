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
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        mode = self.mode.value

        edit_files = self.edit_files



        reason = self.reason


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
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


        template_install.additional_properties = d
        return template_install

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
