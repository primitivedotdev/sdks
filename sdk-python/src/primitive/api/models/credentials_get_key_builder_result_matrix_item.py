from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="CredentialsGetKeyBuilderResultMatrixItem")



@_attrs_define
class CredentialsGetKeyBuilderResultMatrixItem:
    """ 
        Attributes:
            id (str):
            label (str):
            description (str):
            read (list[str]):
            write (list[str]):
            resource (None | str):
            org_wide_only (bool | Unset):
     """

    id: str
    label: str
    description: str
    read: list[str]
    write: list[str]
    resource: None | str
    org_wide_only: bool | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = self.id

        label = self.label

        description = self.description

        read = self.read



        write = self.write



        resource: None | str
        resource = self.resource

        org_wide_only = self.org_wide_only


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "label": label,
            "description": description,
            "read": read,
            "write": write,
            "resource": resource,
        })
        if org_wide_only is not UNSET:
            field_dict["org_wide_only"] = org_wide_only

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = d.pop("id")

        label = d.pop("label")

        description = d.pop("description")

        read = cast(list[str], d.pop("read"))


        write = cast(list[str], d.pop("write"))


        def _parse_resource(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        resource = _parse_resource(d.pop("resource"))


        org_wide_only = d.pop("org_wide_only", UNSET)

        credentials_get_key_builder_result_matrix_item = cls(
            id=id,
            label=label,
            description=description,
            read=read,
            write=write,
            resource=resource,
            org_wide_only=org_wide_only,
        )


        credentials_get_key_builder_result_matrix_item.additional_properties = d
        return credentials_get_key_builder_result_matrix_item

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
