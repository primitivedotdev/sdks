from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="PrepaidCredit")



@_attrs_define
class PrepaidCredit:
    """ Prepaid usage credit (top-ups, redeemed credit codes and granted
    credit) that can still pay for usage.

        Attributes:
            currency (str): Currency of the credit, which is the organization billing currency.
            remaining_micros (str): What the credit can still pay for, in micros.
            next_expires_at (None | str): Earliest expiry among credits with a balance, or null when none of them expires.
     """

    currency: str
    remaining_micros: str
    next_expires_at: None | str





    def to_dict(self) -> dict[str, Any]:
        currency = self.currency

        remaining_micros = self.remaining_micros

        next_expires_at: None | str
        next_expires_at = self.next_expires_at


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "currency": currency,
            "remaining_micros": remaining_micros,
            "next_expires_at": next_expires_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        currency = d.pop("currency")

        remaining_micros = d.pop("remaining_micros")

        def _parse_next_expires_at(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        next_expires_at = _parse_next_expires_at(d.pop("next_expires_at"))


        prepaid_credit = cls(
            currency=currency,
            remaining_micros=remaining_micros,
            next_expires_at=next_expires_at,
        )

        return prepaid_credit

