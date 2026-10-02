from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.update_agent_message_schedule_input_status import UpdateAgentMessageScheduleInputStatus
from typing import cast






T = TypeVar("T", bound="UpdateAgentMessageScheduleInput")



@_attrs_define
class UpdateAgentMessageScheduleInput:
    """ 
        Attributes:
            status (UpdateAgentMessageScheduleInputStatus | Unset):
            subject (str | Unset):
            body_text (str | Unset):
            interval_minutes (int | Unset):
            idle_minutes (int | None | Unset):
            agent_can_stop (bool | Unset):
     """

    status: UpdateAgentMessageScheduleInputStatus | Unset = UNSET
    subject: str | Unset = UNSET
    body_text: str | Unset = UNSET
    interval_minutes: int | Unset = UNSET
    idle_minutes: int | None | Unset = UNSET
    agent_can_stop: bool | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        status: str | Unset = UNSET
        if not isinstance(self.status, Unset):
            status = self.status.value


        subject = self.subject

        body_text = self.body_text

        interval_minutes = self.interval_minutes

        idle_minutes: int | None | Unset
        if isinstance(self.idle_minutes, Unset):
            idle_minutes = UNSET
        else:
            idle_minutes = self.idle_minutes

        agent_can_stop = self.agent_can_stop


        field_dict: dict[str, Any] = {}

        field_dict.update({
        })
        if status is not UNSET:
            field_dict["status"] = status
        if subject is not UNSET:
            field_dict["subject"] = subject
        if body_text is not UNSET:
            field_dict["body_text"] = body_text
        if interval_minutes is not UNSET:
            field_dict["interval_minutes"] = interval_minutes
        if idle_minutes is not UNSET:
            field_dict["idle_minutes"] = idle_minutes
        if agent_can_stop is not UNSET:
            field_dict["agent_can_stop"] = agent_can_stop

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        _status = d.pop("status", UNSET)
        status: UpdateAgentMessageScheduleInputStatus | Unset
        if isinstance(_status,  Unset):
            status = UNSET
        else:
            status = UpdateAgentMessageScheduleInputStatus(_status)




        subject = d.pop("subject", UNSET)

        body_text = d.pop("body_text", UNSET)

        interval_minutes = d.pop("interval_minutes", UNSET)

        def _parse_idle_minutes(data: object) -> int | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(int | None | Unset, data)

        idle_minutes = _parse_idle_minutes(d.pop("idle_minutes", UNSET))


        agent_can_stop = d.pop("agent_can_stop", UNSET)

        update_agent_message_schedule_input = cls(
            status=status,
            subject=subject,
            body_text=body_text,
            interval_minutes=interval_minutes,
            idle_minutes=idle_minutes,
            agent_can_stop=agent_can_stop,
        )

        return update_agent_message_schedule_input

