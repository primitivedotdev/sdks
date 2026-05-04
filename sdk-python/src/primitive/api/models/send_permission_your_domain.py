from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.send_permission_your_domain_type import SendPermissionYourDomainType






T = TypeVar("T", bound="SendPermissionYourDomain")



@_attrs_define
class SendPermissionYourDomain:
    """ The caller can send to any address at one of their own
    verified outbound domains. Emitted once per active row in
    the org's `domains` table.

        Attributes:
            type_ (SendPermissionYourDomainType):
            domain (str): A verified outbound domain owned by the caller's org.
            description (str): Human-prose summary of the rule.
     """

    type_: SendPermissionYourDomainType
    domain: str
    description: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_.value

        domain = self.domain

        description = self.description


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "type": type_,
            "domain": domain,
            "description": description,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        type_ = SendPermissionYourDomainType(d.pop("type"))




        domain = d.pop("domain")

        description = d.pop("description")

        send_permission_your_domain = cls(
            type_=type_,
            domain=domain,
            description=description,
        )


        send_permission_your_domain.additional_properties = d
        return send_permission_your_domain

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
