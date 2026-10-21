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
  from ..models.repeat_input import RepeatInput
  from ..models.send_mail_attachment import SendMailAttachment
  from ..models.send_mail_input_headers import SendMailInputHeaders
  from ..models.send_mail_payload_ref import SendMailPayloadRef





T = TypeVar("T", bound="SendMailInput")



@_attrs_define
class SendMailInput:
    """ 
        Attributes:
            from_ (str): RFC 5322 From header. The sender domain must be a verified outbound domain for your organization.
            to (str): Recipient address. Recipient eligibility depends on your account's outbound entitlements.
            subject (str): Subject line for the outbound message
            repeat (RepeatInput | Unset): Repeat this send every `every_minutes` in the same thread. The first
                message goes out like any send; each later one is a scheduled send
                that replies to the previous one, so quotas, gates and cancellation
                apply as usual. Requires exactly one `to` recipient and no cc, bcc,
                attachments or `fyi` (422 `repeat_unsupported`). The recipient must
                be an address of your own organization unless the organization is
                entitled to repeat to external recipients (403
                `repeat_recipient_external`). `only_if_recipient_idle_minutes` needs
                a recipient in your organization (422
                `repeat_idle_requires_internal_recipient`).
            cc (list[str] | str | Unset): Carbon-copy recipients. Either a single address or an array of addresses. Each
                entry must be a single address; use the array form for multiple recipients. Cc recipients are visible to
                everyone who receives the message. The combined number of to, cc, and bcc recipients must not exceed 100.
            bcc (list[str] | str | Unset): Blind-carbon-copy recipients. Either a single address or an array of addresses.
                Each entry must be a single address; use the array form for multiple recipients. Bcc recipients receive the
                message but are not disclosed to the other recipients: no Bcc header is sent. The combined number of to, cc, and
                bcc recipients must not exceed 100.
            body_text (str | Unset): Plain-text message body. At least one of body_text or body_html is required. The
                combined UTF-8 byte length of body_text and body_html must be at most 262144 bytes.
            body_html (str | Unset): HTML message body. At least one of body_text or body_html is required. The combined
                UTF-8 byte length of body_text and body_html must be at most 262144 bytes.
            in_reply_to (str | Unset): Message-ID of the direct parent email when sending a threaded reply.
            references (list[str] | Unset): Full ordered message-id chain for the thread.
            attachments (list[SendMailAttachment] | Unset): Inline attachments. Send requests with attachments to
                https://api.primitive.dev/v1/send-mail. Combined raw decoded attachment bytes must be at most 31457280.
            payload_attachments (list[SendMailPayloadRef] | Unset): Deliver an already-uploaded Primitive Payloads object as
                an attachment by reference, without inlining the bytes - the way to send attachments larger than the inline cap.
                Upload the object via /v1/payloads (client-held CEK), then reference it here. v1 supports at most one.
            wait (bool | Unset): When true, wait for the first downstream SMTP delivery outcome before returning.
            wait_timeout_ms (int | Unset): Maximum time to wait for a delivery outcome when wait is true. Defaults to 30000.
            scheduled_at (datetime.datetime | Unset): Optional future execution time (ISO 8601). When set, the
                send is recorded with status `scheduled` and executed at
                the requested time instead of immediately. Must be in the
                future and at most 30 days out. Incompatible with `wait`
                (a scheduled send resolves after this request completes)
                and with `attachments` / `payload_attachments` (not yet
                supported on scheduled sends). Reschedule via PATCH
                /sent-emails/{id}; cancel via /sent-emails/{id}/cancel.
                Accepts `Z` or a numeric UTC offset
                (`2026-10-09T17:00:00Z`, `2026-10-09T13:00:00-04:00`); an
                offset is converted to UTC, so the stored and echoed value
                is UTC. A time with no zone, or a bare date, is rejected.
            headers (SendMailInputHeaders | Unset): Extra headers, as `{ "Name": "value" }`, at most 25. A name is one of
                `Auto-Submitted`, `Precedence`, `X-Auto-Response-Suppress`, `X-Primitive-Interaction`, `X-Primitive-Interaction-
                Ref`, or a custom `X-` name of letters, digits and hyphens that is not credential-like (a word such as `auth`,
                `token`, `key`, `secret`, `session` or `bearer`, joined forms included) and not in a reserved family:
                X-Primitive*, X-Original-*, X-Originating-*, X-Forwarded-*, X-Received*, X-Authenticated*, X-Envelope-*,
                X-Delivered-To, X-Apparently-To, X-Failed-Recipients, X-Loop, X-Priority, X-MSMail-*, X-MS-*, X-Microsoft-*,
                X-Forefront-*, X-Exchange-*, X-Google-*, X-GM-*, X-Apple-*, X-Yahoo-*, X-YMail-*, X-AOL-*, X-Spam*, X-Virus-*,
                X-Proofpoint-*, X-Barracuda-*, X-Rspamd-*, X-Mimecast-*, X-IronPort-*, X-Sophos-*, X-Report-Abuse*, X-CSA-*.
                Names compare case-insensitively (`_` and `.` count as `-` for families); a repeated or any other name is a
                `validation_error`. Values: 1 to 200 printable ASCII characters. Custom headers are sent as spelled, are not
                DKIM-signed, and can be searched with `header` on `GET /sent-emails`. Example: {'X-Campaign-Id': 'spring-sale',
                'Auto-Submitted': 'auto-generated'}.
            if_latest_message_id (UUID | Unset): Send only if this message id is still the newest message in the thread this
                send joins, as this credential can see it. Newest means the message that joined the thread last, in the order
                messages were attached to it, not by timestamp: a message accepted earlier but attached later is newer. Messages
                stored before join order was recorded count as older than every message that has one, and among themselves sort
                by timestamp (received_at for mail received, created_at for mail sent), ties going to the larger id. Pass
                latest_message_id from GET /emails/{id}/conversation: it is read by the same rule, whereas the last message
                listed there is ordered by timestamp and can differ when mail joined the thread late. An organization credential
                sees every message in the thread; a mailbox-scoped agent connection key sees only mail received at its address
                and mail sent from it. Mail awaiting sender authentication never counts. Otherwise nothing is sent and the
                response is 409 latest_message_mismatch with error.details.latest_message_id, latest_message_at and thread_id.
                If in_reply_to resolves to no single thread this credential can check, the response is 422
                latest_message_thread_unresolved; that does not change on retry. If the thread stays locked by another writer
                for longer than the send waits, the response is 503 thread_busy with Retry-After; nothing was sent and the same
                request can be retried. Checked inside the send transaction under a lock on the thread, so two sends conditioned
                on the same id cannot both go out. The value is part of the request a replay is matched on: a replay of an
                already accepted request with the same idempotency key, or the identical request within the automatic
                deduplication window, returns the original result without checking again, and a request that differs only in
                if_latest_message_id is not a replay. On /send-mail it requires in_reply_to; it cannot be combined with
                scheduled_at or repeat, because it is checked when the request is accepted.
     """

    from_: str
    to: str
    subject: str
    repeat: RepeatInput | Unset = UNSET
    cc: list[str] | str | Unset = UNSET
    bcc: list[str] | str | Unset = UNSET
    body_text: str | Unset = UNSET
    body_html: str | Unset = UNSET
    in_reply_to: str | Unset = UNSET
    references: list[str] | Unset = UNSET
    attachments: list[SendMailAttachment] | Unset = UNSET
    payload_attachments: list[SendMailPayloadRef] | Unset = UNSET
    wait: bool | Unset = UNSET
    wait_timeout_ms: int | Unset = UNSET
    scheduled_at: datetime.datetime | Unset = UNSET
    headers: SendMailInputHeaders | Unset = UNSET
    if_latest_message_id: UUID | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.repeat_input import RepeatInput # noqa: PLC0415
        from ..models.send_mail_attachment import SendMailAttachment # noqa: PLC0415
        from ..models.send_mail_input_headers import SendMailInputHeaders # noqa: PLC0415
        from ..models.send_mail_payload_ref import SendMailPayloadRef # noqa: PLC0415
        from_ = self.from_

        to = self.to

        subject = self.subject

        repeat: dict[str, Any] | Unset = UNSET
        if not isinstance(self.repeat, Unset):
            repeat = self.repeat.to_dict()

        cc: list[str] | str | Unset
        if isinstance(self.cc, Unset):
            cc = UNSET
        elif isinstance(self.cc, list):
            cc = self.cc


        else:
            cc = self.cc

        bcc: list[str] | str | Unset
        if isinstance(self.bcc, Unset):
            bcc = UNSET
        elif isinstance(self.bcc, list):
            bcc = self.bcc


        else:
            bcc = self.bcc

        body_text = self.body_text

        body_html = self.body_html

        in_reply_to = self.in_reply_to

        references: list[str] | Unset = UNSET
        if not isinstance(self.references, Unset):
            references = self.references



        attachments: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.attachments, Unset):
            attachments = []
            for attachments_item_data in self.attachments:
                attachments_item = attachments_item_data.to_dict()
                attachments.append(attachments_item)



        payload_attachments: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.payload_attachments, Unset):
            payload_attachments = []
            for payload_attachments_item_data in self.payload_attachments:
                payload_attachments_item = payload_attachments_item_data.to_dict()
                payload_attachments.append(payload_attachments_item)



        wait = self.wait

        wait_timeout_ms = self.wait_timeout_ms

        scheduled_at: str | Unset = UNSET
        if not isinstance(self.scheduled_at, Unset):
            scheduled_at = self.scheduled_at.isoformat()

        headers: dict[str, Any] | Unset = UNSET
        if not isinstance(self.headers, Unset):
            headers = self.headers.to_dict()

        if_latest_message_id: str | Unset = UNSET
        if not isinstance(self.if_latest_message_id, Unset):
            if_latest_message_id = str(self.if_latest_message_id)


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "from": from_,
            "to": to,
            "subject": subject,
        })
        if repeat is not UNSET:
            field_dict["repeat"] = repeat
        if cc is not UNSET:
            field_dict["cc"] = cc
        if bcc is not UNSET:
            field_dict["bcc"] = bcc
        if body_text is not UNSET:
            field_dict["body_text"] = body_text
        if body_html is not UNSET:
            field_dict["body_html"] = body_html
        if in_reply_to is not UNSET:
            field_dict["in_reply_to"] = in_reply_to
        if references is not UNSET:
            field_dict["references"] = references
        if attachments is not UNSET:
            field_dict["attachments"] = attachments
        if payload_attachments is not UNSET:
            field_dict["payload_attachments"] = payload_attachments
        if wait is not UNSET:
            field_dict["wait"] = wait
        if wait_timeout_ms is not UNSET:
            field_dict["wait_timeout_ms"] = wait_timeout_ms
        if scheduled_at is not UNSET:
            field_dict["scheduled_at"] = scheduled_at
        if headers is not UNSET:
            field_dict["headers"] = headers
        if if_latest_message_id is not UNSET:
            field_dict["if_latest_message_id"] = if_latest_message_id

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.repeat_input import RepeatInput # noqa: PLC0415
        from ..models.send_mail_attachment import SendMailAttachment # noqa: PLC0415
        from ..models.send_mail_input_headers import SendMailInputHeaders # noqa: PLC0415
        from ..models.send_mail_payload_ref import SendMailPayloadRef # noqa: PLC0415
        d = dict(src_dict)
        from_ = d.pop("from")

        to = d.pop("to")

        subject = d.pop("subject")

        _repeat = d.pop("repeat", UNSET)
        repeat: RepeatInput | Unset
        if isinstance(_repeat,  Unset):
            repeat = UNSET
        else:
            repeat = RepeatInput.from_dict(_repeat)




        def _parse_cc(data: object) -> list[str] | str | Unset:
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                cc_type_1 = cast(list[str], data)

                return cc_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[str] | str | Unset, data)

        cc = _parse_cc(d.pop("cc", UNSET))


        def _parse_bcc(data: object) -> list[str] | str | Unset:
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                bcc_type_1 = cast(list[str], data)

                return bcc_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[str] | str | Unset, data)

        bcc = _parse_bcc(d.pop("bcc", UNSET))


        body_text = d.pop("body_text", UNSET)

        body_html = d.pop("body_html", UNSET)

        in_reply_to = d.pop("in_reply_to", UNSET)

        references = cast(list[str], d.pop("references", UNSET))


        _attachments = d.pop("attachments", UNSET)
        attachments: list[SendMailAttachment] | Unset = UNSET
        if _attachments is not UNSET:
            attachments = []
            for attachments_item_data in _attachments:
                attachments_item = SendMailAttachment.from_dict(attachments_item_data)



                attachments.append(attachments_item)


        _payload_attachments = d.pop("payload_attachments", UNSET)
        payload_attachments: list[SendMailPayloadRef] | Unset = UNSET
        if _payload_attachments is not UNSET:
            payload_attachments = []
            for payload_attachments_item_data in _payload_attachments:
                payload_attachments_item = SendMailPayloadRef.from_dict(payload_attachments_item_data)



                payload_attachments.append(payload_attachments_item)


        wait = d.pop("wait", UNSET)

        wait_timeout_ms = d.pop("wait_timeout_ms", UNSET)

        _scheduled_at = d.pop("scheduled_at", UNSET)
        scheduled_at: datetime.datetime | Unset
        if isinstance(_scheduled_at,  Unset):
            scheduled_at = UNSET
        else:
            scheduled_at = datetime.datetime.fromisoformat(_scheduled_at)




        _headers = d.pop("headers", UNSET)
        headers: SendMailInputHeaders | Unset
        if isinstance(_headers,  Unset):
            headers = UNSET
        else:
            headers = SendMailInputHeaders.from_dict(_headers)




        _if_latest_message_id = d.pop("if_latest_message_id", UNSET)
        if_latest_message_id: UUID | Unset
        if isinstance(_if_latest_message_id,  Unset):
            if_latest_message_id = UNSET
        else:
            if_latest_message_id = UUID(_if_latest_message_id)




        send_mail_input = cls(
            from_=from_,
            to=to,
            subject=subject,
            repeat=repeat,
            cc=cc,
            bcc=bcc,
            body_text=body_text,
            body_html=body_html,
            in_reply_to=in_reply_to,
            references=references,
            attachments=attachments,
            payload_attachments=payload_attachments,
            wait=wait,
            wait_timeout_ms=wait_timeout_ms,
            scheduled_at=scheduled_at,
            headers=headers,
            if_latest_message_id=if_latest_message_id,
        )

        return send_mail_input

