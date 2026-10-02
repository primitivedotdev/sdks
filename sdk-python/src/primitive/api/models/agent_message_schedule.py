from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.agent_message_schedule_status import AgentMessageScheduleStatus
from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="AgentMessageSchedule")



@_attrs_define
class AgentMessageSchedule:
    """ A recurring message from an org member to a connected agent.

        Attributes:
            id (UUID):
            agent_address (str): The connected agent address the messages are sent to.
            body_text (str):
            interval_minutes (int):
            idle_minutes (int | None): When set, a due message is skipped while the agent has been
                active within this many minutes. Null sends on every interval.
            agent_can_stop (bool): Whether the agent may stop the schedule.
            status (AgentMessageScheduleStatus): `active` schedules send when due. `paused` schedules keep their
                settings and can be resumed. A stopped schedule sends nothing until
                the owner sets it active again.
            org_id (UUID | Unset):
            user_id (UUID | Unset): The member who owns the schedule.
            from_address (str | Unset): The member's personal address the messages are sent from.
            subject (None | str | Unset):
            next_run_at (datetime.datetime | None | Unset):
            last_sent_at (datetime.datetime | None | Unset):
            last_sent_email_id (None | str | Unset):
            root_message_id (None | str | Unset): Message-ID of the first message in the schedule's thread.
            sent_count (int | Unset):
            stopped_at (datetime.datetime | None | Unset):
            stop_reason (None | str | Unset): Reason the agent gave when it stopped the schedule. Agent-written, untrusted
                text.
            created_at (datetime.datetime | Unset):
            updated_at (datetime.datetime | Unset):
     """

    id: UUID
    agent_address: str
    body_text: str
    interval_minutes: int
    idle_minutes: int | None
    agent_can_stop: bool
    status: AgentMessageScheduleStatus
    org_id: UUID | Unset = UNSET
    user_id: UUID | Unset = UNSET
    from_address: str | Unset = UNSET
    subject: None | str | Unset = UNSET
    next_run_at: datetime.datetime | None | Unset = UNSET
    last_sent_at: datetime.datetime | None | Unset = UNSET
    last_sent_email_id: None | str | Unset = UNSET
    root_message_id: None | str | Unset = UNSET
    sent_count: int | Unset = UNSET
    stopped_at: datetime.datetime | None | Unset = UNSET
    stop_reason: None | str | Unset = UNSET
    created_at: datetime.datetime | Unset = UNSET
    updated_at: datetime.datetime | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        agent_address = self.agent_address

        body_text = self.body_text

        interval_minutes = self.interval_minutes

        idle_minutes: int | None
        idle_minutes = self.idle_minutes

        agent_can_stop = self.agent_can_stop

        status = self.status.value

        org_id: str | Unset = UNSET
        if not isinstance(self.org_id, Unset):
            org_id = str(self.org_id)

        user_id: str | Unset = UNSET
        if not isinstance(self.user_id, Unset):
            user_id = str(self.user_id)

        from_address = self.from_address

        subject: None | str | Unset
        if isinstance(self.subject, Unset):
            subject = UNSET
        else:
            subject = self.subject

        next_run_at: None | str | Unset
        if isinstance(self.next_run_at, Unset):
            next_run_at = UNSET
        elif isinstance(self.next_run_at, datetime.datetime):
            next_run_at = self.next_run_at.isoformat()
        else:
            next_run_at = self.next_run_at

        last_sent_at: None | str | Unset
        if isinstance(self.last_sent_at, Unset):
            last_sent_at = UNSET
        elif isinstance(self.last_sent_at, datetime.datetime):
            last_sent_at = self.last_sent_at.isoformat()
        else:
            last_sent_at = self.last_sent_at

        last_sent_email_id: None | str | Unset
        if isinstance(self.last_sent_email_id, Unset):
            last_sent_email_id = UNSET
        else:
            last_sent_email_id = self.last_sent_email_id

        root_message_id: None | str | Unset
        if isinstance(self.root_message_id, Unset):
            root_message_id = UNSET
        else:
            root_message_id = self.root_message_id

        sent_count = self.sent_count

        stopped_at: None | str | Unset
        if isinstance(self.stopped_at, Unset):
            stopped_at = UNSET
        elif isinstance(self.stopped_at, datetime.datetime):
            stopped_at = self.stopped_at.isoformat()
        else:
            stopped_at = self.stopped_at

        stop_reason: None | str | Unset
        if isinstance(self.stop_reason, Unset):
            stop_reason = UNSET
        else:
            stop_reason = self.stop_reason

        created_at: str | Unset = UNSET
        if not isinstance(self.created_at, Unset):
            created_at = self.created_at.isoformat()

        updated_at: str | Unset = UNSET
        if not isinstance(self.updated_at, Unset):
            updated_at = self.updated_at.isoformat()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "agent_address": agent_address,
            "body_text": body_text,
            "interval_minutes": interval_minutes,
            "idle_minutes": idle_minutes,
            "agent_can_stop": agent_can_stop,
            "status": status,
        })
        if org_id is not UNSET:
            field_dict["org_id"] = org_id
        if user_id is not UNSET:
            field_dict["user_id"] = user_id
        if from_address is not UNSET:
            field_dict["from_address"] = from_address
        if subject is not UNSET:
            field_dict["subject"] = subject
        if next_run_at is not UNSET:
            field_dict["next_run_at"] = next_run_at
        if last_sent_at is not UNSET:
            field_dict["last_sent_at"] = last_sent_at
        if last_sent_email_id is not UNSET:
            field_dict["last_sent_email_id"] = last_sent_email_id
        if root_message_id is not UNSET:
            field_dict["root_message_id"] = root_message_id
        if sent_count is not UNSET:
            field_dict["sent_count"] = sent_count
        if stopped_at is not UNSET:
            field_dict["stopped_at"] = stopped_at
        if stop_reason is not UNSET:
            field_dict["stop_reason"] = stop_reason
        if created_at is not UNSET:
            field_dict["created_at"] = created_at
        if updated_at is not UNSET:
            field_dict["updated_at"] = updated_at

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        agent_address = d.pop("agent_address")

        body_text = d.pop("body_text")

        interval_minutes = d.pop("interval_minutes")

        def _parse_idle_minutes(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        idle_minutes = _parse_idle_minutes(d.pop("idle_minutes"))


        agent_can_stop = d.pop("agent_can_stop")

        status = AgentMessageScheduleStatus(d.pop("status"))




        _org_id = d.pop("org_id", UNSET)
        org_id: UUID | Unset
        if isinstance(_org_id,  Unset):
            org_id = UNSET
        else:
            org_id = UUID(_org_id)




        _user_id = d.pop("user_id", UNSET)
        user_id: UUID | Unset
        if isinstance(_user_id,  Unset):
            user_id = UNSET
        else:
            user_id = UUID(_user_id)




        from_address = d.pop("from_address", UNSET)

        def _parse_subject(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        subject = _parse_subject(d.pop("subject", UNSET))


        def _parse_next_run_at(data: object) -> datetime.datetime | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                next_run_at_type_0 = isoparse(data)



                return next_run_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None | Unset, data)

        next_run_at = _parse_next_run_at(d.pop("next_run_at", UNSET))


        def _parse_last_sent_at(data: object) -> datetime.datetime | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                last_sent_at_type_0 = isoparse(data)



                return last_sent_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None | Unset, data)

        last_sent_at = _parse_last_sent_at(d.pop("last_sent_at", UNSET))


        def _parse_last_sent_email_id(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        last_sent_email_id = _parse_last_sent_email_id(d.pop("last_sent_email_id", UNSET))


        def _parse_root_message_id(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        root_message_id = _parse_root_message_id(d.pop("root_message_id", UNSET))


        sent_count = d.pop("sent_count", UNSET)

        def _parse_stopped_at(data: object) -> datetime.datetime | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                stopped_at_type_0 = isoparse(data)



                return stopped_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None | Unset, data)

        stopped_at = _parse_stopped_at(d.pop("stopped_at", UNSET))


        def _parse_stop_reason(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        stop_reason = _parse_stop_reason(d.pop("stop_reason", UNSET))


        _created_at = d.pop("created_at", UNSET)
        created_at: datetime.datetime | Unset
        if isinstance(_created_at,  Unset):
            created_at = UNSET
        else:
            created_at = isoparse(_created_at)




        _updated_at = d.pop("updated_at", UNSET)
        updated_at: datetime.datetime | Unset
        if isinstance(_updated_at,  Unset):
            updated_at = UNSET
        else:
            updated_at = isoparse(_updated_at)




        agent_message_schedule = cls(
            id=id,
            agent_address=agent_address,
            body_text=body_text,
            interval_minutes=interval_minutes,
            idle_minutes=idle_minutes,
            agent_can_stop=agent_can_stop,
            status=status,
            org_id=org_id,
            user_id=user_id,
            from_address=from_address,
            subject=subject,
            next_run_at=next_run_at,
            last_sent_at=last_sent_at,
            last_sent_email_id=last_sent_email_id,
            root_message_id=root_message_id,
            sent_count=sent_count,
            stopped_at=stopped_at,
            stop_reason=stop_reason,
            created_at=created_at,
            updated_at=updated_at,
        )


        agent_message_schedule.additional_properties = d
        return agent_message_schedule

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
