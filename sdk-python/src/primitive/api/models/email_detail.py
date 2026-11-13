from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.email_detail_awaiting import EmailDetailAwaiting
from ..models.email_detail_parse_status_type_1 import EmailDetailParseStatusType1
from ..models.email_detail_parse_status_type_2_type_1 import EmailDetailParseStatusType2Type1
from ..models.email_detail_parse_status_type_3_type_1 import EmailDetailParseStatusType3Type1
from ..models.email_status import EmailStatus
from ..models.email_webhook_status_type_1 import EmailWebhookStatusType1
from ..models.email_webhook_status_type_2_type_1 import EmailWebhookStatusType2Type1
from ..models.email_webhook_status_type_3_type_1 import EmailWebhookStatusType3Type1
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.email_attachment import EmailAttachment
  from ..models.email_auth import EmailAuth
  from ..models.email_detail_automation_headers_type_0 import EmailDetailAutomationHeadersType0
  from ..models.email_detail_collaboration import EmailDetailCollaboration
  from ..models.email_detail_delivery_report_type_0 import EmailDetailDeliveryReportType0
  from ..models.email_detail_imported_type_0 import EmailDetailImportedType0
  from ..models.email_detail_relay_type_0 import EmailDetailRelayType0
  from ..models.email_detail_repeat_type_0 import EmailDetailRepeatType0
  from ..models.email_detail_reply import EmailDetailReply
  from ..models.email_detail_sender_member_type_0 import EmailDetailSenderMemberType0
  from ..models.email_detail_shared_through_type_0 import EmailDetailSharedThroughType0
  from ..models.email_detail_understanding_type_0 import EmailDetailUnderstandingType0
  from ..models.parsed_email_data import ParsedEmailData
  from ..models.presence_control import PresenceControl





T = TypeVar("T", bound="EmailDetail")



@_attrs_define
class EmailDetail:
    """ 
        Attributes:
            id (UUID):
            sender (str): SMTP envelope sender (return-path) the inbound mail server
                accepted. Same value as `smtp_mail_from`; both fields exist
                so protocol-aware tooling can use whichever name it expects.

                For most legitimate mail this equals `from_email`; for
                mailing lists, bounce handlers, and forwarders it is
                typically the bounce-handling address rather than the
                human-visible sender.

                **For the canonical "who sent this email" value, use
                `from_email`.**
            recipient (str):
            status (EmailStatus): Lifecycle status of an INBOUND email (a row in the `emails`
                table). Distinct from `SentEmailStatus`, which describes
                the OUTBOUND lifecycle (the `sent_emails` table) and uses
                a different vocabulary because the lifecycles differ.
                Possible values:

                  - `pending`: the row was inserted at ingestion (mx_main)
                    and has not yet completed the spam / filter / auth
                    pipeline. Body and parsed fields are present; webhook
                    delivery is not yet scheduled. Most rows transition out
                    of `pending` within seconds.
                  - `accepted`: the inbound passed the policy gates and is
                    queued for webhook delivery. The `webhook_status` field
                    tracks the separate webhook-delivery lifecycle from
                    this point.
                  - `completed`: terminal success. Webhook delivery
                    attempted and acknowledged by every active endpoint, OR
                    no endpoints are configured, so the row is durably
                    archived.
                  - `rejected`: terminal failure at ingestion (spam, blocked
                    sender, filter rule, malformed). The body and metadata
                    are stored for auditing but no webhook fires and the
                    row is not repliable.

                See also `webhook_status` (separate enum tracking the
                webhook-delivery state machine) and `SentEmailStatus` (the
                outbound vocabulary).
            domain (str):
            created_at (datetime.datetime):
            received_at (datetime.datetime):
            webhook_attempt_count (int):
            from_email (str): Bare email address parsed from the `From:` header, with
                display name stripped (e.g. `alice@example.com`). Falls
                back to `sender` (the SMTP envelope MAIL FROM) when the
                `From:` header cannot be parsed.

                **This is the canonical "who sent this email" field for
                most use cases**, including comparing against allowlists,
                routing replies, or displaying the sender to a user. Use
                `from_header` when you specifically need the display name,
                or `sender`/`smtp_mail_from` when you need the SMTP
                envelope value (e.g. to follow a bounce).
            to_email (str): Parsed to address (same as recipient)
            sender_connected_agent_verified (bool): True only when this inbound message matches a send made with the
                current key bound to its sender address as a connected agent.
                Requires exact sent-message and recipient evidence: a verified
                internal delivery, or authenticated SMTP delivery matching the
                sent record. Sender headers, organization keys, and network
                visibility alone cannot make it true. It becomes false if the
                connection is revoked or its bound key is deleted; it is not a
                permanent historical authorship claim.
            replies (list[EmailDetailReply]): Sent emails recorded as replies to this inbound, in send
                order (ascending). Populated when a customer's send-mail
                request carries an `in_reply_to` Message-ID that matches
                this inbound's `message_id` in the same org. Includes
                attempts that were gate-denied, so the array reflects every
                recorded reply attempt regardless of outcome.
            parsed (None | ParsedEmailData): Parsed MIME content (addresses, threading headers,
                attachment metadata), matching the `email.parsed` object
                on the webhook payload so one parser handles both the
                webhook and this endpoint. The top-level `body_text` /
                `body_html` fields above are the same values as
                `parsed.body_text` / `parsed.body_html`, retained for
                backward compatibility. May be null: this field carries message content, which is withheld when the content is
                not available to your credential.
            auth (EmailAuth): SPF / DKIM / DMARC verdicts computed at ingest. Mirrors the
                `email.auth` object on the webhook payload. Field names are
                camelCase to match that payload exactly. For messages received
                before auth was recorded, the verdicts default to `none`.
            reply_count (int): Number of replies recorded against this email: sends whose
                `in_reply_to_email_id` is this email, the same linkage that populates
                `EmailDetail.replies`, excluding sends that never went out (status
                `gate_denied`, `agent_failed`, `canceled`). Queued and scheduled
                replies count. Under an agent connection, only the replies that agent
                can see in `EmailDetail.replies`. Unlike `awaiting`, this counts
                replies to this one email, not to the thread.
            last_replied_at (datetime.datetime | None): `created_at` of the latest reply counted in `reply_count`, or
                null when `reply_count` is 0.
            awaiting (EmailDetailAwaiting): Whose turn it is in this email's conversation. A send counts as a
                reply unless its status is `gate_denied`, `agent_failed`, `canceled`
                (queued and scheduled replies count: they are committed to go). For
                an email with a `thread_id`: `them` when the thread's latest counted
                outbound send (by send `created_at`, including any counted reply to
                this email itself) is at or after the thread's latest inbound message
                (by `received_at`); otherwise `you`. For an email with no
                `thread_id`: `them` when it has at least one counted reply
                (`reply_count > 0` for an API key), otherwise `you`. It is a
                thread-level fact: every email in a thread carries the same value, and
                it reflects sends made by any credential in the organization,
                including other agent connections. It changes without a new inbound
                message, for example when a reply is sent, a queued reply fails, a
                scheduled reply is canceled, or a message is deleted, and is always
                current when read.
            automated (bool): Whether the message was sent by a machine rather than a person.
                An inbound email is `automated` when any of these holds, decided once
                when it arrives: `null_envelope_sender` (an empty MAIL FROM, a bounce);
                `no_identifiable_sender` (no address in the envelope or From);
                `own_address` (a sender address is exactly one of the addresses the
                mail was delivered to; sharing a domain with the recipient is not
                enough, so a colleague or another agent in the organization is not
                automated);
                `mailer_daemon` (mailer-daemon@ or postmaster@ on any domain);
                `auto_submitted` (Auto-Submitted with any keyword but `no`, an
                empty one included);
                `precedence` (Precedence bulk, list, junk or auto_reply);
                `list_unsubscribe` (List-Unsubscribe present); `list_id` (List-Id
                present); `auto_response_suppress` (X-Auto-Response-Suppress asks
                for no automatic reply: All, OOF or AutoReply);
                `failed_recipients` (X-Failed-Recipients present, a bounce);
                `report` (a delivery, feedback or disposition report). Mail
                Primitive's own automatic responders decline to answer is always
                `automated`. The header rules only see headers captured at ingest, so
                older mail may lack them. This is loop and noise protection, not
                sender authentication.
            automated_reasons (list[str]): Why `automated` is true, in rule order; empty when it is false.
                Current values: `null_envelope_sender`, `no_identifiable_sender`,
                `own_address`, `mailer_daemon`, `auto_submitted`, `precedence`,
                `list_unsubscribe`, `list_id`, `auto_response_suppress`,
                `failed_recipients`, `report`. Treat an unfamiliar value as a
                reason added after your client was built.
            from_verified (bool): Whether the From header domain was authenticated when the message arrived. See
                EmailSummary.from_verified.
            from_header_email (None | str): The From header address, lowercased, that `from_verified` is about; null when
                the message had none. Unlike `sender` it is never the envelope address.
            from_name (None | str): Display name from the `From:` header, decoded for display: RFC 2047 encoded words are
                decoded in their declared charset and folded lines are joined (e.g. `Dana Rúiz` for `=?UTF-8?Q?Dana_R=C3=BAiz?=
                <dana@example.com>`). Null when the header carries no display name. For display only: identify the sender by
                `from_email`, never by this name, which the sender chooses freely.
            attachments (list[EmailAttachment]): Attachment metadata (file name, type, size), the same items in the same
                order as `parsed.attachments`. Kept for a credential that reads headers only, where `parsed` is null. Empty when
                the email has none, its content is withheld (read `status` and `rejection_reason`), or it is not parsed yet or
                its parse failed (read `parse_status`). No bytes; download a part with `/emails/{id}/attachments/{part_index}`.
            imported (EmailDetailImportedType0 | None): Historical acquisition; never sender or SMTP delivery proof. Null
                for live mail. Excluded from live tails and deltas.
            snippet (None | str): A plain-text preview of `body_text` (never `body_html`), computed once when the message is
                stored: quoted replies (an "On ... wrote:" line, an "Original Message" separator, a From/Sent header block, `>`
                lines) and a `-- ` signature are cut off, whitespace is collapsed to single spaces, and the result is at most
                200 characters. A message with no text body, or with nothing left once quotes and the signature are cut (a
                quote-only reply), has no snippet. It is not a summary and may end mid-word; read the full body from the detail
                endpoint. Null wherever the detail endpoint would not show the body: no text body, content not yet available or
                discarded, a failed parse, or a sender-blocked rejection.
            message_id (None | str | Unset):
            domain_id (None | Unset | UUID):
            org_id (None | Unset | UUID):
            subject (None | str | Unset):
            body_text (None | str | Unset): Plain-text body parsed from the inbound MIME, matching the
                `email.parsed.body_text` field on the webhook payload. Null when the message had no text part or parsing failed.
            body_html (None | str | Unset): HTML body parsed from the inbound MIME, matching the `email.parsed.body_html`
                field on the webhook payload. Null when the message had no HTML part or parsing failed.
            spam_score (float | None | Unset):
            raw_size_bytes (int | None | Unset):
            raw_sha256 (None | str | Unset):
            rejection_reason (None | str | Unset):
            webhook_status (EmailWebhookStatusType1 | EmailWebhookStatusType2Type1 | EmailWebhookStatusType3Type1 | None |
                Unset): Webhook-delivery state for an inbound email. Tracks a
                SEPARATE lifecycle from the email's `status` field; the
                same row carries both. Possible values:

                  - `pending`: ingestion is past `pending` (the email itself
                    is `accepted`) but the webhook fan-out has not yet
                    started for this row.
                  - `in_flight`: at least one delivery attempt is in flight.
                  - `fired`: terminal success. Every active endpoint
                    acknowledged the delivery (or accepted it after retries).
                  - `failed`: terminal partial-failure. At least one endpoint
                    exhausted its retry budget; some endpoints may still
                    have succeeded.
                  - `exhausted`: terminal failure. Every endpoint exhausted
                    its retry budget without success.
                  - `null`: no endpoints configured, so no webhook lifecycle
                    applies.

                Note that the value `pending` here does NOT mean the email
                is `pending`; it means the email is past ingestion but
                webhook delivery has not yet begun. Two overlapping uses
                of the word `pending` for distinct lifecycle phases.
            webhook_last_attempt_at (datetime.datetime | None | Unset):
            webhook_last_status_code (int | None | Unset):
            webhook_last_error (None | str | Unset):
            webhook_fired_at (datetime.datetime | None | Unset):
            smtp_helo (None | str | Unset):
            smtp_mail_from (None | str | Unset): SMTP envelope MAIL FROM (return-path), as accepted by the
                inbound mail server. Same value as `sender`; both fields
                exist so protocol-aware tooling can use whichever name it
                expects.

                For the canonical "who sent this email" value (display name
                stripped, From-header preferred), use `from_email`.
            smtp_rcpt_to (list[str] | None | Unset):
            from_header (None | str | Unset): Raw `From:` header from the message body, including any
                display name (e.g. `"Alice Example" <alice@example.com>`).
                Use this when you need the display name for rendering.

                For the bare email address (display name stripped), use
                `from_email`. The display name in this raw value may be RFC 2047 encoded (`=?UTF-8?Q?...?=`); use `from_name`
                for the decoded name.
            content_discarded_at (datetime.datetime | None | Unset):
            content_discarded_by_delivery_id (None | str | Unset):
            from_known_address (bool | Unset): True when the inbound's sender address has a matching grant
                in the org's known-send-addresses list. Advisory: a true
                value does not by itself guarantee that a reply will be
                accepted by send-mail's gates; the per-send check at send
                time remains authoritative.
            reply_to_sent_email_id (None | Unset | UUID): The `sent_emails.id` of the outbound this inbound was a
                reply to, when resolvable. Set at inbound ingest by
                matching the parsed In-Reply-To (or References, as a
                fallback) against `sent_emails.message_id` in the same
                org. The mirror of `sent_emails.in_reply_to_email_id` for
                the inbound side of a thread. NULL when the inbound is
                not a threaded reply to one of your sends, when neither
                header survived the path through intermediate MTAs, or on
                inbound received before this auto-link landed.
            thread_id (None | Unset | UUID): Conversation thread this message belongs to. Inbound and
                outbound messages in the same conversation share a
                `thread_id`; fetch `/threads/{thread_id}` for the full
                ordered thread. Assigned at ingest. NULL on messages
                received before threading was enabled (until backfilled).
            presence_control (None | PresenceControl | Unset):
            automation_headers (EmailDetailAutomationHeadersType0 | None | Unset): What the message declared about being
                automated, verbatim:
                `List-Unsubscribe` (RFC 2369/8058), `List-Id` (RFC 2919),
                `Precedence`, and `Auto-Submitted` (RFC 3834). Null or absent when the message
                declared none, and on messages received before these headers
                were captured, so a null value is not evidence that a person
                sent the message.
            repeat (EmailDetailRepeatType0 | None | Unset): Set when Primitive sent this message as part of a repeating
                send. Resolved from Primitive's own records, never from the message content. Null on every other message and on
                servers that predate repeating sends.
            sender_member (EmailDetailSenderMemberType0 | None | Unset):
            fyi (bool | Unset): True when the email is an informational signal (an acknowledgement, read, working or typing
                signal) and nothing else, so it needs no answer, not even another informational reply. Never true for mail from
                the reader's owner. Older servers omit it.
            interaction_hint (str | Unset): How to place this email in a timeline without downloading it: `status`, `card`,
                `none` or `pending`. Not declared as a closed enum so that a value added later does not fail decoding. Decided
                once by the server from the message's authoritative `interaction.json` part, and only when a passing DKIM
                signature covering From and Content-Type authenticates the From that wrote it; the `X-Primitive-Interaction`
                header is never used, so an unsigned or forged message is always `none`. `status`: a pure status signal (`read`,
                `working`, `typing`, or an `ack` in the strict signal shape), shown as a property of the message it is about
                rather than as a row. `card`: an interaction that renders as its own timeline item (for example `ack-request`,
                `wake.dispatch`, `primitive.contact`, `repeat.tick`, `repeat.stop`). `none`: ordinary mail, including any
                interaction kind not listed. `pending`: the email has not finished processing; read it again later. Email
                processed before the field existed is `none`. Treat an unfamiliar value as `none`. Older servers omit it.
            interaction_kind (None | str | Unset): The `<protocol>/<version>` that `interaction_hint` was decided from (for
                example `repeat.tick/1` or `read/1`) when `interaction_hint` is `status` or `card`; null otherwise.
            interaction_candidate (bool | Unset): UNVERIFIED early signal for the `pending` window: true when the raw
                message carries an `X-Primitive-Interaction` header or a MIME part named `interaction.json`, recorded before any
                signature is checked. Use it only to decide, while `interaction_hint` is `pending`, whether to show a
                placeholder instead of the raw text. It is never evidence of an interaction: anyone can set that header or name
                a part that way, so it must not grant trust or select an interaction kind. Ignore it once `interaction_hint` is
                anything other than `pending`.
            relay (EmailDetailRelayType0 | None | Unset): Set when the message reached Primitive through a Primitive mail
                relay. Null for other mail. The field may be absent; treat a missing value the same as null.
            understanding (EmailDetailUnderstandingType0 | None | Unset): Classification facts for this email. Present only
                for an org with email rules, where the body is shown. May be null: this field carries message content, which is
                withheld when the content is not available to your credential.
            shared_through (EmailDetailSharedThroughType0 | None | Unset): The rule share a reader has this email through,
                when that is their only way to it. Null for everyone else.
            parse_status (EmailDetailParseStatusType1 | EmailDetailParseStatusType2Type1 | EmailDetailParseStatusType3Type1
                | None | Unset): Parsing state on inbox, history, arrival and detail reads. Failed is terminal and differs from
                valid empty content (complete). Null covers legacy rows. Optional on shared summaries for compatibility with
                older payloads and other summary endpoints.
            delivery_report (EmailDetailDeliveryReportType0 | None | Unset): Classified inbound delivery notification, or
                null. The linked sent_email_id is resolved within the receiving organization; null means uncorrelated. This is a
                reported outcome, not a rewrite of the original send status. Transient reports may still be retried. Optional
                for older payloads and other summary endpoints.
            muted (bool | Unset): True when the reader's address muted this email's thread with `PUT /threads/{id}/mute`.
                For a connected agent the reader is its own address; for other credentials it is the address the email was
                delivered to.
            collaboration (EmailDetailCollaboration | Unset): Facts for deciding how to act on this email, computed by the
                server under your visibility. Read it before acting: when `newer_inbound_count` is above zero, read the newer
                messages and answer the latest state once. Carries no text the sender wrote.
     """

    id: UUID
    sender: str
    recipient: str
    status: EmailStatus
    domain: str
    created_at: datetime.datetime
    received_at: datetime.datetime
    webhook_attempt_count: int
    from_email: str
    to_email: str
    sender_connected_agent_verified: bool
    replies: list[EmailDetailReply]
    parsed: None | ParsedEmailData
    auth: EmailAuth
    reply_count: int
    last_replied_at: datetime.datetime | None
    awaiting: EmailDetailAwaiting
    automated: bool
    automated_reasons: list[str]
    from_verified: bool
    from_header_email: None | str
    from_name: None | str
    attachments: list[EmailAttachment]
    imported: EmailDetailImportedType0 | None
    snippet: None | str
    message_id: None | str | Unset = UNSET
    domain_id: None | Unset | UUID = UNSET
    org_id: None | Unset | UUID = UNSET
    subject: None | str | Unset = UNSET
    body_text: None | str | Unset = UNSET
    body_html: None | str | Unset = UNSET
    spam_score: float | None | Unset = UNSET
    raw_size_bytes: int | None | Unset = UNSET
    raw_sha256: None | str | Unset = UNSET
    rejection_reason: None | str | Unset = UNSET
    webhook_status: EmailWebhookStatusType1 | EmailWebhookStatusType2Type1 | EmailWebhookStatusType3Type1 | None | Unset = UNSET
    webhook_last_attempt_at: datetime.datetime | None | Unset = UNSET
    webhook_last_status_code: int | None | Unset = UNSET
    webhook_last_error: None | str | Unset = UNSET
    webhook_fired_at: datetime.datetime | None | Unset = UNSET
    smtp_helo: None | str | Unset = UNSET
    smtp_mail_from: None | str | Unset = UNSET
    smtp_rcpt_to: list[str] | None | Unset = UNSET
    from_header: None | str | Unset = UNSET
    content_discarded_at: datetime.datetime | None | Unset = UNSET
    content_discarded_by_delivery_id: None | str | Unset = UNSET
    from_known_address: bool | Unset = UNSET
    reply_to_sent_email_id: None | Unset | UUID = UNSET
    thread_id: None | Unset | UUID = UNSET
    presence_control: None | PresenceControl | Unset = UNSET
    automation_headers: EmailDetailAutomationHeadersType0 | None | Unset = UNSET
    repeat: EmailDetailRepeatType0 | None | Unset = UNSET
    sender_member: EmailDetailSenderMemberType0 | None | Unset = UNSET
    fyi: bool | Unset = UNSET
    interaction_hint: str | Unset = UNSET
    interaction_kind: None | str | Unset = UNSET
    interaction_candidate: bool | Unset = UNSET
    relay: EmailDetailRelayType0 | None | Unset = UNSET
    understanding: EmailDetailUnderstandingType0 | None | Unset = UNSET
    shared_through: EmailDetailSharedThroughType0 | None | Unset = UNSET
    parse_status: EmailDetailParseStatusType1 | EmailDetailParseStatusType2Type1 | EmailDetailParseStatusType3Type1 | None | Unset = UNSET
    delivery_report: EmailDetailDeliveryReportType0 | None | Unset = UNSET
    muted: bool | Unset = UNSET
    collaboration: EmailDetailCollaboration | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_attachment import EmailAttachment # noqa: PLC0415
        from ..models.email_auth import EmailAuth # noqa: PLC0415
        from ..models.email_detail_automation_headers_type_0 import EmailDetailAutomationHeadersType0 # noqa: PLC0415
        from ..models.email_detail_collaboration import EmailDetailCollaboration # noqa: PLC0415
        from ..models.email_detail_delivery_report_type_0 import EmailDetailDeliveryReportType0 # noqa: PLC0415
        from ..models.email_detail_imported_type_0 import EmailDetailImportedType0 # noqa: PLC0415
        from ..models.email_detail_relay_type_0 import EmailDetailRelayType0 # noqa: PLC0415
        from ..models.email_detail_repeat_type_0 import EmailDetailRepeatType0 # noqa: PLC0415
        from ..models.email_detail_reply import EmailDetailReply # noqa: PLC0415
        from ..models.email_detail_sender_member_type_0 import EmailDetailSenderMemberType0 # noqa: PLC0415
        from ..models.email_detail_shared_through_type_0 import EmailDetailSharedThroughType0 # noqa: PLC0415
        from ..models.email_detail_understanding_type_0 import EmailDetailUnderstandingType0 # noqa: PLC0415
        from ..models.parsed_email_data import ParsedEmailData # noqa: PLC0415
        from ..models.presence_control import PresenceControl # noqa: PLC0415
        id = str(self.id)

        sender = self.sender

        recipient = self.recipient

        status = self.status.value

        domain = self.domain

        created_at = self.created_at.isoformat()

        received_at = self.received_at.isoformat()

        webhook_attempt_count = self.webhook_attempt_count

        from_email = self.from_email

        to_email = self.to_email

        sender_connected_agent_verified = self.sender_connected_agent_verified

        replies = []
        for replies_item_data in self.replies:
            replies_item = replies_item_data.to_dict()
            replies.append(replies_item)



        parsed: dict[str, Any] | None
        if isinstance(self.parsed, ParsedEmailData):
            parsed = self.parsed.to_dict()
        else:
            parsed = self.parsed

        auth = self.auth.to_dict()

        reply_count = self.reply_count

        last_replied_at: None | str
        if isinstance(self.last_replied_at, datetime.datetime):
            last_replied_at = self.last_replied_at.isoformat()
        else:
            last_replied_at = self.last_replied_at

        awaiting = self.awaiting.value

        automated = self.automated

        automated_reasons = self.automated_reasons



        from_verified = self.from_verified

        from_header_email: None | str
        from_header_email = self.from_header_email

        from_name: None | str
        from_name = self.from_name

        attachments = []
        for attachments_item_data in self.attachments:
            attachments_item = attachments_item_data.to_dict()
            attachments.append(attachments_item)



        imported: dict[str, Any] | None
        if isinstance(self.imported, EmailDetailImportedType0):
            imported = self.imported.to_dict()
        else:
            imported = self.imported

        snippet: None | str
        snippet = self.snippet

        message_id: None | str | Unset
        if isinstance(self.message_id, Unset):
            message_id = UNSET
        else:
            message_id = self.message_id

        domain_id: None | str | Unset
        if isinstance(self.domain_id, Unset):
            domain_id = UNSET
        elif isinstance(self.domain_id, UUID):
            domain_id = str(self.domain_id)
        else:
            domain_id = self.domain_id

        org_id: None | str | Unset
        if isinstance(self.org_id, Unset):
            org_id = UNSET
        elif isinstance(self.org_id, UUID):
            org_id = str(self.org_id)
        else:
            org_id = self.org_id

        subject: None | str | Unset
        if isinstance(self.subject, Unset):
            subject = UNSET
        else:
            subject = self.subject

        body_text: None | str | Unset
        if isinstance(self.body_text, Unset):
            body_text = UNSET
        else:
            body_text = self.body_text

        body_html: None | str | Unset
        if isinstance(self.body_html, Unset):
            body_html = UNSET
        else:
            body_html = self.body_html

        spam_score: float | None | Unset
        if isinstance(self.spam_score, Unset):
            spam_score = UNSET
        else:
            spam_score = self.spam_score

        raw_size_bytes: int | None | Unset
        if isinstance(self.raw_size_bytes, Unset):
            raw_size_bytes = UNSET
        else:
            raw_size_bytes = self.raw_size_bytes

        raw_sha256: None | str | Unset
        if isinstance(self.raw_sha256, Unset):
            raw_sha256 = UNSET
        else:
            raw_sha256 = self.raw_sha256

        rejection_reason: None | str | Unset
        if isinstance(self.rejection_reason, Unset):
            rejection_reason = UNSET
        else:
            rejection_reason = self.rejection_reason

        webhook_status: None | str | Unset
        if isinstance(self.webhook_status, Unset):
            webhook_status = UNSET
        elif isinstance(self.webhook_status, EmailWebhookStatusType1):
            webhook_status = self.webhook_status.value
        elif isinstance(self.webhook_status, EmailWebhookStatusType2Type1):
            webhook_status = self.webhook_status.value
        elif isinstance(self.webhook_status, EmailWebhookStatusType3Type1):
            webhook_status = self.webhook_status.value
        else:
            webhook_status = self.webhook_status

        webhook_last_attempt_at: None | str | Unset
        if isinstance(self.webhook_last_attempt_at, Unset):
            webhook_last_attempt_at = UNSET
        elif isinstance(self.webhook_last_attempt_at, datetime.datetime):
            webhook_last_attempt_at = self.webhook_last_attempt_at.isoformat()
        else:
            webhook_last_attempt_at = self.webhook_last_attempt_at

        webhook_last_status_code: int | None | Unset
        if isinstance(self.webhook_last_status_code, Unset):
            webhook_last_status_code = UNSET
        else:
            webhook_last_status_code = self.webhook_last_status_code

        webhook_last_error: None | str | Unset
        if isinstance(self.webhook_last_error, Unset):
            webhook_last_error = UNSET
        else:
            webhook_last_error = self.webhook_last_error

        webhook_fired_at: None | str | Unset
        if isinstance(self.webhook_fired_at, Unset):
            webhook_fired_at = UNSET
        elif isinstance(self.webhook_fired_at, datetime.datetime):
            webhook_fired_at = self.webhook_fired_at.isoformat()
        else:
            webhook_fired_at = self.webhook_fired_at

        smtp_helo: None | str | Unset
        if isinstance(self.smtp_helo, Unset):
            smtp_helo = UNSET
        else:
            smtp_helo = self.smtp_helo

        smtp_mail_from: None | str | Unset
        if isinstance(self.smtp_mail_from, Unset):
            smtp_mail_from = UNSET
        else:
            smtp_mail_from = self.smtp_mail_from

        smtp_rcpt_to: list[str] | None | Unset
        if isinstance(self.smtp_rcpt_to, Unset):
            smtp_rcpt_to = UNSET
        elif isinstance(self.smtp_rcpt_to, list):
            smtp_rcpt_to = self.smtp_rcpt_to


        else:
            smtp_rcpt_to = self.smtp_rcpt_to

        from_header: None | str | Unset
        if isinstance(self.from_header, Unset):
            from_header = UNSET
        else:
            from_header = self.from_header

        content_discarded_at: None | str | Unset
        if isinstance(self.content_discarded_at, Unset):
            content_discarded_at = UNSET
        elif isinstance(self.content_discarded_at, datetime.datetime):
            content_discarded_at = self.content_discarded_at.isoformat()
        else:
            content_discarded_at = self.content_discarded_at

        content_discarded_by_delivery_id: None | str | Unset
        if isinstance(self.content_discarded_by_delivery_id, Unset):
            content_discarded_by_delivery_id = UNSET
        else:
            content_discarded_by_delivery_id = self.content_discarded_by_delivery_id

        from_known_address = self.from_known_address

        reply_to_sent_email_id: None | str | Unset
        if isinstance(self.reply_to_sent_email_id, Unset):
            reply_to_sent_email_id = UNSET
        elif isinstance(self.reply_to_sent_email_id, UUID):
            reply_to_sent_email_id = str(self.reply_to_sent_email_id)
        else:
            reply_to_sent_email_id = self.reply_to_sent_email_id

        thread_id: None | str | Unset
        if isinstance(self.thread_id, Unset):
            thread_id = UNSET
        elif isinstance(self.thread_id, UUID):
            thread_id = str(self.thread_id)
        else:
            thread_id = self.thread_id

        presence_control: dict[str, Any] | None | Unset
        if isinstance(self.presence_control, Unset):
            presence_control = UNSET
        elif isinstance(self.presence_control, PresenceControl):
            presence_control = self.presence_control.to_dict()
        else:
            presence_control = self.presence_control

        automation_headers: dict[str, Any] | None | Unset
        if isinstance(self.automation_headers, Unset):
            automation_headers = UNSET
        elif isinstance(self.automation_headers, EmailDetailAutomationHeadersType0):
            automation_headers = self.automation_headers.to_dict()
        else:
            automation_headers = self.automation_headers

        repeat: dict[str, Any] | None | Unset
        if isinstance(self.repeat, Unset):
            repeat = UNSET
        elif isinstance(self.repeat, EmailDetailRepeatType0):
            repeat = self.repeat.to_dict()
        else:
            repeat = self.repeat

        sender_member: dict[str, Any] | None | Unset
        if isinstance(self.sender_member, Unset):
            sender_member = UNSET
        elif isinstance(self.sender_member, EmailDetailSenderMemberType0):
            sender_member = self.sender_member.to_dict()
        else:
            sender_member = self.sender_member

        fyi = self.fyi

        interaction_hint = self.interaction_hint

        interaction_kind: None | str | Unset
        if isinstance(self.interaction_kind, Unset):
            interaction_kind = UNSET
        else:
            interaction_kind = self.interaction_kind

        interaction_candidate = self.interaction_candidate

        relay: dict[str, Any] | None | Unset
        if isinstance(self.relay, Unset):
            relay = UNSET
        elif isinstance(self.relay, EmailDetailRelayType0):
            relay = self.relay.to_dict()
        else:
            relay = self.relay

        understanding: dict[str, Any] | None | Unset
        if isinstance(self.understanding, Unset):
            understanding = UNSET
        elif isinstance(self.understanding, EmailDetailUnderstandingType0):
            understanding = self.understanding.to_dict()
        else:
            understanding = self.understanding

        shared_through: dict[str, Any] | None | Unset
        if isinstance(self.shared_through, Unset):
            shared_through = UNSET
        elif isinstance(self.shared_through, EmailDetailSharedThroughType0):
            shared_through = self.shared_through.to_dict()
        else:
            shared_through = self.shared_through

        parse_status: None | str | Unset
        if isinstance(self.parse_status, Unset):
            parse_status = UNSET
        elif isinstance(self.parse_status, EmailDetailParseStatusType1):
            parse_status = self.parse_status.value
        elif isinstance(self.parse_status, EmailDetailParseStatusType2Type1):
            parse_status = self.parse_status.value
        elif isinstance(self.parse_status, EmailDetailParseStatusType3Type1):
            parse_status = self.parse_status.value
        else:
            parse_status = self.parse_status

        delivery_report: dict[str, Any] | None | Unset
        if isinstance(self.delivery_report, Unset):
            delivery_report = UNSET
        elif isinstance(self.delivery_report, EmailDetailDeliveryReportType0):
            delivery_report = self.delivery_report.to_dict()
        else:
            delivery_report = self.delivery_report

        muted = self.muted

        collaboration: dict[str, Any] | Unset = UNSET
        if not isinstance(self.collaboration, Unset):
            collaboration = self.collaboration.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "sender": sender,
            "recipient": recipient,
            "status": status,
            "domain": domain,
            "created_at": created_at,
            "received_at": received_at,
            "webhook_attempt_count": webhook_attempt_count,
            "from_email": from_email,
            "to_email": to_email,
            "sender_connected_agent_verified": sender_connected_agent_verified,
            "replies": replies,
            "parsed": parsed,
            "auth": auth,
            "reply_count": reply_count,
            "last_replied_at": last_replied_at,
            "awaiting": awaiting,
            "automated": automated,
            "automated_reasons": automated_reasons,
            "from_verified": from_verified,
            "from_header_email": from_header_email,
            "from_name": from_name,
            "attachments": attachments,
            "imported": imported,
            "snippet": snippet,
        })
        if message_id is not UNSET:
            field_dict["message_id"] = message_id
        if domain_id is not UNSET:
            field_dict["domain_id"] = domain_id
        if org_id is not UNSET:
            field_dict["org_id"] = org_id
        if subject is not UNSET:
            field_dict["subject"] = subject
        if body_text is not UNSET:
            field_dict["body_text"] = body_text
        if body_html is not UNSET:
            field_dict["body_html"] = body_html
        if spam_score is not UNSET:
            field_dict["spam_score"] = spam_score
        if raw_size_bytes is not UNSET:
            field_dict["raw_size_bytes"] = raw_size_bytes
        if raw_sha256 is not UNSET:
            field_dict["raw_sha256"] = raw_sha256
        if rejection_reason is not UNSET:
            field_dict["rejection_reason"] = rejection_reason
        if webhook_status is not UNSET:
            field_dict["webhook_status"] = webhook_status
        if webhook_last_attempt_at is not UNSET:
            field_dict["webhook_last_attempt_at"] = webhook_last_attempt_at
        if webhook_last_status_code is not UNSET:
            field_dict["webhook_last_status_code"] = webhook_last_status_code
        if webhook_last_error is not UNSET:
            field_dict["webhook_last_error"] = webhook_last_error
        if webhook_fired_at is not UNSET:
            field_dict["webhook_fired_at"] = webhook_fired_at
        if smtp_helo is not UNSET:
            field_dict["smtp_helo"] = smtp_helo
        if smtp_mail_from is not UNSET:
            field_dict["smtp_mail_from"] = smtp_mail_from
        if smtp_rcpt_to is not UNSET:
            field_dict["smtp_rcpt_to"] = smtp_rcpt_to
        if from_header is not UNSET:
            field_dict["from_header"] = from_header
        if content_discarded_at is not UNSET:
            field_dict["content_discarded_at"] = content_discarded_at
        if content_discarded_by_delivery_id is not UNSET:
            field_dict["content_discarded_by_delivery_id"] = content_discarded_by_delivery_id
        if from_known_address is not UNSET:
            field_dict["from_known_address"] = from_known_address
        if reply_to_sent_email_id is not UNSET:
            field_dict["reply_to_sent_email_id"] = reply_to_sent_email_id
        if thread_id is not UNSET:
            field_dict["thread_id"] = thread_id
        if presence_control is not UNSET:
            field_dict["presence_control"] = presence_control
        if automation_headers is not UNSET:
            field_dict["automation_headers"] = automation_headers
        if repeat is not UNSET:
            field_dict["repeat"] = repeat
        if sender_member is not UNSET:
            field_dict["sender_member"] = sender_member
        if fyi is not UNSET:
            field_dict["fyi"] = fyi
        if interaction_hint is not UNSET:
            field_dict["interaction_hint"] = interaction_hint
        if interaction_kind is not UNSET:
            field_dict["interaction_kind"] = interaction_kind
        if interaction_candidate is not UNSET:
            field_dict["interaction_candidate"] = interaction_candidate
        if relay is not UNSET:
            field_dict["relay"] = relay
        if understanding is not UNSET:
            field_dict["understanding"] = understanding
        if shared_through is not UNSET:
            field_dict["shared_through"] = shared_through
        if parse_status is not UNSET:
            field_dict["parse_status"] = parse_status
        if delivery_report is not UNSET:
            field_dict["delivery_report"] = delivery_report
        if muted is not UNSET:
            field_dict["muted"] = muted
        if collaboration is not UNSET:
            field_dict["collaboration"] = collaboration

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_attachment import EmailAttachment # noqa: PLC0415
        from ..models.email_auth import EmailAuth # noqa: PLC0415
        from ..models.email_detail_automation_headers_type_0 import EmailDetailAutomationHeadersType0 # noqa: PLC0415
        from ..models.email_detail_collaboration import EmailDetailCollaboration # noqa: PLC0415
        from ..models.email_detail_delivery_report_type_0 import EmailDetailDeliveryReportType0 # noqa: PLC0415
        from ..models.email_detail_imported_type_0 import EmailDetailImportedType0 # noqa: PLC0415
        from ..models.email_detail_relay_type_0 import EmailDetailRelayType0 # noqa: PLC0415
        from ..models.email_detail_repeat_type_0 import EmailDetailRepeatType0 # noqa: PLC0415
        from ..models.email_detail_reply import EmailDetailReply # noqa: PLC0415
        from ..models.email_detail_sender_member_type_0 import EmailDetailSenderMemberType0 # noqa: PLC0415
        from ..models.email_detail_shared_through_type_0 import EmailDetailSharedThroughType0 # noqa: PLC0415
        from ..models.email_detail_understanding_type_0 import EmailDetailUnderstandingType0 # noqa: PLC0415
        from ..models.parsed_email_data import ParsedEmailData # noqa: PLC0415
        from ..models.presence_control import PresenceControl # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        sender = d.pop("sender")

        recipient = d.pop("recipient")

        status = EmailStatus(d.pop("status"))




        domain = d.pop("domain")

        created_at = datetime.datetime.fromisoformat(d.pop("created_at"))




        received_at = datetime.datetime.fromisoformat(d.pop("received_at"))




        webhook_attempt_count = d.pop("webhook_attempt_count")

        from_email = d.pop("from_email")

        to_email = d.pop("to_email")

        sender_connected_agent_verified = d.pop("sender_connected_agent_verified")

        replies = []
        _replies = d.pop("replies")
        for replies_item_data in (_replies):
            replies_item = EmailDetailReply.from_dict(replies_item_data)



            replies.append(replies_item)


        def _parse_parsed(data: object) -> None | ParsedEmailData:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                parsed_type_1 = ParsedEmailData.from_dict(data)



                return parsed_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | ParsedEmailData, data)

        parsed = _parse_parsed(d.pop("parsed"))


        auth = EmailAuth.from_dict(d.pop("auth"))




        reply_count = d.pop("reply_count")

        def _parse_last_replied_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                last_replied_at_type_0 = datetime.datetime.fromisoformat(data)



                return last_replied_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        last_replied_at = _parse_last_replied_at(d.pop("last_replied_at"))


        awaiting = EmailDetailAwaiting(d.pop("awaiting"))




        automated = d.pop("automated")

        automated_reasons = cast(list[str], d.pop("automated_reasons"))


        from_verified = d.pop("from_verified")

        def _parse_from_header_email(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        from_header_email = _parse_from_header_email(d.pop("from_header_email"))


        def _parse_from_name(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        from_name = _parse_from_name(d.pop("from_name"))


        attachments = []
        _attachments = d.pop("attachments")
        for attachments_item_data in (_attachments):
            attachments_item = EmailAttachment.from_dict(attachments_item_data)



            attachments.append(attachments_item)


        def _parse_imported(data: object) -> EmailDetailImportedType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                imported_type_0 = EmailDetailImportedType0.from_dict(data)



                return imported_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(EmailDetailImportedType0 | None, data)

        imported = _parse_imported(d.pop("imported"))


        def _parse_snippet(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        snippet = _parse_snippet(d.pop("snippet"))


        def _parse_message_id(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        message_id = _parse_message_id(d.pop("message_id", UNSET))


        def _parse_domain_id(data: object) -> None | Unset | UUID:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                domain_id_type_0 = UUID(data)



                return domain_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | Unset | UUID, data)

        domain_id = _parse_domain_id(d.pop("domain_id", UNSET))


        def _parse_org_id(data: object) -> None | Unset | UUID:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                org_id_type_0 = UUID(data)



                return org_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | Unset | UUID, data)

        org_id = _parse_org_id(d.pop("org_id", UNSET))


        def _parse_subject(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        subject = _parse_subject(d.pop("subject", UNSET))


        def _parse_body_text(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        body_text = _parse_body_text(d.pop("body_text", UNSET))


        def _parse_body_html(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        body_html = _parse_body_html(d.pop("body_html", UNSET))


        def _parse_spam_score(data: object) -> float | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(float | None | Unset, data)

        spam_score = _parse_spam_score(d.pop("spam_score", UNSET))


        def _parse_raw_size_bytes(data: object) -> int | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(int | None | Unset, data)

        raw_size_bytes = _parse_raw_size_bytes(d.pop("raw_size_bytes", UNSET))


        def _parse_raw_sha256(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        raw_sha256 = _parse_raw_sha256(d.pop("raw_sha256", UNSET))


        def _parse_rejection_reason(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        rejection_reason = _parse_rejection_reason(d.pop("rejection_reason", UNSET))


        def _parse_webhook_status(data: object) -> EmailWebhookStatusType1 | EmailWebhookStatusType2Type1 | EmailWebhookStatusType3Type1 | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                componentsschemas_email_webhook_status_type_1 = EmailWebhookStatusType1(data)



                return componentsschemas_email_webhook_status_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                componentsschemas_email_webhook_status_type_2_type_1 = EmailWebhookStatusType2Type1(data)



                return componentsschemas_email_webhook_status_type_2_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                componentsschemas_email_webhook_status_type_3_type_1 = EmailWebhookStatusType3Type1(data)



                return componentsschemas_email_webhook_status_type_3_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(EmailWebhookStatusType1 | EmailWebhookStatusType2Type1 | EmailWebhookStatusType3Type1 | None | Unset, data)

        webhook_status = _parse_webhook_status(d.pop("webhook_status", UNSET))


        def _parse_webhook_last_attempt_at(data: object) -> datetime.datetime | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                webhook_last_attempt_at_type_0 = datetime.datetime.fromisoformat(data)



                return webhook_last_attempt_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None | Unset, data)

        webhook_last_attempt_at = _parse_webhook_last_attempt_at(d.pop("webhook_last_attempt_at", UNSET))


        def _parse_webhook_last_status_code(data: object) -> int | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(int | None | Unset, data)

        webhook_last_status_code = _parse_webhook_last_status_code(d.pop("webhook_last_status_code", UNSET))


        def _parse_webhook_last_error(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        webhook_last_error = _parse_webhook_last_error(d.pop("webhook_last_error", UNSET))


        def _parse_webhook_fired_at(data: object) -> datetime.datetime | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                webhook_fired_at_type_0 = datetime.datetime.fromisoformat(data)



                return webhook_fired_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None | Unset, data)

        webhook_fired_at = _parse_webhook_fired_at(d.pop("webhook_fired_at", UNSET))


        def _parse_smtp_helo(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        smtp_helo = _parse_smtp_helo(d.pop("smtp_helo", UNSET))


        def _parse_smtp_mail_from(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        smtp_mail_from = _parse_smtp_mail_from(d.pop("smtp_mail_from", UNSET))


        def _parse_smtp_rcpt_to(data: object) -> list[str] | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                smtp_rcpt_to_type_0 = cast(list[str], data)

                return smtp_rcpt_to_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[str] | None | Unset, data)

        smtp_rcpt_to = _parse_smtp_rcpt_to(d.pop("smtp_rcpt_to", UNSET))


        def _parse_from_header(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        from_header = _parse_from_header(d.pop("from_header", UNSET))


        def _parse_content_discarded_at(data: object) -> datetime.datetime | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                content_discarded_at_type_0 = datetime.datetime.fromisoformat(data)



                return content_discarded_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None | Unset, data)

        content_discarded_at = _parse_content_discarded_at(d.pop("content_discarded_at", UNSET))


        def _parse_content_discarded_by_delivery_id(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        content_discarded_by_delivery_id = _parse_content_discarded_by_delivery_id(d.pop("content_discarded_by_delivery_id", UNSET))


        from_known_address = d.pop("from_known_address", UNSET)

        def _parse_reply_to_sent_email_id(data: object) -> None | Unset | UUID:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                reply_to_sent_email_id_type_0 = UUID(data)



                return reply_to_sent_email_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | Unset | UUID, data)

        reply_to_sent_email_id = _parse_reply_to_sent_email_id(d.pop("reply_to_sent_email_id", UNSET))


        def _parse_thread_id(data: object) -> None | Unset | UUID:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                thread_id_type_0 = UUID(data)



                return thread_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | Unset | UUID, data)

        thread_id = _parse_thread_id(d.pop("thread_id", UNSET))


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


        def _parse_automation_headers(data: object) -> EmailDetailAutomationHeadersType0 | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                automation_headers_type_0 = EmailDetailAutomationHeadersType0.from_dict(data)



                return automation_headers_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(EmailDetailAutomationHeadersType0 | None | Unset, data)

        automation_headers = _parse_automation_headers(d.pop("automation_headers", UNSET))


        def _parse_repeat(data: object) -> EmailDetailRepeatType0 | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                repeat_type_0 = EmailDetailRepeatType0.from_dict(data)



                return repeat_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(EmailDetailRepeatType0 | None | Unset, data)

        repeat = _parse_repeat(d.pop("repeat", UNSET))


        def _parse_sender_member(data: object) -> EmailDetailSenderMemberType0 | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                sender_member_type_0 = EmailDetailSenderMemberType0.from_dict(data)



                return sender_member_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(EmailDetailSenderMemberType0 | None | Unset, data)

        sender_member = _parse_sender_member(d.pop("sender_member", UNSET))


        fyi = d.pop("fyi", UNSET)

        interaction_hint = d.pop("interaction_hint", UNSET)

        def _parse_interaction_kind(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        interaction_kind = _parse_interaction_kind(d.pop("interaction_kind", UNSET))


        interaction_candidate = d.pop("interaction_candidate", UNSET)

        def _parse_relay(data: object) -> EmailDetailRelayType0 | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                relay_type_0 = EmailDetailRelayType0.from_dict(data)



                return relay_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(EmailDetailRelayType0 | None | Unset, data)

        relay = _parse_relay(d.pop("relay", UNSET))


        def _parse_understanding(data: object) -> EmailDetailUnderstandingType0 | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                understanding_type_0 = EmailDetailUnderstandingType0.from_dict(data)



                return understanding_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(EmailDetailUnderstandingType0 | None | Unset, data)

        understanding = _parse_understanding(d.pop("understanding", UNSET))


        def _parse_shared_through(data: object) -> EmailDetailSharedThroughType0 | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                shared_through_type_0 = EmailDetailSharedThroughType0.from_dict(data)



                return shared_through_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(EmailDetailSharedThroughType0 | None | Unset, data)

        shared_through = _parse_shared_through(d.pop("shared_through", UNSET))


        def _parse_parse_status(data: object) -> EmailDetailParseStatusType1 | EmailDetailParseStatusType2Type1 | EmailDetailParseStatusType3Type1 | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                parse_status_type_1 = EmailDetailParseStatusType1(data)



                return parse_status_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                parse_status_type_2_type_1 = EmailDetailParseStatusType2Type1(data)



                return parse_status_type_2_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                parse_status_type_3_type_1 = EmailDetailParseStatusType3Type1(data)



                return parse_status_type_3_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(EmailDetailParseStatusType1 | EmailDetailParseStatusType2Type1 | EmailDetailParseStatusType3Type1 | None | Unset, data)

        parse_status = _parse_parse_status(d.pop("parse_status", UNSET))


        def _parse_delivery_report(data: object) -> EmailDetailDeliveryReportType0 | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                delivery_report_type_0 = EmailDetailDeliveryReportType0.from_dict(data)



                return delivery_report_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(EmailDetailDeliveryReportType0 | None | Unset, data)

        delivery_report = _parse_delivery_report(d.pop("delivery_report", UNSET))


        muted = d.pop("muted", UNSET)

        _collaboration = d.pop("collaboration", UNSET)
        collaboration: EmailDetailCollaboration | Unset
        if isinstance(_collaboration,  Unset):
            collaboration = UNSET
        else:
            collaboration = EmailDetailCollaboration.from_dict(_collaboration)




        email_detail = cls(
            id=id,
            sender=sender,
            recipient=recipient,
            status=status,
            domain=domain,
            created_at=created_at,
            received_at=received_at,
            webhook_attempt_count=webhook_attempt_count,
            from_email=from_email,
            to_email=to_email,
            sender_connected_agent_verified=sender_connected_agent_verified,
            replies=replies,
            parsed=parsed,
            auth=auth,
            reply_count=reply_count,
            last_replied_at=last_replied_at,
            awaiting=awaiting,
            automated=automated,
            automated_reasons=automated_reasons,
            from_verified=from_verified,
            from_header_email=from_header_email,
            from_name=from_name,
            attachments=attachments,
            imported=imported,
            snippet=snippet,
            message_id=message_id,
            domain_id=domain_id,
            org_id=org_id,
            subject=subject,
            body_text=body_text,
            body_html=body_html,
            spam_score=spam_score,
            raw_size_bytes=raw_size_bytes,
            raw_sha256=raw_sha256,
            rejection_reason=rejection_reason,
            webhook_status=webhook_status,
            webhook_last_attempt_at=webhook_last_attempt_at,
            webhook_last_status_code=webhook_last_status_code,
            webhook_last_error=webhook_last_error,
            webhook_fired_at=webhook_fired_at,
            smtp_helo=smtp_helo,
            smtp_mail_from=smtp_mail_from,
            smtp_rcpt_to=smtp_rcpt_to,
            from_header=from_header,
            content_discarded_at=content_discarded_at,
            content_discarded_by_delivery_id=content_discarded_by_delivery_id,
            from_known_address=from_known_address,
            reply_to_sent_email_id=reply_to_sent_email_id,
            thread_id=thread_id,
            presence_control=presence_control,
            automation_headers=automation_headers,
            repeat=repeat,
            sender_member=sender_member,
            fyi=fyi,
            interaction_hint=interaction_hint,
            interaction_kind=interaction_kind,
            interaction_candidate=interaction_candidate,
            relay=relay,
            understanding=understanding,
            shared_through=shared_through,
            parse_status=parse_status,
            delivery_report=delivery_report,
            muted=muted,
            collaboration=collaboration,
        )


        email_detail.additional_properties = d
        return email_detail

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
