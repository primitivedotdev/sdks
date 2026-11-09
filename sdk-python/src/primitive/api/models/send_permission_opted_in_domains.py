from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.send_permission_opted_in_domains_type import SendPermissionOptedInDomainsType






T = TypeVar("T", bound="SendPermissionOptedInDomains")



@_attrs_define
class SendPermissionOptedInDomains:
    """ The caller can send to recipients on any domain that authorizes mail from agents on this platform with an `_agents`
    DNS record. Those domains are not listed; check a specific recipient with `/sendability`.

        Attributes:
            type_ (SendPermissionOptedInDomainsType):
            description (str): Human-prose summary of the rule.
     """

    type_: SendPermissionOptedInDomainsType
    description: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_.value

        description = self.description


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "type": type_,
            "description": description,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        type_ = SendPermissionOptedInDomainsType(d.pop("type"))




        description = d.pop("description")

        send_permission_opted_in_domains = cls(
            type_=type_,
            description=description,
        )


        send_permission_opted_in_domains.additional_properties = d
        return send_permission_opted_in_domains

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
