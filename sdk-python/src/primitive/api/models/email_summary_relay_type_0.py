from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="EmailSummaryRelayType0")



@_attrs_define
class EmailSummaryRelayType0:
    """ Set when the message reached Primitive through a Primitive mail relay. Null for other mail. The field may be absent;
    treat a missing value the same as null.

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

        email_summary_relay_type_0 = cls(
            hostname=hostname,
            via=via,
        )


        email_summary_relay_type_0.additional_properties = d
        return email_summary_relay_type_0

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
