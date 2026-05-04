from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.send_permission_address_type import SendPermissionAddressType
from dateutil.parser import isoparse
from typing import cast
import datetime






T = TypeVar("T", bound="SendPermissionAddress")



@_attrs_define
class SendPermissionAddress:
    """ The caller can send to a specific address that has
    authenticated inbound mail to the org. Emitted once per row
    in the org's `known_send_addresses` table, capped at
    `meta.address_cap`.

        Attributes:
            type_ (SendPermissionAddressType):
            address (str): The bare email address this rule grants sends to.
            last_received_at (datetime.datetime): Most recent inbound email from this address that
                authenticated successfully (DMARC pass + DKIM/SPF
                alignment). Updated on each new authenticated receipt.
            received_count (int): Total number of authenticated inbound emails from this
                address. Increments only when `last_received_at` advances.
            description (str): Human-prose summary of the rule.
     """

    type_: SendPermissionAddressType
    address: str
    last_received_at: datetime.datetime
    received_count: int
    description: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_.value

        address = self.address

        last_received_at = self.last_received_at.isoformat()

        received_count = self.received_count

        description = self.description


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "type": type_,
            "address": address,
            "last_received_at": last_received_at,
            "received_count": received_count,
            "description": description,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        type_ = SendPermissionAddressType(d.pop("type"))




        address = d.pop("address")

        last_received_at = isoparse(d.pop("last_received_at"))




        received_count = d.pop("received_count")

        description = d.pop("description")

        send_permission_address = cls(
            type_=type_,
            address=address,
            last_received_at=last_received_at,
            received_count=received_count,
            description=description,
        )


        send_permission_address.additional_properties = d
        return send_permission_address

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
