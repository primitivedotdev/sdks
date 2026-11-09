from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="MarkThreadReadResult")



@_attrs_define
class MarkThreadReadResult:
    """ 
        Attributes:
            thread_id (UUID):
            last_read_at (datetime.datetime | None): Arrival time of the newest message the member has read in this thread,
                in microsecond UTC form, or null when the member never marked it. Sending it back as `up_to` names the same
                instant; a timestamp cursor covers every message that arrived at that instant, so it is at or ahead of an id
                cursor at the same instant.
            last_read_email_id (None | UUID): The email or sent email the cursor was set from, or null (never marked, or
                marked by `up_to`).
            unread_count (int | None): Inbound mail in the thread that arrived after the cursor, counting only mail from
                others: informational signals (`fyi: true`, such as read and acknowledgement notices) and mail the member sent
                from their own address are not counted. A thread the member never marked counts all of it. Null only together
                with `state_unavailable`.
            updated_at (datetime.datetime | None): When the cursor last moved, or null when it never did. Orders the
                `updated_since` change feed.
            advanced (bool): False when the request named a position at or behind the stored cursor, so nothing changed.
            state_unavailable (bool | Unset): Present only when the cursor write committed but the unread count could not be
                read afterwards. The cursor fields are the committed ones and `unread_count` is null: treat the write as done
                and read the count later from `GET /threads/read-state` rather than retrying the write.
     """

    thread_id: UUID
    last_read_at: datetime.datetime | None
    last_read_email_id: None | UUID
    unread_count: int | None
    updated_at: datetime.datetime | None
    advanced: bool
    state_unavailable: bool | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        thread_id = str(self.thread_id)

        last_read_at: None | str
        if isinstance(self.last_read_at, datetime.datetime):
            last_read_at = self.last_read_at.isoformat()
        else:
            last_read_at = self.last_read_at

        last_read_email_id: None | str
        if isinstance(self.last_read_email_id, UUID):
            last_read_email_id = str(self.last_read_email_id)
        else:
            last_read_email_id = self.last_read_email_id

        unread_count: int | None
        unread_count = self.unread_count

        updated_at: None | str
        if isinstance(self.updated_at, datetime.datetime):
            updated_at = self.updated_at.isoformat()
        else:
            updated_at = self.updated_at

        advanced = self.advanced

        state_unavailable = self.state_unavailable


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "thread_id": thread_id,
            "last_read_at": last_read_at,
            "last_read_email_id": last_read_email_id,
            "unread_count": unread_count,
            "updated_at": updated_at,
            "advanced": advanced,
        })
        if state_unavailable is not UNSET:
            field_dict["state_unavailable"] = state_unavailable

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        thread_id = UUID(d.pop("thread_id"))




        def _parse_last_read_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                last_read_at_type_0 = datetime.datetime.fromisoformat(data)



                return last_read_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        last_read_at = _parse_last_read_at(d.pop("last_read_at"))


        def _parse_last_read_email_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                last_read_email_id_type_0 = UUID(data)



                return last_read_email_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        last_read_email_id = _parse_last_read_email_id(d.pop("last_read_email_id"))


        def _parse_unread_count(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        unread_count = _parse_unread_count(d.pop("unread_count"))


        def _parse_updated_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                updated_at_type_0 = datetime.datetime.fromisoformat(data)



                return updated_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        updated_at = _parse_updated_at(d.pop("updated_at"))


        advanced = d.pop("advanced")

        state_unavailable = d.pop("state_unavailable", UNSET)

        mark_thread_read_result = cls(
            thread_id=thread_id,
            last_read_at=last_read_at,
            last_read_email_id=last_read_email_id,
            unread_count=unread_count,
            updated_at=updated_at,
            advanced=advanced,
            state_unavailable=state_unavailable,
        )


        mark_thread_read_result.additional_properties = d
        return mark_thread_read_result

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
