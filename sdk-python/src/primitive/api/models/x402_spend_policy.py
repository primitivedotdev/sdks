from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID






T = TypeVar("T", bound="X402SpendPolicy")



@_attrs_define
class X402SpendPolicy:
    """ The payer's outbound spend policy. Returned with defaults (not paused,
    no caps, any on-net payee) when none is set.

        Attributes:
            paused (bool): Kill-switch. When true, all outbound payments are refused.
            max_per_payment (None | str): Per-payment cap in token base units, or null for no cap.
            max_per_day (None | str): Rolling-day cap in token base units, or null for no cap.
            allowlist (list[UUID] | None): Allowed payee org ids. `null` allows any on-net payee; `[]` denies
                all.
     """

    paused: bool
    max_per_payment: None | str
    max_per_day: None | str
    allowlist: list[UUID] | None
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        paused = self.paused

        max_per_payment: None | str
        max_per_payment = self.max_per_payment

        max_per_day: None | str
        max_per_day = self.max_per_day

        allowlist: list[str] | None
        if isinstance(self.allowlist, list):
            allowlist = []
            for allowlist_type_0_item_data in self.allowlist:
                allowlist_type_0_item = str(allowlist_type_0_item_data)
                allowlist.append(allowlist_type_0_item)


        else:
            allowlist = self.allowlist


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "paused": paused,
            "max_per_payment": max_per_payment,
            "max_per_day": max_per_day,
            "allowlist": allowlist,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        paused = d.pop("paused")

        def _parse_max_per_payment(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        max_per_payment = _parse_max_per_payment(d.pop("max_per_payment"))


        def _parse_max_per_day(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        max_per_day = _parse_max_per_day(d.pop("max_per_day"))


        def _parse_allowlist(data: object) -> list[UUID] | None:
            if data is None:
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                allowlist_type_0 = []
                _allowlist_type_0 = data
                for allowlist_type_0_item_data in (_allowlist_type_0):
                    allowlist_type_0_item = UUID(allowlist_type_0_item_data)



                    allowlist_type_0.append(allowlist_type_0_item)

                return allowlist_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[UUID] | None, data)

        allowlist = _parse_allowlist(d.pop("allowlist"))


        x402_spend_policy = cls(
            paused=paused,
            max_per_payment=max_per_payment,
            max_per_day=max_per_day,
            allowlist=allowlist,
        )


        x402_spend_policy.additional_properties = d
        return x402_spend_policy

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
