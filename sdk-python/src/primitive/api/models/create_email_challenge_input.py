from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.create_email_challenge_input_network import CreateEmailChallengeInputNetwork






T = TypeVar("T", bound="CreateEmailChallengeInput")



@_attrs_define
class CreateEmailChallengeInput:
    """ Issue a payment challenge over an email thread. `from` is your sending
    address (the funds receiver; ownership is enforced at send, exactly as
    for outbound mail) and `to` is the payer's address. The `pay_to` payout
    wallet and the token asset are resolved server-side, never taken from
    the request.

        Attributes:
            from_ (str): Your sending address (the payee / funds receiver). Must be an
                address your org is allowed to send from.
            to (str): The payer's email address the challenge is sent to.
            amount (str): Amount to collect, in token base units (unlike the `charge` CLI
                command, which also accepts `--amount-usdc`, this field takes base
                units only). USDC has 6 decimals, so `"10000"` is 0.01 USDC:
                multiply a human USDC amount by 1,000,000 (0.01 USDC -> `"10000"`).
            network (CreateEmailChallengeInputNetwork):
            expires_in (int | Unset): Seconds until the challenge expires. Defaults to 300.
            resource (str | Unset): Optional URL identifying what is being paid for.
            description (str | Unset): Optional human-readable description of the payment.
     """

    from_: str
    to: str
    amount: str
    network: CreateEmailChallengeInputNetwork
    expires_in: int | Unset = UNSET
    resource: str | Unset = UNSET
    description: str | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from_ = self.from_

        to = self.to

        amount = self.amount

        network = self.network.value

        expires_in = self.expires_in

        resource = self.resource

        description = self.description


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "from": from_,
            "to": to,
            "amount": amount,
            "network": network,
        })
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
        from_ = d.pop("from")

        to = d.pop("to")

        amount = d.pop("amount")

        network = CreateEmailChallengeInputNetwork(d.pop("network"))




        expires_in = d.pop("expires_in", UNSET)

        resource = d.pop("resource", UNSET)

        description = d.pop("description", UNSET)

        create_email_challenge_input = cls(
            from_=from_,
            to=to,
            amount=amount,
            network=network,
            expires_in=expires_in,
            resource=resource,
            description=description,
        )

        return create_email_challenge_input

