from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.register_payout_address_input_network import RegisterPayoutAddressInputNetwork
from dateutil.parser import isoparse
from typing import cast
import datetime






T = TypeVar("T", bound="RegisterPayoutAddressInput")



@_attrs_define
class RegisterPayoutAddressInput:
    """ 
        Attributes:
            address (str): The payout address (your signer's own EVM address), 0x-prefixed.
            network (RegisterPayoutAddressInputNetwork): The chain the address receives on.
            signature (str): A `personal_sign` signature over the org-bound message produced by
                the SDK helper `buildPayoutRegistrationMessage`. Recovered and
                checked against `address`; the org id is bound into the signed bytes.
            issued_at (datetime.datetime): ISO-8601 timestamp embedded in the signed message. Must be within a
                short freshness window (about 10 minutes) of server time.
            label (str | Unset): Optional human-readable label.
     """

    address: str
    network: RegisterPayoutAddressInputNetwork
    signature: str
    issued_at: datetime.datetime
    label: str | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        address = self.address

        network = self.network.value

        signature = self.signature

        issued_at = self.issued_at.isoformat()

        label = self.label


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "address": address,
            "network": network,
            "signature": signature,
            "issued_at": issued_at,
        })
        if label is not UNSET:
            field_dict["label"] = label

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        address = d.pop("address")

        network = RegisterPayoutAddressInputNetwork(d.pop("network"))




        signature = d.pop("signature")

        issued_at = isoparse(d.pop("issued_at"))




        label = d.pop("label", UNSET)

        register_payout_address_input = cls(
            address=address,
            network=network,
            signature=signature,
            issued_at=issued_at,
            label=label,
        )

        return register_payout_address_input

