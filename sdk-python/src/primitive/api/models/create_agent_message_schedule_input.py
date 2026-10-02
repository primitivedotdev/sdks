from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="CreateAgentMessageScheduleInput")



@_attrs_define
class CreateAgentMessageScheduleInput:
    """ 
        Attributes:
            agent_address (str): A connected agent address in your org.
            body_text (str): The message sent on every run.
            interval_minutes (int):
            subject (str | Unset): Subject of the schedule's thread. Defaults to "Scheduled message".
            idle_minutes (int | None | Unset): Only send after this many minutes without activity from the agent.
            agent_can_stop (bool | Unset): Let the agent stop the schedule. Default: True.
     """

    agent_address: str
    body_text: str
    interval_minutes: int
    subject: str | Unset = UNSET
    idle_minutes: int | None | Unset = UNSET
    agent_can_stop: bool | Unset = True





    def to_dict(self) -> dict[str, Any]:
        agent_address = self.agent_address

        body_text = self.body_text

        interval_minutes = self.interval_minutes

        subject = self.subject

        idle_minutes: int | None | Unset
        if isinstance(self.idle_minutes, Unset):
            idle_minutes = UNSET
        else:
            idle_minutes = self.idle_minutes

        agent_can_stop = self.agent_can_stop


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "agent_address": agent_address,
            "body_text": body_text,
            "interval_minutes": interval_minutes,
        })
        if subject is not UNSET:
            field_dict["subject"] = subject
        if idle_minutes is not UNSET:
            field_dict["idle_minutes"] = idle_minutes
        if agent_can_stop is not UNSET:
            field_dict["agent_can_stop"] = agent_can_stop

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        agent_address = d.pop("agent_address")

        body_text = d.pop("body_text")

        interval_minutes = d.pop("interval_minutes")

        subject = d.pop("subject", UNSET)

        def _parse_idle_minutes(data: object) -> int | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(int | None | Unset, data)

        idle_minutes = _parse_idle_minutes(d.pop("idle_minutes", UNSET))


        agent_can_stop = d.pop("agent_can_stop", UNSET)

        create_agent_message_schedule_input = cls(
            agent_address=agent_address,
            body_text=body_text,
            interval_minutes=interval_minutes,
            subject=subject,
            idle_minutes=idle_minutes,
            agent_can_stop=agent_can_stop,
        )

        return create_agent_message_schedule_input

