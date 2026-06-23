from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID






T = TypeVar("T", bound="UpdateSpendPolicyInput")



@_attrs_define
class UpdateSpendPolicyInput:
    """ Merge update: only the fields you include change; omit a field to keep
    its current value; send `null` to clear a cap.

        Attributes:
            paused (bool | Unset):
            max_per_payment (None | str | Unset):
            max_per_day (None | str | Unset):
            allowlist (list[UUID] | None | Unset):
     """

    paused: bool | Unset = UNSET
    max_per_payment: None | str | Unset = UNSET
    max_per_day: None | str | Unset = UNSET
    allowlist: list[UUID] | None | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        paused = self.paused

        max_per_payment: None | str | Unset
        if isinstance(self.max_per_payment, Unset):
            max_per_payment = UNSET
        else:
            max_per_payment = self.max_per_payment

        max_per_day: None | str | Unset
        if isinstance(self.max_per_day, Unset):
            max_per_day = UNSET
        else:
            max_per_day = self.max_per_day

        allowlist: list[str] | None | Unset
        if isinstance(self.allowlist, Unset):
            allowlist = UNSET
        elif isinstance(self.allowlist, list):
            allowlist = []
            for allowlist_type_0_item_data in self.allowlist:
                allowlist_type_0_item = str(allowlist_type_0_item_data)
                allowlist.append(allowlist_type_0_item)


        else:
            allowlist = self.allowlist


        field_dict: dict[str, Any] = {}

        field_dict.update({
        })
        if paused is not UNSET:
            field_dict["paused"] = paused
        if max_per_payment is not UNSET:
            field_dict["max_per_payment"] = max_per_payment
        if max_per_day is not UNSET:
            field_dict["max_per_day"] = max_per_day
        if allowlist is not UNSET:
            field_dict["allowlist"] = allowlist

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        paused = d.pop("paused", UNSET)

        def _parse_max_per_payment(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        max_per_payment = _parse_max_per_payment(d.pop("max_per_payment", UNSET))


        def _parse_max_per_day(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        max_per_day = _parse_max_per_day(d.pop("max_per_day", UNSET))


        def _parse_allowlist(data: object) -> list[UUID] | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
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
            return cast(list[UUID] | None | Unset, data)

        allowlist = _parse_allowlist(d.pop("allowlist", UNSET))


        update_spend_policy_input = cls(
            paused=paused,
            max_per_payment=max_per_payment,
            max_per_day=max_per_day,
            allowlist=allowlist,
        )

        return update_spend_policy_input

