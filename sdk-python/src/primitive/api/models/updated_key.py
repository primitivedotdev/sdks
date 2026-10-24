from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.key_grant_warning import KeyGrantWarning





T = TypeVar("T", bound="UpdatedKey")



@_attrs_define
class UpdatedKey:
    """ 
        Attributes:
            id (str):
            changed (list[str]):
            warnings (list[KeyGrantWarning]):
     """

    id: str
    changed: list[str]
    warnings: list[KeyGrantWarning]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.key_grant_warning import KeyGrantWarning # noqa: PLC0415
        id = self.id

        changed = self.changed



        warnings = []
        for warnings_item_data in self.warnings:
            warnings_item = warnings_item_data.to_dict()
            warnings.append(warnings_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "changed": changed,
            "warnings": warnings,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.key_grant_warning import KeyGrantWarning # noqa: PLC0415
        d = dict(src_dict)
        id = d.pop("id")

        changed = cast(list[str], d.pop("changed"))


        warnings = []
        _warnings = d.pop("warnings")
        for warnings_item_data in (_warnings):
            warnings_item = KeyGrantWarning.from_dict(warnings_item_data)



            warnings.append(warnings_item)


        updated_key = cls(
            id=id,
            changed=changed,
            warnings=warnings,
        )


        updated_key.additional_properties = d
        return updated_key

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
