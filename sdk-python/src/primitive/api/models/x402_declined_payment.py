from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.x402_declined_payment_network import X402DeclinedPaymentNetwork
from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="X402DeclinedPayment")



@_attrs_define
class X402DeclinedPayment:
    """ A payment the org's spend policy refused.

        Attributes:
            id (UUID):
            network (X402DeclinedPaymentNetwork):
            amount (str): Amount in token base units.
            reason (str): Why the payment was declined (cap, allowlist, paused).
            declined_at (datetime.datetime):
            challenge_id (None | Unset | UUID): The challenge that was declined, if still present.
            counterparty_org (None | Unset | UUID): The payee (challenger) org, when known.
     """

    id: UUID
    network: X402DeclinedPaymentNetwork
    amount: str
    reason: str
    declined_at: datetime.datetime
    challenge_id: None | Unset | UUID = UNSET
    counterparty_org: None | Unset | UUID = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        network = self.network.value

        amount = self.amount

        reason = self.reason

        declined_at = self.declined_at.isoformat()

        challenge_id: None | str | Unset
        if isinstance(self.challenge_id, Unset):
            challenge_id = UNSET
        elif isinstance(self.challenge_id, UUID):
            challenge_id = str(self.challenge_id)
        else:
            challenge_id = self.challenge_id

        counterparty_org: None | str | Unset
        if isinstance(self.counterparty_org, Unset):
            counterparty_org = UNSET
        elif isinstance(self.counterparty_org, UUID):
            counterparty_org = str(self.counterparty_org)
        else:
            counterparty_org = self.counterparty_org


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "network": network,
            "amount": amount,
            "reason": reason,
            "declined_at": declined_at,
        })
        if challenge_id is not UNSET:
            field_dict["challenge_id"] = challenge_id
        if counterparty_org is not UNSET:
            field_dict["counterparty_org"] = counterparty_org

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        network = X402DeclinedPaymentNetwork(d.pop("network"))




        amount = d.pop("amount")

        reason = d.pop("reason")

        declined_at = isoparse(d.pop("declined_at"))




        def _parse_challenge_id(data: object) -> None | Unset | UUID:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                challenge_id_type_0 = UUID(data)



                return challenge_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | Unset | UUID, data)

        challenge_id = _parse_challenge_id(d.pop("challenge_id", UNSET))


        def _parse_counterparty_org(data: object) -> None | Unset | UUID:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                counterparty_org_type_0 = UUID(data)



                return counterparty_org_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | Unset | UUID, data)

        counterparty_org = _parse_counterparty_org(d.pop("counterparty_org", UNSET))


        x402_declined_payment = cls(
            id=id,
            network=network,
            amount=amount,
            reason=reason,
            declined_at=declined_at,
            challenge_id=challenge_id,
            counterparty_org=counterparty_org,
        )


        x402_declined_payment.additional_properties = d
        return x402_declined_payment

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
