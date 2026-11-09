from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.get_function_users_result_users_item import GetFunctionUsersResultUsersItem





T = TypeVar("T", bound="GetFunctionUsersResult")



@_attrs_define
class GetFunctionUsersResult:
    """ 
        Attributes:
            users (list[GetFunctionUsersResultUsersItem]):
            truncated (bool):
            cap (int):
     """

    users: list[GetFunctionUsersResultUsersItem]
    truncated: bool
    cap: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.get_function_users_result_users_item import GetFunctionUsersResultUsersItem # noqa: PLC0415
        users = []
        for users_item_data in self.users:
            users_item = users_item_data.to_dict()
            users.append(users_item)



        truncated = self.truncated

        cap = self.cap


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "users": users,
            "truncated": truncated,
            "cap": cap,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.get_function_users_result_users_item import GetFunctionUsersResultUsersItem # noqa: PLC0415
        d = dict(src_dict)
        users = []
        _users = d.pop("users")
        for users_item_data in (_users):
            users_item = GetFunctionUsersResultUsersItem.from_dict(users_item_data)



            users.append(users_item)


        truncated = d.pop("truncated")

        cap = d.pop("cap")

        get_function_users_result = cls(
            users=users,
            truncated=truncated,
            cap=cap,
        )


        get_function_users_result.additional_properties = d
        return get_function_users_result

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
