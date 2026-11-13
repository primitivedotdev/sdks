from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="CredentialsUpdateKeyResultRulesAddedItem")



@_attrs_define
class CredentialsUpdateKeyResultRulesAddedItem:
    """ 
        Attributes:
            id (str):
            granted_emails (int | None):
            more (bool | Unset):
     """

    id: str
    granted_emails: int | None
    more: bool | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = self.id

        granted_emails: int | None
        granted_emails = self.granted_emails

        more = self.more


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "granted_emails": granted_emails,
        })
        if more is not UNSET:
            field_dict["more"] = more

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = d.pop("id")

        def _parse_granted_emails(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        granted_emails = _parse_granted_emails(d.pop("granted_emails"))


        more = d.pop("more", UNSET)

        credentials_update_key_result_rules_added_item = cls(
            id=id,
            granted_emails=granted_emails,
            more=more,
        )


        credentials_update_key_result_rules_added_item.additional_properties = d
        return credentials_update_key_result_rules_added_item

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
