from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="CredentialsListCredentialsResultItemsItemCli")



@_attrs_define
class CredentialsListCredentialsResultItemsItemCli:
    """ 
        Attributes:
            device_name (None | str):
            user_agent (None | str):
     """

    device_name: None | str
    user_agent: None | str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        device_name: None | str
        device_name = self.device_name

        user_agent: None | str
        user_agent = self.user_agent


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "device_name": device_name,
            "user_agent": user_agent,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        def _parse_device_name(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        device_name = _parse_device_name(d.pop("device_name"))


        def _parse_user_agent(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        user_agent = _parse_user_agent(d.pop("user_agent"))


        credentials_list_credentials_result_items_item_cli = cls(
            device_name=device_name,
            user_agent=user_agent,
        )


        credentials_list_credentials_result_items_item_cli.additional_properties = d
        return credentials_list_credentials_result_items_item_cli

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
