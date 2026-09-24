from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from dateutil.parser import isoparse
from typing import cast
import datetime






T = TypeVar("T", bound="CreditRedemption")



@_attrs_define
class CreditRedemption:
    """ 
        Attributes:
            redemption_id (str): Identifier of the redemption.
            amount_micros (str): Credit granted, in micros of `currency` (1 USD = 1000000 micros).
            currency (str): Currency of the granted credit, for example `usd`.
            granted_at (datetime.datetime): When the credit was granted.
            expires_at (datetime.datetime | None): When the granted credit expires, or null when it does not expire.
            label (None | str): Customer-facing label of the promotion, when it has one.
            replayed (bool): True when this Idempotency-Key already redeemed this code and the
                original grant is returned. No second grant is made.
            message (str): Human-readable summary of the grant, suitable to show as is.
     """

    redemption_id: str
    amount_micros: str
    currency: str
    granted_at: datetime.datetime
    expires_at: datetime.datetime | None
    label: None | str
    replayed: bool
    message: str





    def to_dict(self) -> dict[str, Any]:
        redemption_id = self.redemption_id

        amount_micros = self.amount_micros

        currency = self.currency

        granted_at = self.granted_at.isoformat()

        expires_at: None | str
        if isinstance(self.expires_at, datetime.datetime):
            expires_at = self.expires_at.isoformat()
        else:
            expires_at = self.expires_at

        label: None | str
        label = self.label

        replayed = self.replayed

        message = self.message


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "redemption_id": redemption_id,
            "amount_micros": amount_micros,
            "currency": currency,
            "granted_at": granted_at,
            "expires_at": expires_at,
            "label": label,
            "replayed": replayed,
            "message": message,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        redemption_id = d.pop("redemption_id")

        amount_micros = d.pop("amount_micros")

        currency = d.pop("currency")

        granted_at = isoparse(d.pop("granted_at"))




        def _parse_expires_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                expires_at_type_0 = isoparse(data)



                return expires_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        expires_at = _parse_expires_at(d.pop("expires_at"))


        def _parse_label(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        label = _parse_label(d.pop("label"))


        replayed = d.pop("replayed")

        message = d.pop("message")

        credit_redemption = cls(
            redemption_id=redemption_id,
            amount_micros=amount_micros,
            currency=currency,
            granted_at=granted_at,
            expires_at=expires_at,
            label=label,
            replayed=replayed,
            message=message,
        )

        return credit_redemption

