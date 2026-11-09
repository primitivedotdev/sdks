from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID






T = TypeVar("T", bound="SendInteractionStepResult")



@_attrs_define
class SendInteractionStepResult:
    """ 
        Attributes:
            interaction_id (UUID):
            wire_id (str):
            step_id (str):
            state (str):
            events (list[str]):
            send_id (None | str | Unset):
            failure_reason (None | str | Unset):
     """

    interaction_id: UUID
    wire_id: str
    step_id: str
    state: str
    events: list[str]
    send_id: None | str | Unset = UNSET
    failure_reason: None | str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        interaction_id = str(self.interaction_id)

        wire_id = self.wire_id

        step_id = self.step_id

        state = self.state

        events = self.events



        send_id: None | str | Unset
        if isinstance(self.send_id, Unset):
            send_id = UNSET
        else:
            send_id = self.send_id

        failure_reason: None | str | Unset
        if isinstance(self.failure_reason, Unset):
            failure_reason = UNSET
        else:
            failure_reason = self.failure_reason


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "interaction_id": interaction_id,
            "wire_id": wire_id,
            "step_id": step_id,
            "state": state,
            "events": events,
        })
        if send_id is not UNSET:
            field_dict["send_id"] = send_id
        if failure_reason is not UNSET:
            field_dict["failure_reason"] = failure_reason

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        interaction_id = UUID(d.pop("interaction_id"))




        wire_id = d.pop("wire_id")

        step_id = d.pop("step_id")

        state = d.pop("state")

        events = cast(list[str], d.pop("events"))


        def _parse_send_id(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        send_id = _parse_send_id(d.pop("send_id", UNSET))


        def _parse_failure_reason(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        failure_reason = _parse_failure_reason(d.pop("failure_reason", UNSET))


        send_interaction_step_result = cls(
            interaction_id=interaction_id,
            wire_id=wire_id,
            step_id=step_id,
            state=state,
            events=events,
            send_id=send_id,
            failure_reason=failure_reason,
        )


        send_interaction_step_result.additional_properties = d
        return send_interaction_step_result

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
