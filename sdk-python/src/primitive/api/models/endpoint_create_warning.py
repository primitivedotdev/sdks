from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from uuid import UUID






T = TypeVar("T", bound="EndpointCreateWarning")



@_attrs_define
class EndpointCreateWarning:
    """ 
        Attributes:
            code (str):
            message (str):
            endpoint_id (UUID | Unset): The other webhook a same_path_as_another_endpoint warning names.
     """

    code: str
    message: str
    endpoint_id: UUID | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        code = self.code

        message = self.message

        endpoint_id: str | Unset = UNSET
        if not isinstance(self.endpoint_id, Unset):
            endpoint_id = str(self.endpoint_id)


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "code": code,
            "message": message,
        })
        if endpoint_id is not UNSET:
            field_dict["endpoint_id"] = endpoint_id

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        code = d.pop("code")

        message = d.pop("message")

        _endpoint_id = d.pop("endpoint_id", UNSET)
        endpoint_id: UUID | Unset
        if isinstance(_endpoint_id,  Unset):
            endpoint_id = UNSET
        else:
            endpoint_id = UUID(_endpoint_id)




        endpoint_create_warning = cls(
            code=code,
            message=message,
            endpoint_id=endpoint_id,
        )


        endpoint_create_warning.additional_properties = d
        return endpoint_create_warning

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
