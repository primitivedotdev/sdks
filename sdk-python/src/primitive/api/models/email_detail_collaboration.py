from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.email_detail_collaboration_sender_relationship import EmailDetailCollaborationSenderRelationship
from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.email_detail_collaboration_peer_signal_on_my_last_type_0 import EmailDetailCollaborationPeerSignalOnMyLastType0





T = TypeVar("T", bound="EmailDetailCollaboration")



@_attrs_define
class EmailDetailCollaboration:
    """ Facts for deciding how to act on this email, computed by the server under your visibility. Read it before acting:
    when `newer_inbound_count` is above zero, read the newer messages and answer the latest state once. Carries no text
    the sender wrote.

        Attributes:
            thread_id (None | UUID):
            newer_inbound_count (int): Inbound messages in this thread you can read that arrived after this one, each
                counted once however many copies of it you can read; a later copy of this email's own message is not newer. Same
                count as `GET /threads/{id}?after={this id}`.
            latest_inbound_id (None | UUID): The newest inbound email in this thread you can read; this email's own id when
                nothing newer arrived.
            in_thread (bool): Your address has sent mail in this thread, not counting status signals.
            sender_relationship (EmailDetailCollaborationSenderRelationship): `owner`: verified member mail from the human
                who owns this agent connection (for other credentials, any verified organization member). `org_agent`: a
                connected agent of this organization, proven by its current key (`sender_connected_agent_verified`). `member`:
                verified member mail from a member of this organization who does not own this agent connection (only an agent
                connection sees it; for other credentials every member is `owner`). `contact`: an address on your contact list
                with notifications on. `other`: anyone else. Never derived from a From header alone.
            fyi (bool): True when this email is an informational signal and nothing else: one `interaction.json` part
                stating an `ack`, `read`, `working` or `typing` signal about an earlier message, plus only the fixed fallback
                text; or a DKIM-authenticated repeat-stop notice of the same strict shape. It needs no answer, and a busy agent
                may skip it. Decided when the email is parsed. Never true for mail from the reader's owner. Sent with `fyi:
                true` on `/send-mail` or `/emails/{id}/reply`.
            muted (bool): True when the reader's address muted this email's thread with `PUT /threads/{id}/mute`. For a
                connected agent the reader is its own address; for other credentials it is the address the email was delivered
                to.
            peer_signal_on_my_last (EmailDetailCollaborationPeerSignalOnMyLastType0 | None): The latest explicit signal
                (`read`, `ack` or `working`) that an authenticated recipient of your last message in this thread (not counting
                your status signals) sent about that message, or null. An expired `working` signal is not reported. Delivery
                alone never produces one.
     """

    thread_id: None | UUID
    newer_inbound_count: int
    latest_inbound_id: None | UUID
    in_thread: bool
    sender_relationship: EmailDetailCollaborationSenderRelationship
    fyi: bool
    muted: bool
    peer_signal_on_my_last: EmailDetailCollaborationPeerSignalOnMyLastType0 | None
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_detail_collaboration_peer_signal_on_my_last_type_0 import EmailDetailCollaborationPeerSignalOnMyLastType0 # noqa: PLC0415
        thread_id: None | str
        if isinstance(self.thread_id, UUID):
            thread_id = str(self.thread_id)
        else:
            thread_id = self.thread_id

        newer_inbound_count = self.newer_inbound_count

        latest_inbound_id: None | str
        if isinstance(self.latest_inbound_id, UUID):
            latest_inbound_id = str(self.latest_inbound_id)
        else:
            latest_inbound_id = self.latest_inbound_id

        in_thread = self.in_thread

        sender_relationship = self.sender_relationship.value

        fyi = self.fyi

        muted = self.muted

        peer_signal_on_my_last: dict[str, Any] | None
        if isinstance(self.peer_signal_on_my_last, EmailDetailCollaborationPeerSignalOnMyLastType0):
            peer_signal_on_my_last = self.peer_signal_on_my_last.to_dict()
        else:
            peer_signal_on_my_last = self.peer_signal_on_my_last


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "thread_id": thread_id,
            "newer_inbound_count": newer_inbound_count,
            "latest_inbound_id": latest_inbound_id,
            "in_thread": in_thread,
            "sender_relationship": sender_relationship,
            "fyi": fyi,
            "muted": muted,
            "peer_signal_on_my_last": peer_signal_on_my_last,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_detail_collaboration_peer_signal_on_my_last_type_0 import EmailDetailCollaborationPeerSignalOnMyLastType0 # noqa: PLC0415
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


        newer_inbound_count = d.pop("newer_inbound_count")

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


        in_thread = d.pop("in_thread")

        sender_relationship = EmailDetailCollaborationSenderRelationship(d.pop("sender_relationship"))




        fyi = d.pop("fyi")

        muted = d.pop("muted")

        def _parse_peer_signal_on_my_last(data: object) -> EmailDetailCollaborationPeerSignalOnMyLastType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                peer_signal_on_my_last_type_0 = EmailDetailCollaborationPeerSignalOnMyLastType0.from_dict(data)



                return peer_signal_on_my_last_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(EmailDetailCollaborationPeerSignalOnMyLastType0 | None, data)

        peer_signal_on_my_last = _parse_peer_signal_on_my_last(d.pop("peer_signal_on_my_last"))


        email_detail_collaboration = cls(
            thread_id=thread_id,
            newer_inbound_count=newer_inbound_count,
            latest_inbound_id=latest_inbound_id,
            in_thread=in_thread,
            sender_relationship=sender_relationship,
            fyi=fyi,
            muted=muted,
            peer_signal_on_my_last=peer_signal_on_my_last,
        )


        email_detail_collaboration.additional_properties = d
        return email_detail_collaboration

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
