from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="WakeDispatch")



@_attrs_define
class WakeDispatch:
    """ A recorded wake.dispatch interaction (audit row).

        Attributes:
            id (UUID):
            wire_id (str):
            role (str):
            state (str):
            counterparty_address (str):
            our_address (str):
            created_at (datetime.datetime):
            outcome (None | str | Unset):
            awaiting (None | str | Unset):
            step_count (int | Unset):
            completed_at (datetime.datetime | None | Unset):
     """

    id: UUID
    wire_id: str
    role: str
    state: str
    counterparty_address: str
    our_address: str
    created_at: datetime.datetime
    outcome: None | str | Unset = UNSET
    awaiting: None | str | Unset = UNSET
    step_count: int | Unset = UNSET
    completed_at: datetime.datetime | None | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        wire_id = self.wire_id

        role = self.role

        state = self.state

        counterparty_address = self.counterparty_address

        our_address = self.our_address

        created_at = self.created_at.isoformat()

        outcome: None | str | Unset
        if isinstance(self.outcome, Unset):
            outcome = UNSET
        else:
            outcome = self.outcome

        awaiting: None | str | Unset
        if isinstance(self.awaiting, Unset):
            awaiting = UNSET
        else:
            awaiting = self.awaiting

        step_count = self.step_count

        completed_at: None | str | Unset
        if isinstance(self.completed_at, Unset):
            completed_at = UNSET
        elif isinstance(self.completed_at, datetime.datetime):
            completed_at = self.completed_at.isoformat()
        else:
            completed_at = self.completed_at


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "wire_id": wire_id,
            "role": role,
            "state": state,
            "counterparty_address": counterparty_address,
            "our_address": our_address,
            "created_at": created_at,
        })
        if outcome is not UNSET:
            field_dict["outcome"] = outcome
        if awaiting is not UNSET:
            field_dict["awaiting"] = awaiting
        if step_count is not UNSET:
            field_dict["step_count"] = step_count
        if completed_at is not UNSET:
            field_dict["completed_at"] = completed_at

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        wire_id = d.pop("wire_id")

        role = d.pop("role")

        state = d.pop("state")

        counterparty_address = d.pop("counterparty_address")

        our_address = d.pop("our_address")

        created_at = isoparse(d.pop("created_at"))




        def _parse_outcome(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        outcome = _parse_outcome(d.pop("outcome", UNSET))


        def _parse_awaiting(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        awaiting = _parse_awaiting(d.pop("awaiting", UNSET))


        step_count = d.pop("step_count", UNSET)

        def _parse_completed_at(data: object) -> datetime.datetime | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                completed_at_type_0 = isoparse(data)



                return completed_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None | Unset, data)

        completed_at = _parse_completed_at(d.pop("completed_at", UNSET))


        wake_dispatch = cls(
            id=id,
            wire_id=wire_id,
            role=role,
            state=state,
            counterparty_address=counterparty_address,
            our_address=our_address,
            created_at=created_at,
            outcome=outcome,
            awaiting=awaiting,
            step_count=step_count,
            completed_at=completed_at,
        )


        wake_dispatch.additional_properties = d
        return wake_dispatch

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
