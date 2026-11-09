from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime






T = TypeVar("T", bound="CreditBalancePrepaidCreditType0")



@_attrs_define
class CreditBalancePrepaidCreditType0:
    """ Prepaid usage credit (redeemed credit codes and granted credit) that can still pay for usage. Null when there is
    none. Omitted when an exact figure cannot be given right now; the rest of the balance is still returned.

        Attributes:
            currency (str): Currency of the credit, which is the organization billing currency.
            remaining_micros (str): What the credit can still pay for, in micros.
            next_expires_at (datetime.datetime | None): Earliest expiry among credits with a balance, or null when none of
                them expires.
     """

    currency: str
    remaining_micros: str
    next_expires_at: datetime.datetime | None
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        currency = self.currency

        remaining_micros = self.remaining_micros

        next_expires_at: None | str
        if isinstance(self.next_expires_at, datetime.datetime):
            next_expires_at = self.next_expires_at.isoformat()
        else:
            next_expires_at = self.next_expires_at


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
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

        def _parse_next_expires_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                next_expires_at_type_0 = datetime.datetime.fromisoformat(data)



                return next_expires_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        next_expires_at = _parse_next_expires_at(d.pop("next_expires_at"))


        credit_balance_prepaid_credit_type_0 = cls(
            currency=currency,
            remaining_micros=remaining_micros,
            next_expires_at=next_expires_at,
        )


        credit_balance_prepaid_credit_type_0.additional_properties = d
        return credit_balance_prepaid_credit_type_0

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
