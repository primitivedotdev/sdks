from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.change_kind import ChangeKind
from ..models.change_reason_type_1 import ChangeReasonType1
from ..models.change_reason_type_2_type_1 import ChangeReasonType2Type1
from ..models.change_reason_type_3_type_1 import ChangeReasonType3Type1
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.change_inbound_message import ChangeInboundMessage
  from ..models.change_outbound_message import ChangeOutboundMessage





T = TypeVar("T", bound="Change")



@_attrs_define
class Change:
    """ One invalidation: what changed, by id, never its content. Every field is present; fields that do not apply to the
    kind are null. Apply idempotently: a change can repeat.

        Attributes:
            kind (ChangeKind): `email.visible`: an inbound email became visible to this credential (arrived, or its sender-
                authentication hold was released). `email.updated`: something a list row or conversation shows changed.
                `email.deleted`: gone, or withdrawn from view. `sent_email.created` / `sent_email.updated`: a send appeared or
                changed; `status` is its current status, and several changes between two reads collapse into one entry. Created
                is a hint (first committed after the cursor): treat both as upsert, including `sent_email.updated` for an id you
                have not seen. `sent_email.deleted`: the send was deleted. `thread.read_state_changed`: the signed-in member's
                read cursor for `thread_id` moved, on any device. `thread.mute_changed`: `thread_id` was muted or unmuted for an
                address this credential reads, which changes the `muted` flag and `exclude_muted` results of its mail.
                `agent.changed`: an agent in the directory changed (connected, disconnected, renamed, hidden, listed, presence
                extended, receiver live). `access.changed`: this credential's own access changed; rebuild every snapshot from
                `since=start`.
            email_id (None | UUID): email.* kinds.
            sent_email_id (None | UUID): sent_email.* kinds.
            thread_id (None | UUID): The conversation, when known. Null for a connected agent reading a send, or its
                deletion, that it received but did not send, matching what GET /sent-emails withholds. Inbound mail is announced
                when it becomes visible, which can be before its conversation is resolved, so `email.visible` can carry null;
                resolving or changing the conversation is always announced afterwards as `email.updated` with the `thread_id`.
            status (None | str): sent_email.created and sent_email.updated: the send's current status.
            agent_address (None | str): agent.changed: the agent's address.
            reason (ChangeReasonType1 | ChangeReasonType2Type1 | ChangeReasonType3Type1 | None): access.changed:
                `membership` (the member's role or membership) or `agent_connection` (this agent connection's status, owner or
                generation).
            changed_at (datetime.datetime): The commit position in microsecond UTC form. Orders the feed; not a business
                timestamp.
            message (ChangeInboundMessage | ChangeOutboundMessage | None | Unset): Present only when the request sets
                `expand=message`. For `email.visible`, `email.updated`, `sent_email.created`, `sent_email.updated`: the message
                as it reads at the time of this response (not at the time of the change), exactly as the list endpoints return
                it, marked by `direction`. Null for every other kind, and when the message is no longer readable by this
                credential (deleted, or withdrawn from view after the change).
     """

    kind: ChangeKind
    email_id: None | UUID
    sent_email_id: None | UUID
    thread_id: None | UUID
    status: None | str
    agent_address: None | str
    reason: ChangeReasonType1 | ChangeReasonType2Type1 | ChangeReasonType3Type1 | None
    changed_at: datetime.datetime
    message: ChangeInboundMessage | ChangeOutboundMessage | None | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.change_inbound_message import ChangeInboundMessage # noqa: PLC0415
        from ..models.change_outbound_message import ChangeOutboundMessage # noqa: PLC0415
        kind = self.kind.value

        email_id: None | str
        if isinstance(self.email_id, UUID):
            email_id = str(self.email_id)
        else:
            email_id = self.email_id

        sent_email_id: None | str
        if isinstance(self.sent_email_id, UUID):
            sent_email_id = str(self.sent_email_id)
        else:
            sent_email_id = self.sent_email_id

        thread_id: None | str
        if isinstance(self.thread_id, UUID):
            thread_id = str(self.thread_id)
        else:
            thread_id = self.thread_id

        status: None | str
        status = self.status

        agent_address: None | str
        agent_address = self.agent_address

        reason: None | str
        if isinstance(self.reason, ChangeReasonType1):
            reason = self.reason.value
        elif isinstance(self.reason, ChangeReasonType2Type1):
            reason = self.reason.value
        elif isinstance(self.reason, ChangeReasonType3Type1):
            reason = self.reason.value
        else:
            reason = self.reason

        changed_at = self.changed_at.isoformat()

        message: dict[str, Any] | None | Unset
        if isinstance(self.message, Unset):
            message = UNSET
        elif isinstance(self.message, ChangeInboundMessage):
            message = self.message.to_dict()
        elif isinstance(self.message, ChangeOutboundMessage):
            message = self.message.to_dict()
        else:
            message = self.message


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "kind": kind,
            "email_id": email_id,
            "sent_email_id": sent_email_id,
            "thread_id": thread_id,
            "status": status,
            "agent_address": agent_address,
            "reason": reason,
            "changed_at": changed_at,
        })
        if message is not UNSET:
            field_dict["message"] = message

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.change_inbound_message import ChangeInboundMessage # noqa: PLC0415
        from ..models.change_outbound_message import ChangeOutboundMessage # noqa: PLC0415
        d = dict(src_dict)
        kind = ChangeKind(d.pop("kind"))




        def _parse_email_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                email_id_type_0 = UUID(data)



                return email_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        email_id = _parse_email_id(d.pop("email_id"))


        def _parse_sent_email_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                sent_email_id_type_0 = UUID(data)



                return sent_email_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        sent_email_id = _parse_sent_email_id(d.pop("sent_email_id"))


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


        def _parse_status(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        status = _parse_status(d.pop("status"))


        def _parse_agent_address(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        agent_address = _parse_agent_address(d.pop("agent_address"))


        def _parse_reason(data: object) -> ChangeReasonType1 | ChangeReasonType2Type1 | ChangeReasonType3Type1 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                reason_type_1 = ChangeReasonType1(data)



                return reason_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                reason_type_2_type_1 = ChangeReasonType2Type1(data)



                return reason_type_2_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                reason_type_3_type_1 = ChangeReasonType3Type1(data)



                return reason_type_3_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(ChangeReasonType1 | ChangeReasonType2Type1 | ChangeReasonType3Type1 | None, data)

        reason = _parse_reason(d.pop("reason"))


        changed_at = datetime.datetime.fromisoformat(d.pop("changed_at"))




        def _parse_message(data: object) -> ChangeInboundMessage | ChangeOutboundMessage | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_change_message_type_0 = ChangeInboundMessage.from_dict(data)



                return componentsschemas_change_message_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_change_message_type_1 = ChangeOutboundMessage.from_dict(data)



                return componentsschemas_change_message_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(ChangeInboundMessage | ChangeOutboundMessage | None | Unset, data)

        message = _parse_message(d.pop("message", UNSET))


        change = cls(
            kind=kind,
            email_id=email_id,
            sent_email_id=sent_email_id,
            thread_id=thread_id,
            status=status,
            agent_address=agent_address,
            reason=reason,
            changed_at=changed_at,
            message=message,
        )

        return change

