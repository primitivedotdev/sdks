from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.create_challenge_input_network import CreateChallengeInputNetwork
from uuid import UUID






T = TypeVar("T", bound="CreateChallengeInput")



@_attrs_define
class CreateChallengeInput:
    """ 
        Attributes:
            amount (str): Amount to collect, in token base units. USDC has 6 decimals, so
                `"10000"` is 0.01 USDC.
            network (CreateChallengeInputNetwork):
            payer_org (UUID | Unset): The org id allowed to pay this challenge (on-net binding). Optional.
            expires_in (int | Unset): Seconds until the challenge expires. Defaults to 3600.
            resource (str | Unset): Optional URL identifying what is being paid for. Defaults to a
                synthetic `x402:challenge:<id>` identifier.
            description (str | Unset): Optional human-readable description of the payment.
     """

    amount: str
    network: CreateChallengeInputNetwork
    payer_org: UUID | Unset = UNSET
    expires_in: int | Unset = UNSET
    resource: str | Unset = UNSET
    description: str | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        amount = self.amount

        network = self.network.value

        payer_org: str | Unset = UNSET
        if not isinstance(self.payer_org, Unset):
            payer_org = str(self.payer_org)

        expires_in = self.expires_in

        resource = self.resource

        description = self.description


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "amount": amount,
            "network": network,
        })
        if payer_org is not UNSET:
            field_dict["payer_org"] = payer_org
        if expires_in is not UNSET:
            field_dict["expires_in"] = expires_in
        if resource is not UNSET:
            field_dict["resource"] = resource
        if description is not UNSET:
            field_dict["description"] = description

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        amount = d.pop("amount")

        network = CreateChallengeInputNetwork(d.pop("network"))




        _payer_org = d.pop("payer_org", UNSET)
        payer_org: UUID | Unset
        if isinstance(_payer_org,  Unset):
            payer_org = UNSET
        else:
            payer_org = UUID(_payer_org)




        expires_in = d.pop("expires_in", UNSET)

        resource = d.pop("resource", UNSET)

        description = d.pop("description", UNSET)

        create_challenge_input = cls(
            amount=amount,
            network=network,
            payer_org=payer_org,
            expires_in=expires_in,
            resource=resource,
            description=description,
        )

        return create_challenge_input

