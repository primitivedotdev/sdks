from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.send_permission_managed_zone_type import SendPermissionManagedZoneType






T = TypeVar("T", bound="SendPermissionManagedZone")



@_attrs_define
class SendPermissionManagedZone:
    """ The caller can send to any address at the named
    Primitive-managed zone. Always emitted (no entitlement
    required) because Primitive owns the zone and every mailbox
    belongs to a Primitive customer by construction.

        Attributes:
            type_ (SendPermissionManagedZoneType):
            zone (str): The managed apex domain. Sends are accepted to any
                address at the apex itself or any subdomain (e.g.
                `alice@primitive.email` and `alice@acme.primitive.email`
                both match the `primitive.email` zone rule).
            description (str): Human-prose summary of the rule.
     """

    type_: SendPermissionManagedZoneType
    zone: str
    description: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_.value

        zone = self.zone

        description = self.description


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "type": type_,
            "zone": zone,
            "description": description,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        type_ = SendPermissionManagedZoneType(d.pop("type"))




        zone = d.pop("zone")

        description = d.pop("description")

        send_permission_managed_zone = cls(
            type_=type_,
            zone=zone,
            description=description,
        )


        send_permission_managed_zone.additional_properties = d
        return send_permission_managed_zone

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
