from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.agent_message_schedule_stop_status import AgentMessageScheduleStopStatus
from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="AgentMessageScheduleStop")



@_attrs_define
class AgentMessageScheduleStop:
    """ 
        Attributes:
            schedule_id (UUID):
            status (AgentMessageScheduleStopStatus):
            stopped_at (datetime.datetime):
            stop_reason (None | str):
            reply_sent_email_id (None | str | Unset): The sent email that carried the stop to the owner, when one was sent.
     """

    schedule_id: UUID
    status: AgentMessageScheduleStopStatus
    stopped_at: datetime.datetime
    stop_reason: None | str
    reply_sent_email_id: None | str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        schedule_id = str(self.schedule_id)

        status = self.status.value

        stopped_at = self.stopped_at.isoformat()

        stop_reason: None | str
        stop_reason = self.stop_reason

        reply_sent_email_id: None | str | Unset
        if isinstance(self.reply_sent_email_id, Unset):
            reply_sent_email_id = UNSET
        else:
            reply_sent_email_id = self.reply_sent_email_id


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "schedule_id": schedule_id,
            "status": status,
            "stopped_at": stopped_at,
            "stop_reason": stop_reason,
        })
        if reply_sent_email_id is not UNSET:
            field_dict["reply_sent_email_id"] = reply_sent_email_id

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        schedule_id = UUID(d.pop("schedule_id"))




        status = AgentMessageScheduleStopStatus(d.pop("status"))




        stopped_at = isoparse(d.pop("stopped_at"))




        def _parse_stop_reason(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        stop_reason = _parse_stop_reason(d.pop("stop_reason"))


        def _parse_reply_sent_email_id(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        reply_sent_email_id = _parse_reply_sent_email_id(d.pop("reply_sent_email_id", UNSET))


        agent_message_schedule_stop = cls(
            schedule_id=schedule_id,
            status=status,
            stopped_at=stopped_at,
            stop_reason=stop_reason,
            reply_sent_email_id=reply_sent_email_id,
        )


        agent_message_schedule_stop.additional_properties = d
        return agent_message_schedule_stop

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
