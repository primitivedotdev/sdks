from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.repeat_input import RepeatInput
  from ..models.reply_input_headers import ReplyInputHeaders
  from ..models.send_mail_attachment import SendMailAttachment





T = TypeVar("T", bound="ReplyInput")



@_attrs_define
class ReplyInput:
    """ Body shape for `/emails/{id}/reply`. Intentionally narrow:
    recipients (`to`), subject, and threading headers
    (`in_reply_to`, `references`) are derived server-side from
    the inbound row referenced by the path id and are rejected by
    `additionalProperties` if passed (returns 400).

    `from` IS allowed because of legitimate use cases (display-name
    addition, replying from a different verified outbound address,
    multi-team triage). Send-mail's per-send `canSendFrom` gate
    validates the from-domain regardless, so the override carries
    no extra privilege.

        Attributes:
            body_text (str | Unset): Plain-text reply body. At least one of body_text or body_html is required. The combined
                UTF-8 byte length of body_text and body_html must be at most 262144 bytes (same cap as send-mail).
            body_html (str | Unset): HTML reply body. At least one of body_text or body_html is required.
            from_ (str | Unset): Optional override for the reply's From header. Defaults to
                the inbound's recipient. Use to add a display name (`"Acme
                Support" <agent@company.com>`) or to reply from a different
                verified outbound address (e.g. multi-team routing where
                support@ triages to billing@). The from-domain must be a
                verified outbound domain for your org, same as send-mail.
            wait (bool | Unset): When true, wait for the first downstream SMTP delivery outcome before returning, mirroring
                the send-mail `wait` semantics.
            reply_all (bool | Unset): Reply to everyone on the email. To is the sender (or
                Reply-To) as in a plain reply; every other To and Cc address
                of the email becomes Cc, minus the replying address. Bcc is
                never read, so a blind copy stays blind. Every send rule
                applies to each recipient exactly as for a direct send with
                cc. Defaults to false.
            attachments (list[SendMailAttachment] | Unset): Inline attachments for this reply. Use
                https://api.primitive.dev/v1 for replies with attachments. Combined raw decoded attachment bytes must be at most
                31457280.
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
            headers (ReplyInputHeaders | Unset): Extra headers, as `{ "Name": "value" }`, at most 25. A name is one of
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

    body_text: str | Unset = UNSET
    body_html: str | Unset = UNSET
    from_: str | Unset = UNSET
    wait: bool | Unset = UNSET
    reply_all: bool | Unset = UNSET
    attachments: list[SendMailAttachment] | Unset = UNSET
    repeat: RepeatInput | Unset = UNSET
    headers: ReplyInputHeaders | Unset = UNSET
    if_latest_message_id: UUID | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.repeat_input import RepeatInput # noqa: PLC0415
        from ..models.reply_input_headers import ReplyInputHeaders # noqa: PLC0415
        from ..models.send_mail_attachment import SendMailAttachment # noqa: PLC0415
        body_text = self.body_text

        body_html = self.body_html

        from_ = self.from_

        wait = self.wait

        reply_all = self.reply_all

        attachments: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.attachments, Unset):
            attachments = []
            for attachments_item_data in self.attachments:
                attachments_item = attachments_item_data.to_dict()
                attachments.append(attachments_item)



        repeat: dict[str, Any] | Unset = UNSET
        if not isinstance(self.repeat, Unset):
            repeat = self.repeat.to_dict()

        headers: dict[str, Any] | Unset = UNSET
        if not isinstance(self.headers, Unset):
            headers = self.headers.to_dict()

        if_latest_message_id: str | Unset = UNSET
        if not isinstance(self.if_latest_message_id, Unset):
            if_latest_message_id = str(self.if_latest_message_id)


        field_dict: dict[str, Any] = {}

        field_dict.update({
        })
        if body_text is not UNSET:
            field_dict["body_text"] = body_text
        if body_html is not UNSET:
            field_dict["body_html"] = body_html
        if from_ is not UNSET:
            field_dict["from"] = from_
        if wait is not UNSET:
            field_dict["wait"] = wait
        if reply_all is not UNSET:
            field_dict["reply_all"] = reply_all
        if attachments is not UNSET:
            field_dict["attachments"] = attachments
        if repeat is not UNSET:
            field_dict["repeat"] = repeat
        if headers is not UNSET:
            field_dict["headers"] = headers
        if if_latest_message_id is not UNSET:
            field_dict["if_latest_message_id"] = if_latest_message_id

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.repeat_input import RepeatInput # noqa: PLC0415
        from ..models.reply_input_headers import ReplyInputHeaders # noqa: PLC0415
        from ..models.send_mail_attachment import SendMailAttachment # noqa: PLC0415
        d = dict(src_dict)
        body_text = d.pop("body_text", UNSET)

        body_html = d.pop("body_html", UNSET)

        from_ = d.pop("from", UNSET)

        wait = d.pop("wait", UNSET)

        reply_all = d.pop("reply_all", UNSET)

        _attachments = d.pop("attachments", UNSET)
        attachments: list[SendMailAttachment] | Unset = UNSET
        if _attachments is not UNSET:
            attachments = []
            for attachments_item_data in _attachments:
                attachments_item = SendMailAttachment.from_dict(attachments_item_data)



                attachments.append(attachments_item)


        _repeat = d.pop("repeat", UNSET)
        repeat: RepeatInput | Unset
        if isinstance(_repeat,  Unset):
            repeat = UNSET
        else:
            repeat = RepeatInput.from_dict(_repeat)




        _headers = d.pop("headers", UNSET)
        headers: ReplyInputHeaders | Unset
        if isinstance(_headers,  Unset):
            headers = UNSET
        else:
            headers = ReplyInputHeaders.from_dict(_headers)




        _if_latest_message_id = d.pop("if_latest_message_id", UNSET)
        if_latest_message_id: UUID | Unset
        if isinstance(_if_latest_message_id,  Unset):
            if_latest_message_id = UNSET
        else:
            if_latest_message_id = UUID(_if_latest_message_id)




        reply_input = cls(
            body_text=body_text,
            body_html=body_html,
            from_=from_,
            wait=wait,
            reply_all=reply_all,
            attachments=attachments,
            repeat=repeat,
            headers=headers,
            if_latest_message_id=if_latest_message_id,
        )

        return reply_input

