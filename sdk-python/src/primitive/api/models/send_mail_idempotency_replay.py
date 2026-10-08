from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.send_mail_idempotency_replay_key_source import SendMailIdempotencyReplayKeySource
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="SendMailIdempotencyReplay")



@_attrs_define
class SendMailIdempotencyReplay:
    """ Present only when the request was answered with an existing send
    instead of making a new one (`idempotent_replay: true`). Nothing
    was sent for this request. Says how the idempotency key was
    derived and which send the request collapsed onto. On the replay
    of a stored failure the same object is under `error.details`.

        Attributes:
            replayed (bool): Always `true`. The object is absent on a request that made a send of its own.
            key_source (SendMailIdempotencyReplayKeySource): `explicit`: the request carried an `Idempotency-Key` header.
                `auto_content`: no header was sent, so the key was derived
                from the canonical request content (recipients included) and
                a fixed 5-minute window; an identical send inside the same
                window was not sent again. `function_trigger`: no header on a
                send made by a Function, so the key was derived from the
                content, the Function and the inbound email (or event) that
                invoked it.
            original_sent_email_id (UUID): The send this request collapsed onto. Same value as `id`.
            original_created_at (datetime.datetime | None): When that send was created.
            window_seconds (int | None): Length of the content window (300) when an `auto_content`
                key matched on content. Null for `explicit` and
                `function_trigger` keys, which have no window, and for a
                keyless reply matched because its parent already has a reply
                (`dedup_reason: parent_already_replied`).
     """

    replayed: bool
    key_source: SendMailIdempotencyReplayKeySource
    original_sent_email_id: UUID
    original_created_at: datetime.datetime | None
    window_seconds: int | None
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        replayed = self.replayed

        key_source = self.key_source.value

        original_sent_email_id = str(self.original_sent_email_id)

        original_created_at: None | str
        if isinstance(self.original_created_at, datetime.datetime):
            original_created_at = self.original_created_at.isoformat()
        else:
            original_created_at = self.original_created_at

        window_seconds: int | None
        window_seconds = self.window_seconds


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "replayed": replayed,
            "key_source": key_source,
            "original_sent_email_id": original_sent_email_id,
            "original_created_at": original_created_at,
            "window_seconds": window_seconds,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        replayed = d.pop("replayed")

        key_source = SendMailIdempotencyReplayKeySource(d.pop("key_source"))




        original_sent_email_id = UUID(d.pop("original_sent_email_id"))




        def _parse_original_created_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                original_created_at_type_0 = datetime.datetime.fromisoformat(data)



                return original_created_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        original_created_at = _parse_original_created_at(d.pop("original_created_at"))


        def _parse_window_seconds(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        window_seconds = _parse_window_seconds(d.pop("window_seconds"))


        send_mail_idempotency_replay = cls(
            replayed=replayed,
            key_source=key_source,
            original_sent_email_id=original_sent_email_id,
            original_created_at=original_created_at,
            window_seconds=window_seconds,
        )


        send_mail_idempotency_replay.additional_properties = d
        return send_mail_idempotency_replay

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
