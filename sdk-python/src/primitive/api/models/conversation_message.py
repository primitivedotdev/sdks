from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.conversation_message_direction import ConversationMessageDirection
from ..models.conversation_message_role import ConversationMessageRole
from ..models.sent_email_status import SentEmailStatus
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.conversation_message_copies_item import ConversationMessageCopiesItem
  from ..models.conversation_message_hold import ConversationMessageHold
  from ..models.conversation_message_repeat_type_0 import ConversationMessageRepeatType0
  from ..models.conversation_message_sender_member_type_0 import ConversationMessageSenderMemberType0
  from ..models.email_attachment import EmailAttachment
  from ..models.presence_control import PresenceControl





T = TypeVar("T", bound="ConversationMessage")



@_attrs_define
class ConversationMessage:
    """ One message in the conversation, with its body and a chat role.
    `status` is the delivery status of an outbound message, as on
    `/sent-emails/{id}`, and is present only on a `since` read and
    only on outbound messages.

        Attributes:
            role (ConversationMessageRole): Chat role derived from `direction`: `user` for inbound
                (received) messages, `assistant` for outbound (your own prior
                replies). Lets `messages` be passed directly to a chat model.
            direction (ConversationMessageDirection): `inbound` for a received email (`/emails/{id}`), `outbound`
                for a send (`/sent-emails/{id}`).
            id (UUID):
            text (None | str): Plain-text body. Empty string when the message has no text
                part or its content was discarded by retention. May be null: this field carries message content, which is
                withheld when the content is not available to your credential.
            message_id (None | str | Unset):
            from_ (None | str | Unset):
            to (None | str | Unset):
            subject (None | str | Unset):
            timestamp (datetime.datetime | None | Unset): received_at for inbound, created_at for outbound.
            status (SentEmailStatus | Unset): Lifecycle status of a sent_emails row. Possible values:

                  - `queued`: pre-call INSERT; the outbound agent has not
                    yet replied.
                  - `submitted_to_agent`: agent accepted; `queue_id` is set.
                  - `agent_failed`: agent rejected; `error_code` and
                    `error_message` carry the reason.
                  - `gate_denied`: a recipient-scope gate denied the send;
                    the agent was never called. The `gates` array carries
                    the denial detail. /send-mail returns 403 in this case
                    so callers see the denial synchronously; /sent-emails
                    additionally records the row for historical lookup,
                    which is when this status appears in a listing.
                  - `unknown`: terminal indeterminate; the on-box log
                    poller couldn't classify the receiver's response.
                  - `delivered` / `bounced` / `deferred` / `wait_timeout`:
                    terminal delivery outcomes (see DeliveryStatus).
                  - `scheduled`: created with a future `scheduled_at` and
                    not yet executed; `scheduled_at` carries the pending
                    execution time. Reschedulable via PATCH
                    /sent-emails/{id} and cancelable via
                    /sent-emails/{id}/cancel while in this status.
                  - `canceled`: terminal; a scheduled send canceled before
                    execution. `canceled_at` carries the cancellation time
                    and nothing was dispatched.
            presence_control (None | PresenceControl | Unset):
            repeat (ConversationMessageRepeatType0 | None | Unset): Set when Primitive sent this message as part of a
                repeating send. Resolved from Primitive's own records, never from the message content. Null on every other
                message and on servers that predate repeating sends.
            sender_member (ConversationMessageSenderMemberType0 | None | Unset):
            fyi (bool | Unset): Outbound messages only. True when the send was an informational signal (a read, working or
                typing signal, or an acknowledgement) and nothing else, so it is not a reply that takes part in the
                conversation. Absent on inbound messages. Older servers omit it.
            interaction_hint (str | Unset): Outbound messages only. How to place this send in a timeline: `status` (a pure
                status signal), `card` or `none`. Not declared as a closed enum so that a value added later does not fail
                decoding; treat an unknown value as `none`. Absent on inbound messages. Older servers omit it.
            attachments (list[EmailAttachment] | Unset): Attachment metadata for this message, each item as its own detail
                read reports it: `parsed.attachments` on `/emails/{id}` for inbound, `attachments` on `/sent-emails/{id}` for
                outbound, in the same order. Empty when there are none or an inbound message has no parsed content. No bytes or
                download URLs; download a part with `/emails/{id}/attachments/{part_index}` or `/sent-
                emails/{id}/attachments/{part_index}`.
            copies (list[ConversationMessageCopiesItem] | Unset): Every inbound copy of this message you can read (a message
                to several of the org's mailboxes is stored once per mailbox), in arrival order. At most 50; past that, the ones
                listed are your own mailboxes' copies first, then the earliest. The entry's `id` is one of them unless the entry
                is the send. A later read can return the message again with more copies listed, or under another id when a
                better copy becomes visible: upsert entries by `id`, and drop any entry you hold whose id is in a newer entry's
                `copies` or `sent_email_id`.
            copies_truncated (bool | Unset): Present when `copies` may not list every copy you can read.
            sent_email_id (UUID | Unset): The org's send of this message, when the entry is an inbound copy and you can read
                the send. On a `since` read, when you read the send as its sender, the entry's `status` and `hold` describe the
                send.
            hold (ConversationMessageHold | Unset): Only on a held scheduled send: its OAuth grant was revoked after refresh
                token reuse, so it waits until released (POST /sent-emails/{id}/release) or canceled; canceled after 7 days.
                Status stays scheduled.
     """

    role: ConversationMessageRole
    direction: ConversationMessageDirection
    id: UUID
    text: None | str
    message_id: None | str | Unset = UNSET
    from_: None | str | Unset = UNSET
    to: None | str | Unset = UNSET
    subject: None | str | Unset = UNSET
    timestamp: datetime.datetime | None | Unset = UNSET
    status: SentEmailStatus | Unset = UNSET
    presence_control: None | PresenceControl | Unset = UNSET
    repeat: ConversationMessageRepeatType0 | None | Unset = UNSET
    sender_member: ConversationMessageSenderMemberType0 | None | Unset = UNSET
    fyi: bool | Unset = UNSET
    interaction_hint: str | Unset = UNSET
    attachments: list[EmailAttachment] | Unset = UNSET
    copies: list[ConversationMessageCopiesItem] | Unset = UNSET
    copies_truncated: bool | Unset = UNSET
    sent_email_id: UUID | Unset = UNSET
    hold: ConversationMessageHold | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.conversation_message_copies_item import ConversationMessageCopiesItem # noqa: PLC0415
        from ..models.conversation_message_hold import ConversationMessageHold # noqa: PLC0415
        from ..models.conversation_message_repeat_type_0 import ConversationMessageRepeatType0 # noqa: PLC0415
        from ..models.conversation_message_sender_member_type_0 import ConversationMessageSenderMemberType0 # noqa: PLC0415
        from ..models.email_attachment import EmailAttachment # noqa: PLC0415
        from ..models.presence_control import PresenceControl # noqa: PLC0415
        role = self.role.value

        direction = self.direction.value

        id = str(self.id)

        text: None | str
        text = self.text

        message_id: None | str | Unset
        if isinstance(self.message_id, Unset):
            message_id = UNSET
        else:
            message_id = self.message_id

        from_: None | str | Unset
        if isinstance(self.from_, Unset):
            from_ = UNSET
        else:
            from_ = self.from_

        to: None | str | Unset
        if isinstance(self.to, Unset):
            to = UNSET
        else:
            to = self.to

        subject: None | str | Unset
        if isinstance(self.subject, Unset):
            subject = UNSET
        else:
            subject = self.subject

        timestamp: None | str | Unset
        if isinstance(self.timestamp, Unset):
            timestamp = UNSET
        elif isinstance(self.timestamp, datetime.datetime):
            timestamp = self.timestamp.isoformat()
        else:
            timestamp = self.timestamp

        status: str | Unset = UNSET
        if not isinstance(self.status, Unset):
            status = self.status.value


        presence_control: dict[str, Any] | None | Unset
        if isinstance(self.presence_control, Unset):
            presence_control = UNSET
        elif isinstance(self.presence_control, PresenceControl):
            presence_control = self.presence_control.to_dict()
        else:
            presence_control = self.presence_control

        repeat: dict[str, Any] | None | Unset
        if isinstance(self.repeat, Unset):
            repeat = UNSET
        elif isinstance(self.repeat, ConversationMessageRepeatType0):
            repeat = self.repeat.to_dict()
        else:
            repeat = self.repeat

        sender_member: dict[str, Any] | None | Unset
        if isinstance(self.sender_member, Unset):
            sender_member = UNSET
        elif isinstance(self.sender_member, ConversationMessageSenderMemberType0):
            sender_member = self.sender_member.to_dict()
        else:
            sender_member = self.sender_member

        fyi = self.fyi

        interaction_hint = self.interaction_hint

        attachments: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.attachments, Unset):
            attachments = []
            for attachments_item_data in self.attachments:
                attachments_item = attachments_item_data.to_dict()
                attachments.append(attachments_item)



        copies: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.copies, Unset):
            copies = []
            for copies_item_data in self.copies:
                copies_item = copies_item_data.to_dict()
                copies.append(copies_item)



        copies_truncated = self.copies_truncated

        sent_email_id: str | Unset = UNSET
        if not isinstance(self.sent_email_id, Unset):
            sent_email_id = str(self.sent_email_id)

        hold: dict[str, Any] | Unset = UNSET
        if not isinstance(self.hold, Unset):
            hold = self.hold.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "role": role,
            "direction": direction,
            "id": id,
            "text": text,
        })
        if message_id is not UNSET:
            field_dict["message_id"] = message_id
        if from_ is not UNSET:
            field_dict["from"] = from_
        if to is not UNSET:
            field_dict["to"] = to
        if subject is not UNSET:
            field_dict["subject"] = subject
        if timestamp is not UNSET:
            field_dict["timestamp"] = timestamp
        if status is not UNSET:
            field_dict["status"] = status
        if presence_control is not UNSET:
            field_dict["presence_control"] = presence_control
        if repeat is not UNSET:
            field_dict["repeat"] = repeat
        if sender_member is not UNSET:
            field_dict["sender_member"] = sender_member
        if fyi is not UNSET:
            field_dict["fyi"] = fyi
        if interaction_hint is not UNSET:
            field_dict["interaction_hint"] = interaction_hint
        if attachments is not UNSET:
            field_dict["attachments"] = attachments
        if copies is not UNSET:
            field_dict["copies"] = copies
        if copies_truncated is not UNSET:
            field_dict["copies_truncated"] = copies_truncated
        if sent_email_id is not UNSET:
            field_dict["sent_email_id"] = sent_email_id
        if hold is not UNSET:
            field_dict["hold"] = hold

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.conversation_message_copies_item import ConversationMessageCopiesItem # noqa: PLC0415
        from ..models.conversation_message_hold import ConversationMessageHold # noqa: PLC0415
        from ..models.conversation_message_repeat_type_0 import ConversationMessageRepeatType0 # noqa: PLC0415
        from ..models.conversation_message_sender_member_type_0 import ConversationMessageSenderMemberType0 # noqa: PLC0415
        from ..models.email_attachment import EmailAttachment # noqa: PLC0415
        from ..models.presence_control import PresenceControl # noqa: PLC0415
        d = dict(src_dict)
        role = ConversationMessageRole(d.pop("role"))




        direction = ConversationMessageDirection(d.pop("direction"))




        id = UUID(d.pop("id"))




        def _parse_text(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        text = _parse_text(d.pop("text"))


        def _parse_message_id(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        message_id = _parse_message_id(d.pop("message_id", UNSET))


        def _parse_from_(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        from_ = _parse_from_(d.pop("from", UNSET))


        def _parse_to(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        to = _parse_to(d.pop("to", UNSET))


        def _parse_subject(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        subject = _parse_subject(d.pop("subject", UNSET))


        def _parse_timestamp(data: object) -> datetime.datetime | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                timestamp_type_0 = datetime.datetime.fromisoformat(data)



                return timestamp_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None | Unset, data)

        timestamp = _parse_timestamp(d.pop("timestamp", UNSET))


        _status = d.pop("status", UNSET)
        status: SentEmailStatus | Unset
        if isinstance(_status,  Unset):
            status = UNSET
        else:
            status = SentEmailStatus(_status)




        def _parse_presence_control(data: object) -> None | PresenceControl | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                presence_control_type_1 = PresenceControl.from_dict(data)



                return presence_control_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | PresenceControl | Unset, data)

        presence_control = _parse_presence_control(d.pop("presence_control", UNSET))


        def _parse_repeat(data: object) -> ConversationMessageRepeatType0 | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                repeat_type_0 = ConversationMessageRepeatType0.from_dict(data)



                return repeat_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(ConversationMessageRepeatType0 | None | Unset, data)

        repeat = _parse_repeat(d.pop("repeat", UNSET))


        def _parse_sender_member(data: object) -> ConversationMessageSenderMemberType0 | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                sender_member_type_0 = ConversationMessageSenderMemberType0.from_dict(data)



                return sender_member_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(ConversationMessageSenderMemberType0 | None | Unset, data)

        sender_member = _parse_sender_member(d.pop("sender_member", UNSET))


        fyi = d.pop("fyi", UNSET)

        interaction_hint = d.pop("interaction_hint", UNSET)

        _attachments = d.pop("attachments", UNSET)
        attachments: list[EmailAttachment] | Unset = UNSET
        if _attachments is not UNSET:
            attachments = []
            for attachments_item_data in _attachments:
                attachments_item = EmailAttachment.from_dict(attachments_item_data)



                attachments.append(attachments_item)


        _copies = d.pop("copies", UNSET)
        copies: list[ConversationMessageCopiesItem] | Unset = UNSET
        if _copies is not UNSET:
            copies = []
            for copies_item_data in _copies:
                copies_item = ConversationMessageCopiesItem.from_dict(copies_item_data)



                copies.append(copies_item)


        copies_truncated = d.pop("copies_truncated", UNSET)

        _sent_email_id = d.pop("sent_email_id", UNSET)
        sent_email_id: UUID | Unset
        if isinstance(_sent_email_id,  Unset):
            sent_email_id = UNSET
        else:
            sent_email_id = UUID(_sent_email_id)




        _hold = d.pop("hold", UNSET)
        hold: ConversationMessageHold | Unset
        if isinstance(_hold,  Unset):
            hold = UNSET
        else:
            hold = ConversationMessageHold.from_dict(_hold)




        conversation_message = cls(
            role=role,
            direction=direction,
            id=id,
            text=text,
            message_id=message_id,
            from_=from_,
            to=to,
            subject=subject,
            timestamp=timestamp,
            status=status,
            presence_control=presence_control,
            repeat=repeat,
            sender_member=sender_member,
            fyi=fyi,
            interaction_hint=interaction_hint,
            attachments=attachments,
            copies=copies,
            copies_truncated=copies_truncated,
            sent_email_id=sent_email_id,
            hold=hold,
        )


        conversation_message.additional_properties = d
        return conversation_message

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
