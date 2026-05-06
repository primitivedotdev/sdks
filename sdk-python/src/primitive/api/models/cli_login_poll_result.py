from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID






T = TypeVar("T", bound="CliLoginPollResult")



@_attrs_define
class CliLoginPollResult:
    """ 
        Attributes:
            api_key (str): Newly-created API key for CLI authentication
            key_id (UUID):
            key_prefix (str):
            org_id (UUID):
            org_name (None | str):
     """

    api_key: str
    key_id: UUID
    key_prefix: str
    org_id: UUID
    org_name: None | str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        api_key = self.api_key

        key_id = str(self.key_id)

        key_prefix = self.key_prefix

        org_id = str(self.org_id)

        org_name: None | str
        org_name = self.org_name


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "api_key": api_key,
            "key_id": key_id,
            "key_prefix": key_prefix,
            "org_id": org_id,
            "org_name": org_name,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        api_key = d.pop("api_key")

        key_id = UUID(d.pop("key_id"))




        key_prefix = d.pop("key_prefix")

        org_id = UUID(d.pop("org_id"))




        def _parse_org_name(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        org_name = _parse_org_name(d.pop("org_name"))


        cli_login_poll_result = cls(
            api_key=api_key,
            key_id=key_id,
            key_prefix=key_prefix,
            org_id=org_id,
            org_name=org_name,
        )


        cli_login_poll_result.additional_properties = d
        return cli_login_poll_result

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
