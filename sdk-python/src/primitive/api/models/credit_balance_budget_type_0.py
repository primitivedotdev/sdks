from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from dateutil.parser import isoparse
from typing import cast
import datetime






T = TypeVar("T", bound="CreditBalanceBudgetType0")



@_attrs_define
class CreditBalanceBudgetType0:
    """ The active agent spending budget an operator funded for top-ups,
    or null when there is none.

        Attributes:
            currency (str): Currency of the budget, for example `usd`.
            max_amount_micros (str): Total allowance the operator funded, in micros.
            spent_micros (str): How much of the allowance has been drawn down, in micros.
            remaining_micros (str): `max_amount_micros - spent_micros`, floored at zero.
            per_topup_cap_micros (None | str): Largest single top-up allowed, in micros, or null for no per-top-up cap.
            expires_at (datetime.datetime | None): When the allowance expires, or null for no expiry.
            status (str): Budget status. An active budget reads `active`.
     """

    currency: str
    max_amount_micros: str
    spent_micros: str
    remaining_micros: str
    per_topup_cap_micros: None | str
    expires_at: datetime.datetime | None
    status: str





    def to_dict(self) -> dict[str, Any]:
        currency = self.currency

        max_amount_micros = self.max_amount_micros

        spent_micros = self.spent_micros

        remaining_micros = self.remaining_micros

        per_topup_cap_micros: None | str
        per_topup_cap_micros = self.per_topup_cap_micros

        expires_at: None | str
        if isinstance(self.expires_at, datetime.datetime):
            expires_at = self.expires_at.isoformat()
        else:
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


        status = d.pop("status")

        credit_balance_budget_type_0 = cls(
            currency=currency,
            max_amount_micros=max_amount_micros,
            spent_micros=spent_micros,
            remaining_micros=remaining_micros,
            per_topup_cap_micros=per_topup_cap_micros,
            expires_at=expires_at,
            status=status,
        )

        return credit_balance_budget_type_0

