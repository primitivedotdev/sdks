from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="CreditSpendingBudget")



@_attrs_define
class CreditSpendingBudget:
    """ The active agent spending budget an operator funded for top-ups.

        Attributes:
            currency (str): Currency of the budget, for example `usd`.
            max_amount_micros (str): Total allowance the operator funded, in micros.
            spent_micros (str): How much of the allowance has been drawn down, in micros.
            remaining_micros (str): `max_amount_micros - spent_micros`, floored at zero.
            per_topup_cap_micros (None | str): Largest single top-up allowed, in micros, or null for no per-top-up cap.
            expires_at (None | str): When the allowance expires, or null for no expiry.
            status (str): Budget status. An active budget reads `active`.
     """

    currency: str
    max_amount_micros: str
    spent_micros: str
    remaining_micros: str
    per_topup_cap_micros: None | str
    expires_at: None | str
    status: str





    def to_dict(self) -> dict[str, Any]:
        currency = self.currency

        max_amount_micros = self.max_amount_micros

        spent_micros = self.spent_micros

        remaining_micros = self.remaining_micros

        per_topup_cap_micros: None | str
        per_topup_cap_micros = self.per_topup_cap_micros

        expires_at: None | str
        expires_at = self.expires_at

        status = self.status


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "currency": currency,
            "max_amount_micros": max_amount_micros,
            "spent_micros": spent_micros,
            "remaining_micros": remaining_micros,
            "per_topup_cap_micros": per_topup_cap_micros,
            "expires_at": expires_at,
            "status": status,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        currency = d.pop("currency")

        max_amount_micros = d.pop("max_amount_micros")

        spent_micros = d.pop("spent_micros")

        remaining_micros = d.pop("remaining_micros")

        def _parse_per_topup_cap_micros(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        per_topup_cap_micros = _parse_per_topup_cap_micros(d.pop("per_topup_cap_micros"))


        def _parse_expires_at(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        expires_at = _parse_expires_at(d.pop("expires_at"))


        status = d.pop("status")

        credit_spending_budget = cls(
            currency=currency,
            max_amount_micros=max_amount_micros,
            spent_micros=spent_micros,
            remaining_micros=remaining_micros,
            per_topup_cap_micros=per_topup_cap_micros,
            expires_at=expires_at,
            status=status,
        )

        return credit_spending_budget

