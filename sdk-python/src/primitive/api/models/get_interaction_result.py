from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.get_interaction_result_steps_item import GetInteractionResultStepsItem





T = TypeVar("T", bound="GetInteractionResult")



@_attrs_define
class GetInteractionResult:
    """ 
        Attributes:
            id (UUID):
            wire_id (str):
            role (str):
            protocol (str):
            protocol_version (int):
            state (str):
            outcome (None | str):
            failure_reason (None | str):
            awaiting (None | str):
            counterparty_address (str):
            counterparty_domain (str):
            our_address (str):
            step_count (int):
            expires_at (None | str):
            created_at (str):
            updated_at (str):
            completed_at (None | str):
            failure_detail (None | str):
            steps (list[GetInteractionResultStepsItem]):
     """

    id: UUID
    wire_id: str
    role: str
    protocol: str
    protocol_version: int
    state: str
    outcome: None | str
    failure_reason: None | str
    awaiting: None | str
    counterparty_address: str
    counterparty_domain: str
    our_address: str
    step_count: int
    expires_at: None | str
    created_at: str
    updated_at: str
    completed_at: None | str
    failure_detail: None | str
    steps: list[GetInteractionResultStepsItem]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.get_interaction_result_steps_item import GetInteractionResultStepsItem # noqa: PLC0415
        id = str(self.id)

        wire_id = self.wire_id

        role = self.role

        protocol = self.protocol

        protocol_version = self.protocol_version

        state = self.state

        outcome: None | str
        outcome = self.outcome

        failure_reason: None | str
        failure_reason = self.failure_reason

        awaiting: None | str
        awaiting = self.awaiting

        counterparty_address = self.counterparty_address

        counterparty_domain = self.counterparty_domain

        our_address = self.our_address

        step_count = self.step_count

        expires_at: None | str
        expires_at = self.expires_at

        created_at = self.created_at

        updated_at = self.updated_at

        completed_at: None | str
        completed_at = self.completed_at

        failure_detail: None | str
        failure_detail = self.failure_detail

        steps = []
        for steps_item_data in self.steps:
            steps_item = steps_item_data.to_dict()
            steps.append(steps_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "wire_id": wire_id,
            "role": role,
            "protocol": protocol,
            "protocol_version": protocol_version,
            "state": state,
            "outcome": outcome,
            "failure_reason": failure_reason,
            "awaiting": awaiting,
            "counterparty_address": counterparty_address,
            "counterparty_domain": counterparty_domain,
            "our_address": our_address,
            "step_count": step_count,
            "expires_at": expires_at,
            "created_at": created_at,
            "updated_at": updated_at,
            "completed_at": completed_at,
            "failure_detail": failure_detail,
            "steps": steps,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.get_interaction_result_steps_item import GetInteractionResultStepsItem # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        wire_id = d.pop("wire_id")

        role = d.pop("role")

        protocol = d.pop("protocol")

        protocol_version = d.pop("protocol_version")

        state = d.pop("state")

        def _parse_outcome(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        outcome = _parse_outcome(d.pop("outcome"))


        def _parse_failure_reason(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        failure_reason = _parse_failure_reason(d.pop("failure_reason"))


        def _parse_awaiting(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        awaiting = _parse_awaiting(d.pop("awaiting"))


        counterparty_address = d.pop("counterparty_address")

        counterparty_domain = d.pop("counterparty_domain")

        our_address = d.pop("our_address")

        step_count = d.pop("step_count")

        def _parse_expires_at(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        expires_at = _parse_expires_at(d.pop("expires_at"))


        created_at = d.pop("created_at")

        updated_at = d.pop("updated_at")

        def _parse_completed_at(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        completed_at = _parse_completed_at(d.pop("completed_at"))


        def _parse_failure_detail(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        failure_detail = _parse_failure_detail(d.pop("failure_detail"))


        steps = []
        _steps = d.pop("steps")
        for steps_item_data in (_steps):
            steps_item = GetInteractionResultStepsItem.from_dict(steps_item_data)



            steps.append(steps_item)


        get_interaction_result = cls(
            id=id,
            wire_id=wire_id,
            role=role,
            protocol=protocol,
            protocol_version=protocol_version,
            state=state,
            outcome=outcome,
            failure_reason=failure_reason,
            awaiting=awaiting,
            counterparty_address=counterparty_address,
            counterparty_domain=counterparty_domain,
            our_address=our_address,
            step_count=step_count,
            expires_at=expires_at,
            created_at=created_at,
            updated_at=updated_at,
            completed_at=completed_at,
            failure_detail=failure_detail,
            steps=steps,
        )


        get_interaction_result.additional_properties = d
        return get_interaction_result

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
