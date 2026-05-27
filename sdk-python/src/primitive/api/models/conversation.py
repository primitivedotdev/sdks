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
            message_count (int): Total messages in the thread. `messages` is capped, so
                `truncated` is true (and this can exceed `messages.length`)
                when older messages were omitted.
            truncated (bool): True when `messages` omits part of the conversation because
                the thread exceeds the per-call cap.
            messages (list[ConversationMessage]):
            subject (None | str | Unset): Normalized thread subject (Re/Fwd prefixes stripped), or the
                email's own subject when it isn't threaded.
     """

    thread_id: None | UUID
    message_count: int
    truncated: bool
    messages: list[ConversationMessage]
    subject: None | str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.conversation_message import ConversationMessage
        thread_id: None | str
        if isinstance(self.thread_id, UUID):
            thread_id = str(self.thread_id)
        else:
            thread_id = self.thread_id

        message_count = self.message_count

        truncated = self.truncated

        messages = []
        for messages_item_data in self.messages:
            messages_item = messages_item_data.to_dict()
            messages.append(messages_item)



        subject: None | str | Unset
        if isinstance(self.subject, Unset):
            subject = UNSET
        else:
            subject = self.subject


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "thread_id": thread_id,
            "message_count": message_count,
            "truncated": truncated,
            "messages": messages,
        })
        if subject is not UNSET:
            field_dict["subject"] = subject

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.conversation_message import ConversationMessage
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


        message_count = d.pop("message_count")

        truncated = d.pop("truncated")

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


        conversation = cls(
            thread_id=thread_id,
            message_count=message_count,
            truncated=truncated,
            messages=messages,
            subject=subject,
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
