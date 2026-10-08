from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="EmailRelay")



@_attrs_define
class EmailRelay:
    """ How an inbound message reached Primitive when it arrived through a Primitive mail relay.

        Attributes:
            hostname (str): The relay hostname the domain's MX record points at.
            via (str): How the message arrived. Currently always `mail_relay`. Treat an unfamiliar value as one added after
                your client was built.
     """

    hostname: str
    via: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        hostname = self.hostname

        via = self.via


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "hostname": hostname,
            "via": via,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        hostname = d.pop("hostname")

        via = d.pop("via")

        email_relay = cls(
            hostname=hostname,
            via=via,
        )


        email_relay.additional_properties = d
        return email_relay

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
