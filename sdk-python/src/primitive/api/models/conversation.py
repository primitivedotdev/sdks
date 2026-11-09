from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.conversation_message import ConversationMessage





T = TypeVar("T", bound="Conversation")



@_attrs_define
class Conversation:
    """ The full conversation an inbound email belongs to, as ordered,
    ready-to-prompt turns with bodies. Resolves the thread from the
    email and returns every message oldest-first, so an agent that
    received an email can pass `messages` straight to a chat model in
    one call.

        Attributes:
            thread_id (None | UUID): The thread this email belongs to, or null when the email
                isn't threaded yet (the conversation is then just this one
                message).
            messages (list[ConversationMessage]):
            subject (None | str | Unset): Normalized thread subject (Re/Fwd prefixes stripped), or the
                email's own subject when it isn't threaded.
            message_count (int | Unset): Messages in the thread you can read, each counted once however many mailboxes it
                reached. Exact unless the thread has more than 200 visible messages in one direction; then `truncated` is true
                and the value is greater than the messages a full read returns, so on a full read `message_count >
                messages.length` marks an incomplete read. Past that point it is not a count: it can be the thread's stored
                total, which counts each mailbox copy, or only a marker that more exist. Full, `since` and window reads report
                the same value.
            truncated (bool | Unset): True when `messages` omits part of the conversation because
                the thread exceeds the per-call cap. On a window read (`around`, `before` or `after`) it is true when the
                conversation has more messages on either side of the ones returned, that is `has_more_before` or
                `has_more_after`.
            cursor (str | Unset): Present only on a `since` read: the position to send as
                `since` on the next read. An opaque string: send it back
                verbatim and do not parse it or build one.
            latest_message_id (None | Unset | UUID): The id to pass as if_latest_message_id when replying in this
                conversation: the message that joined the thread last among those this credential can read, by the rule a
                conditional send checks. It can differ from the last message in `messages`, which is ordered by timestamp, when
                mail joined the thread after a newer-timestamped message. Present on a full read and a window read of a threaded
                conversation; null when no message in the thread is visible; absent on a `since` delta.
            has_more (bool | Unset): Present only on a `since` read: true when this delta stopped at its page size and
                `cursor` resumes it. Read again with `cursor` until it is false.
            before_cursor (str | Unset): Present only on a window read (`around`, `before` or `after`). The position of the
                oldest message returned (or the request's own cursor when none was). Send it as `before` to read older messages.
                Pass it back unchanged; its format may change.
            after_cursor (str | Unset): Present only on a window read (`around`, `before` or `after`). The position of the
                newest message returned (or the request's own cursor when none was). Send it as `after` to read newer messages.
                Pass it back unchanged; its format may change.
            has_more_before (bool | Unset): Present only on a window read (`around`, `before` or `after`). Whether the
                conversation has messages older than the oldest one returned.
            has_more_after (bool | Unset): Present only on a window read (`around`, `before` or `after`). Whether the
                conversation has messages newer than the newest one returned.
            quoted_chars_removed (int | Unset): Present only with `text=readable`: characters of quoted history removed from
                the messages in this response, in total.
     """

    thread_id: None | UUID
    messages: list[ConversationMessage]
    subject: None | str | Unset = UNSET
    message_count: int | Unset = UNSET
    truncated: bool | Unset = UNSET
    cursor: str | Unset = UNSET
    latest_message_id: None | Unset | UUID = UNSET
    has_more: bool | Unset = UNSET
    before_cursor: str | Unset = UNSET
    after_cursor: str | Unset = UNSET
    has_more_before: bool | Unset = UNSET
    has_more_after: bool | Unset = UNSET
    quoted_chars_removed: int | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.conversation_message import ConversationMessage # noqa: PLC0415
        thread_id: None | str
        if isinstance(self.thread_id, UUID):
            thread_id = str(self.thread_id)
        else:
            thread_id = self.thread_id

        messages = []
        for messages_item_data in self.messages:
            messages_item = messages_item_data.to_dict()
            messages.append(messages_item)



        subject: None | str | Unset
        if isinstance(self.subject, Unset):
            subject = UNSET
        else:
            subject = self.subject

        message_count = self.message_count

        truncated = self.truncated

        cursor = self.cursor

        latest_message_id: None | str | Unset
        if isinstance(self.latest_message_id, Unset):
            latest_message_id = UNSET
        elif isinstance(self.latest_message_id, UUID):
            latest_message_id = str(self.latest_message_id)
        else:
            latest_message_id = self.latest_message_id

        has_more = self.has_more

        before_cursor = self.before_cursor

        after_cursor = self.after_cursor

        has_more_before = self.has_more_before

        has_more_after = self.has_more_after

        quoted_chars_removed = self.quoted_chars_removed


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "thread_id": thread_id,
            "messages": messages,
        })
        if subject is not UNSET:
            field_dict["subject"] = subject
        if message_count is not UNSET:
            field_dict["message_count"] = message_count
        if truncated is not UNSET:
            field_dict["truncated"] = truncated
        if cursor is not UNSET:
            field_dict["cursor"] = cursor
        if latest_message_id is not UNSET:
            field_dict["latest_message_id"] = latest_message_id
        if has_more is not UNSET:
            field_dict["has_more"] = has_more
        if before_cursor is not UNSET:
            field_dict["before_cursor"] = before_cursor
        if after_cursor is not UNSET:
            field_dict["after_cursor"] = after_cursor
        if has_more_before is not UNSET:
            field_dict["has_more_before"] = has_more_before
        if has_more_after is not UNSET:
            field_dict["has_more_after"] = has_more_after
        if quoted_chars_removed is not UNSET:
            field_dict["quoted_chars_removed"] = quoted_chars_removed

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.conversation_message import ConversationMessage # noqa: PLC0415
        d = dict(src_dict)
        def _parse_thread_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                thread_id_type_0 = UUID(data)



                return thread_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        thread_id = _parse_thread_id(d.pop("thread_id"))


        messages = []
        _messages = d.pop("messages")
        for messages_item_data in (_messages):
            messages_item = ConversationMessage.from_dict(messages_item_data)



            messages.append(messages_item)


        def _parse_subject(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        subject = _parse_subject(d.pop("subject", UNSET))


        message_count = d.pop("message_count", UNSET)

        truncated = d.pop("truncated", UNSET)

        cursor = d.pop("cursor", UNSET)

        def _parse_latest_message_id(data: object) -> None | Unset | UUID:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                latest_message_id_type_0 = UUID(data)



                return latest_message_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | Unset | UUID, data)

        latest_message_id = _parse_latest_message_id(d.pop("latest_message_id", UNSET))


        has_more = d.pop("has_more", UNSET)

        before_cursor = d.pop("before_cursor", UNSET)

        after_cursor = d.pop("after_cursor", UNSET)

        has_more_before = d.pop("has_more_before", UNSET)

        has_more_after = d.pop("has_more_after", UNSET)

        quoted_chars_removed = d.pop("quoted_chars_removed", UNSET)

        conversation = cls(
            thread_id=thread_id,
            messages=messages,
            subject=subject,
            message_count=message_count,
            truncated=truncated,
            cursor=cursor,
            latest_message_id=latest_message_id,
            has_more=has_more,
            before_cursor=before_cursor,
            after_cursor=after_cursor,
            has_more_before=has_more_before,
            has_more_after=has_more_after,
            quoted_chars_removed=quoted_chars_removed,
        )


        conversation.additional_properties = d
        return conversation

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
