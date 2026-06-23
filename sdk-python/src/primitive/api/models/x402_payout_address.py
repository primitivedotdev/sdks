from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.x402_payout_address_network import X402PayoutAddressNetwork
from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="X402PayoutAddress")



@_attrs_define
class X402PayoutAddress:
    """ 
        Attributes:
            id (UUID):
            address (str): The checksummed payout address.
            network (X402PayoutAddressNetwork):
            label (None | str):
            is_default (bool): Exactly one address per (org, network) is the default.
            verified_at (datetime.datetime): When ownership of the address was last proven.
            created_at (datetime.datetime | Unset):
     """

    id: UUID
    address: str
    network: X402PayoutAddressNetwork
    label: None | str
    is_default: bool
    verified_at: datetime.datetime
    created_at: datetime.datetime | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        address = self.address

        network = self.network.value

        label: None | str
        label = self.label

        is_default = self.is_default

        verified_at = self.verified_at.isoformat()

        created_at: str | Unset = UNSET
        if not isinstance(self.created_at, Unset):
            created_at = self.created_at.isoformat()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "address": address,
            "network": network,
            "label": label,
            "is_default": is_default,
            "verified_at": verified_at,
        })
        if created_at is not UNSET:
            field_dict["created_at"] = created_at

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        address = d.pop("address")

        network = X402PayoutAddressNetwork(d.pop("network"))




        def _parse_label(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        label = _parse_label(d.pop("label"))


        is_default = d.pop("is_default")

        verified_at = isoparse(d.pop("verified_at"))




        _created_at = d.pop("created_at", UNSET)
        created_at: datetime.datetime | Unset
        if isinstance(_created_at,  Unset):
            created_at = UNSET
        else:
            created_at = isoparse(_created_at)




        x402_payout_address = cls(
            id=id,
            address=address,
            network=network,
            label=label,
            is_default=is_default,
            verified_at=verified_at,
            created_at=created_at,
        )


        x402_payout_address.additional_properties = d
        return x402_payout_address

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
