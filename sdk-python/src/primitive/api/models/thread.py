from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.thread_message import ThreadMessage
  from ..models.thread_newer_inbound_item import ThreadNewerInboundItem





T = TypeVar("T", bound="Thread")



@_attrs_define
class Thread:
    """ A conversation thread: its metadata plus the inbound and
    outbound messages that belong to it, interleaved oldest-first.
    Membership is the stored `thread_id` on each message. Bodies are
    omitted here to keep the thread view lightweight; fetch
    `/emails/{id}` or `/sent-emails/{id}` for a single message's
    full content.

        Attributes:
            id (UUID):
            message_count (int): Messages in the thread you can read, each counted once however many mailboxes it reached.
                Exact unless the thread has more than 200 visible messages in one direction; then the value is greater than the
                messages the read returns, so `message_count > messages.length` marks an incomplete read. Past that point it is
                not a count: it can be the thread's stored total, which counts each mailbox copy, or only a marker that more
                exist.
            created_at (datetime.datetime):
            messages (list[ThreadMessage]):
            latest_inbound_id (None | UUID): The newest inbound email in the thread that you can read, by arrival time, or
                null when there is none. Fetch it with `/emails/{id}`.
            latest_outbound_id (None | UUID): The newest sent email in the thread that you can read and that went out or is
                committed to go, or null. Sends with status `gate_denied`, `agent_failed`, `canceled` never went out and are
                skipped. Fetch it with `/sent-emails/{id}`.
            subject (None | str | Unset): Normalized subject of the thread (Re/Fwd prefixes stripped).
            root_message_id (None | str | Unset): Message-ID of the conversation root, when known.
            first_message_at (datetime.datetime | None | Unset):
            last_message_at (datetime.datetime | None | Unset):
            newer_inbound_count (int | Unset): Present only when the request names `after`: how many inbound messages you
                can read in this thread arrived after that message, each counted once however many copies of it you can read.
                Not capped.
            newer_inbound (list[ThreadNewerInboundItem] | Unset): Present only when the request names `after`: the newest 20
                of the inbound emails counted by `newer_inbound_count`, oldest first, so the newest is last. Compare the count
                with the length to tell whether the list is complete.
     """

    id: UUID
    message_count: int
    created_at: datetime.datetime
    messages: list[ThreadMessage]
    latest_inbound_id: None | UUID
    latest_outbound_id: None | UUID
    subject: None | str | Unset = UNSET
    root_message_id: None | str | Unset = UNSET
    first_message_at: datetime.datetime | None | Unset = UNSET
    last_message_at: datetime.datetime | None | Unset = UNSET
    newer_inbound_count: int | Unset = UNSET
    newer_inbound: list[ThreadNewerInboundItem] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.thread_message import ThreadMessage # noqa: PLC0415
        from ..models.thread_newer_inbound_item import ThreadNewerInboundItem # noqa: PLC0415
        id = str(self.id)

        message_count = self.message_count

        created_at = self.created_at.isoformat()

        messages = []
        for messages_item_data in self.messages:
            messages_item = messages_item_data.to_dict()
            messages.append(messages_item)



        latest_inbound_id: None | str
        if isinstance(self.latest_inbound_id, UUID):
            latest_inbound_id = str(self.latest_inbound_id)
        else:
            latest_inbound_id = self.latest_inbound_id

        latest_outbound_id: None | str
        if isinstance(self.latest_outbound_id, UUID):
            latest_outbound_id = str(self.latest_outbound_id)
        else:
            latest_outbound_id = self.latest_outbound_id

        subject: None | str | Unset
        if isinstance(self.subject, Unset):
            subject = UNSET
        else:
            subject = self.subject

        root_message_id: None | str | Unset
        if isinstance(self.root_message_id, Unset):
            root_message_id = UNSET
        else:
            root_message_id = self.root_message_id

        first_message_at: None | str | Unset
        if isinstance(self.first_message_at, Unset):
            first_message_at = UNSET
        elif isinstance(self.first_message_at, datetime.datetime):
            first_message_at = self.first_message_at.isoformat()
        else:
            first_message_at = self.first_message_at

        last_message_at: None | str | Unset
        if isinstance(self.last_message_at, Unset):
            last_message_at = UNSET
        elif isinstance(self.last_message_at, datetime.datetime):
            last_message_at = self.last_message_at.isoformat()
        else:
            last_message_at = self.last_message_at

        newer_inbound_count = self.newer_inbound_count

        newer_inbound: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.newer_inbound, Unset):
            newer_inbound = []
            for newer_inbound_item_data in self.newer_inbound:
                newer_inbound_item = newer_inbound_item_data.to_dict()
                newer_inbound.append(newer_inbound_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "message_count": message_count,
            "created_at": created_at,
            "messages": messages,
            "latest_inbound_id": latest_inbound_id,
            "latest_outbound_id": latest_outbound_id,
        })
        if subject is not UNSET:
            field_dict["subject"] = subject
        if root_message_id is not UNSET:
            field_dict["root_message_id"] = root_message_id
        if first_message_at is not UNSET:
            field_dict["first_message_at"] = first_message_at
        if last_message_at is not UNSET:
            field_dict["last_message_at"] = last_message_at
        if newer_inbound_count is not UNSET:
            field_dict["newer_inbound_count"] = newer_inbound_count
        if newer_inbound is not UNSET:
            field_dict["newer_inbound"] = newer_inbound

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.thread_message import ThreadMessage # noqa: PLC0415
        from ..models.thread_newer_inbound_item import ThreadNewerInboundItem # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        message_count = d.pop("message_count")

        created_at = datetime.datetime.fromisoformat(d.pop("created_at"))




        messages = []
        _messages = d.pop("messages")
        for messages_item_data in (_messages):
            messages_item = ThreadMessage.from_dict(messages_item_data)



            messages.append(messages_item)


        def _parse_latest_inbound_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                latest_inbound_id_type_0 = UUID(data)



                return latest_inbound_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        latest_inbound_id = _parse_latest_inbound_id(d.pop("latest_inbound_id"))


        def _parse_latest_outbound_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                latest_outbound_id_type_0 = UUID(data)



                return latest_outbound_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        latest_outbound_id = _parse_latest_outbound_id(d.pop("latest_outbound_id"))


        def _parse_subject(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        subject = _parse_subject(d.pop("subject", UNSET))


        def _parse_root_message_id(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        root_message_id = _parse_root_message_id(d.pop("root_message_id", UNSET))


        def _parse_first_message_at(data: object) -> datetime.datetime | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                first_message_at_type_0 = datetime.datetime.fromisoformat(data)



                return first_message_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None | Unset, data)

        first_message_at = _parse_first_message_at(d.pop("first_message_at", UNSET))


        def _parse_last_message_at(data: object) -> datetime.datetime | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                last_message_at_type_0 = datetime.datetime.fromisoformat(data)



                return last_message_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None | Unset, data)

        last_message_at = _parse_last_message_at(d.pop("last_message_at", UNSET))


        newer_inbound_count = d.pop("newer_inbound_count", UNSET)

        _newer_inbound = d.pop("newer_inbound", UNSET)
        newer_inbound: list[ThreadNewerInboundItem] | Unset = UNSET
        if _newer_inbound is not UNSET:
            newer_inbound = []
            for newer_inbound_item_data in _newer_inbound:
                newer_inbound_item = ThreadNewerInboundItem.from_dict(newer_inbound_item_data)



                newer_inbound.append(newer_inbound_item)


        thread = cls(
            id=id,
            message_count=message_count,
            created_at=created_at,
            messages=messages,
            latest_inbound_id=latest_inbound_id,
            latest_outbound_id=latest_outbound_id,
            subject=subject,
            root_message_id=root_message_id,
            first_message_at=first_message_at,
            last_message_at=last_message_at,
            newer_inbound_count=newer_inbound_count,
            newer_inbound=newer_inbound,
        )


        thread.additional_properties = d
        return thread

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
