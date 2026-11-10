from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.update_route_response_200_data_warnings_item_code import UpdateRouteResponse200DataWarningsItemCode






T = TypeVar("T", bound="UpdateRouteResponse200DataWarningsItem")



@_attrs_define
class UpdateRouteResponse200DataWarningsItem:
    """ 
        Attributes:
            code (UpdateRouteResponse200DataWarningsItemCode):
            message (str):
     """

    code: UpdateRouteResponse200DataWarningsItemCode
    message: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        code = self.code.value

        message = self.message


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "code": code,
            "message": message,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        code = UpdateRouteResponse200DataWarningsItemCode(d.pop("code"))




        message = d.pop("message")

        update_route_response_200_data_warnings_item = cls(
            code=code,
            message=message,
        )


        update_route_response_200_data_warnings_item.additional_properties = d
        return update_route_response_200_data_warnings_item

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
