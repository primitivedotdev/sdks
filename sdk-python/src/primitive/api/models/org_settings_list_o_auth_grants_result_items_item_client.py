from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="OrgSettingsListOAuthGrantsResultItemsItemClient")



@_attrs_define
class OrgSettingsListOAuthGrantsResultItemsItemClient:
    """ 
        Attributes:
            client_id (str):
            name (None | str):
            uri (None | str):
     """

    client_id: str
    name: None | str
    uri: None | str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        client_id = self.client_id

        name: None | str
        name = self.name

        uri: None | str
        uri = self.uri


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "client_id": client_id,
            "name": name,
            "uri": uri,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        client_id = d.pop("client_id")

        def _parse_name(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        name = _parse_name(d.pop("name"))


        def _parse_uri(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        uri = _parse_uri(d.pop("uri"))


        org_settings_list_o_auth_grants_result_items_item_client = cls(
            client_id=client_id,
            name=name,
            uri=uri,
        )


        org_settings_list_o_auth_grants_result_items_item_client.additional_properties = d
        return org_settings_list_o_auth_grants_result_items_item_client

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
