from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.sent_email_status import SentEmailStatus
from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.gate_denial import GateDenial





T = TypeVar("T", bound="SentEmailSummary")



@_attrs_define
class SentEmailSummary:
    """ List-row projection of a sent-email record. Drops
    `body_text` and `body_html` to keep paginated responses
    small; fetch /sent-emails/{id} for the full record with
    bodies.

        Attributes:
            id (UUID):
            status (SentEmailStatus): Lifecycle status of a sent_emails row. Possible values:

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
            status_changed_at (datetime.datetime): Timestamp of the most recent status transition.
                Polling clients should treat `status='queued'` AND
                `status_changed_at` older than 5 minutes as
                "stuck-queued" (the post-tx UPDATE failed and the
                actual delivery state is recoverable from on-box logs
                via `queue_id` when populated, or `request_id`).
            created_at (datetime.datetime):
            updated_at (datetime.datetime):
            content_hash (str): Stable hash of the canonical send payload.
            from_header (str): Raw `From:` header as sent on the wire, including any
                display name (e.g. `"Acme Support" <agent@acme.test>`).
            from_address (str): Bare email address parsed from `from_header`.
            to_header (str): Raw `To:` header as sent on the wire, including any
                display name.
            to_address (str): Bare email address parsed from `to_header`.
            subject (str):
            body_size_bytes (int): Total UTF-8 byte length of `body_text` + `body_html`.
                Surfaced on the list endpoint so callers can see "this
                row has a 4MB body" without fetching it.
            client_idempotency_key (None | str | Unset): Effective idempotency key used for this send. If the
                caller passed the `Idempotency-Key` header, this is
                that value; otherwise it's a server-derived hash of
                the canonical request payload.
            content_discarded_at (datetime.datetime | None | Unset): Timestamp at which the bodies were discarded by an
                entitlement-driven retention policy. Null when bodies
                are still present. The detail endpoint returns
                null-valued `body_text`/`body_html` for discarded rows.
            message_id (None | str | Unset): Wire-level Message-ID assigned to the outbound message
                (RFC 5322). Null on rows that never reached signing
                (queued, gate_denied, agent_failed before signing).
            in_reply_to (None | str | Unset): Wire-level In-Reply-To header value, when this send
                was a reply.
            email_references (None | str | Unset): Wire-level References header value, when this send
                was a reply.
            in_reply_to_email_id (None | Unset | UUID): Reference to the inbound `emails.id` that this send
                replied to, when known. Populated when the caller used
                /emails/{id}/reply or when /send-mail's `in_reply_to`
                matched a stored inbound message_id in the same org.
            thread_id (None | Unset | UUID): Conversation thread this send belongs to. A reply inherits
                the thread of the inbound it answers; a fresh send starts a
                new thread. Fetch `/threads/{thread_id}` for the full
                ordered thread (inbound + outbound interleaved). NULL on
                gate-denied sends and on sends created before threading was
                enabled.
            queue_id (None | str | Unset): Message identifier assigned by Primitive's outbound
                relay once the agent accepts the message. Null on
                queued, gate_denied, and agent_failed rows.
            smtp_response_code (int | None | Unset): Receiver's 3-digit SMTP code (e.g. 250, 550, 451).
                Populated on terminal delivery statuses; may be null
                on a deferred where the agent never got an SMTP-level
                response (TCP refused, DNS failed, TLS handshake
                failed). `smtp_response_text` still carries Postfix's
                descriptive text in those cases.
            smtp_response_text (None | str | Unset): Free-form text portion of the receiver's SMTP
                response. The most useful debugging signal on a
                `bounced` or `deferred` row.
            smtp_enhanced_status_code (None | str | Unset): RFC 3463 enhanced status code (e.g. `5.1.1` for "Bad
                destination mailbox address"). Distinct from
                `smtp_response_code`: the basic 3-digit code is coarse
                (550 = "permanent failure"), the enhanced code is
                finer-grained.
            dkim_selector (None | str | Unset): DKIM selector used to sign the outbound message.
                Public DNS data; useful for diagnosing why a downstream
                verifier rejected the signature.
            dkim_domain (None | str | Unset): DKIM signing domain.
            error_code (None | str | Unset): Stable public error code on `agent_failed` rows. The
                agent's internal codes are remapped to a stable public
                taxonomy (see `publicAgentError` in the server) so this
                field is safe to branch on across agent versions.
            error_message (None | str | Unset): Free-form error message accompanying `error_code`.
            gates (list[GateDenial] | None | Unset): Gate-denial detail on `gate_denied` rows. Mirrors the
                synchronous /send-mail 403 contract so a caller's
                GateDenial handler is the same across live denies and
                historical lookups. Null on every other status.
            request_id (None | str | Unset): Server-issued request identifier from the original
                /send-mail call. Surfaced as the `X-Request-Id`
                response header on the live send and recorded here
                for support escalation.
     """

    id: UUID
    status: SentEmailStatus
    status_changed_at: datetime.datetime
    created_at: datetime.datetime
    updated_at: datetime.datetime
    content_hash: str
    from_header: str
    from_address: str
    to_header: str
    to_address: str
    subject: str
    body_size_bytes: int
    client_idempotency_key: None | str | Unset = UNSET
    content_discarded_at: datetime.datetime | None | Unset = UNSET
    message_id: None | str | Unset = UNSET
    in_reply_to: None | str | Unset = UNSET
    email_references: None | str | Unset = UNSET
    in_reply_to_email_id: None | Unset | UUID = UNSET
    thread_id: None | Unset | UUID = UNSET
    queue_id: None | str | Unset = UNSET
    smtp_response_code: int | None | Unset = UNSET
    smtp_response_text: None | str | Unset = UNSET
    smtp_enhanced_status_code: None | str | Unset = UNSET
    dkim_selector: None | str | Unset = UNSET
    dkim_domain: None | str | Unset = UNSET
    error_code: None | str | Unset = UNSET
    error_message: None | str | Unset = UNSET
    gates: list[GateDenial] | None | Unset = UNSET
    request_id: None | str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.gate_denial import GateDenial
        id = str(self.id)

        status = self.status.value

        status_changed_at = self.status_changed_at.isoformat()

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()

        content_hash = self.content_hash

        from_header = self.from_header

        from_address = self.from_address

        to_header = self.to_header

        to_address = self.to_address

        subject = self.subject

        body_size_bytes = self.body_size_bytes

        client_idempotency_key: None | str | Unset
        if isinstance(self.client_idempotency_key, Unset):
            client_idempotency_key = UNSET
        else:
            client_idempotency_key = self.client_idempotency_key

        content_discarded_at: None | str | Unset
        if isinstance(self.content_discarded_at, Unset):
            content_discarded_at = UNSET
        elif isinstance(self.content_discarded_at, datetime.datetime):
            content_discarded_at = self.content_discarded_at.isoformat()
        else:
            content_discarded_at = self.content_discarded_at

        message_id: None | str | Unset
        if isinstance(self.message_id, Unset):
            message_id = UNSET
        else:
            message_id = self.message_id

        in_reply_to: None | str | Unset
        if isinstance(self.in_reply_to, Unset):
            in_reply_to = UNSET
        else:
            in_reply_to = self.in_reply_to

        email_references: None | str | Unset
        if isinstance(self.email_references, Unset):
            email_references = UNSET
        else:
            email_references = self.email_references

        in_reply_to_email_id: None | str | Unset
        if isinstance(self.in_reply_to_email_id, Unset):
            in_reply_to_email_id = UNSET
        elif isinstance(self.in_reply_to_email_id, UUID):
            in_reply_to_email_id = str(self.in_reply_to_email_id)
        else:
            in_reply_to_email_id = self.in_reply_to_email_id

        thread_id: None | str | Unset
        if isinstance(self.thread_id, Unset):
            thread_id = UNSET
        elif isinstance(self.thread_id, UUID):
            thread_id = str(self.thread_id)
        else:
            thread_id = self.thread_id

        queue_id: None | str | Unset
        if isinstance(self.queue_id, Unset):
            queue_id = UNSET
        else:
            queue_id = self.queue_id

        smtp_response_code: int | None | Unset
        if isinstance(self.smtp_response_code, Unset):
            smtp_response_code = UNSET
        else:
            smtp_response_code = self.smtp_response_code

        smtp_response_text: None | str | Unset
        if isinstance(self.smtp_response_text, Unset):
            smtp_response_text = UNSET
        else:
            smtp_response_text = self.smtp_response_text

        smtp_enhanced_status_code: None | str | Unset
        if isinstance(self.smtp_enhanced_status_code, Unset):
            smtp_enhanced_status_code = UNSET
        else:
            smtp_enhanced_status_code = self.smtp_enhanced_status_code

        dkim_selector: None | str | Unset
        if isinstance(self.dkim_selector, Unset):
            dkim_selector = UNSET
        else:
            dkim_selector = self.dkim_selector

        dkim_domain: None | str | Unset
        if isinstance(self.dkim_domain, Unset):
            dkim_domain = UNSET
        else:
            dkim_domain = self.dkim_domain

        error_code: None | str | Unset
        if isinstance(self.error_code, Unset):
            error_code = UNSET
        else:
            error_code = self.error_code

        error_message: None | str | Unset
        if isinstance(self.error_message, Unset):
            error_message = UNSET
        else:
            error_message = self.error_message

        gates: list[dict[str, Any]] | None | Unset
        if isinstance(self.gates, Unset):
            gates = UNSET
        elif isinstance(self.gates, list):
            gates = []
            for gates_type_0_item_data in self.gates:
                gates_type_0_item = gates_type_0_item_data.to_dict()
                gates.append(gates_type_0_item)


        else:
            gates = self.gates

        request_id: None | str | Unset
        if isinstance(self.request_id, Unset):
            request_id = UNSET
        else:
            request_id = self.request_id


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "status": status,
            "status_changed_at": status_changed_at,
            "created_at": created_at,
            "updated_at": updated_at,
            "content_hash": content_hash,
            "from_header": from_header,
            "from_address": from_address,
            "to_header": to_header,
            "to_address": to_address,
            "subject": subject,
            "body_size_bytes": body_size_bytes,
        })
        if client_idempotency_key is not UNSET:
            field_dict["client_idempotency_key"] = client_idempotency_key
        if content_discarded_at is not UNSET:
            field_dict["content_discarded_at"] = content_discarded_at
        if message_id is not UNSET:
            field_dict["message_id"] = message_id
        if in_reply_to is not UNSET:
            field_dict["in_reply_to"] = in_reply_to
        if email_references is not UNSET:
            field_dict["email_references"] = email_references
        if in_reply_to_email_id is not UNSET:
            field_dict["in_reply_to_email_id"] = in_reply_to_email_id
        if thread_id is not UNSET:
            field_dict["thread_id"] = thread_id
        if queue_id is not UNSET:
            field_dict["queue_id"] = queue_id
        if smtp_response_code is not UNSET:
            field_dict["smtp_response_code"] = smtp_response_code
        if smtp_response_text is not UNSET:
            field_dict["smtp_response_text"] = smtp_response_text
        if smtp_enhanced_status_code is not UNSET:
            field_dict["smtp_enhanced_status_code"] = smtp_enhanced_status_code
        if dkim_selector is not UNSET:
            field_dict["dkim_selector"] = dkim_selector
        if dkim_domain is not UNSET:
            field_dict["dkim_domain"] = dkim_domain
        if error_code is not UNSET:
            field_dict["error_code"] = error_code
        if error_message is not UNSET:
            field_dict["error_message"] = error_message
        if gates is not UNSET:
            field_dict["gates"] = gates
        if request_id is not UNSET:
            field_dict["request_id"] = request_id

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.gate_denial import GateDenial
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        status = SentEmailStatus(d.pop("status"))




        status_changed_at = isoparse(d.pop("status_changed_at"))




        created_at = isoparse(d.pop("created_at"))




        updated_at = isoparse(d.pop("updated_at"))




        content_hash = d.pop("content_hash")

        from_header = d.pop("from_header")

        from_address = d.pop("from_address")

        to_header = d.pop("to_header")

        to_address = d.pop("to_address")

        subject = d.pop("subject")

        body_size_bytes = d.pop("body_size_bytes")

        def _parse_client_idempotency_key(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        client_idempotency_key = _parse_client_idempotency_key(d.pop("client_idempotency_key", UNSET))


        def _parse_content_discarded_at(data: object) -> datetime.datetime | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                content_discarded_at_type_0 = isoparse(data)



                return content_discarded_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None | Unset, data)

        content_discarded_at = _parse_content_discarded_at(d.pop("content_discarded_at", UNSET))


        def _parse_message_id(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        message_id = _parse_message_id(d.pop("message_id", UNSET))


        def _parse_in_reply_to(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        in_reply_to = _parse_in_reply_to(d.pop("in_reply_to", UNSET))


        def _parse_email_references(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        email_references = _parse_email_references(d.pop("email_references", UNSET))


        def _parse_in_reply_to_email_id(data: object) -> None | Unset | UUID:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                in_reply_to_email_id_type_0 = UUID(data)



                return in_reply_to_email_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | Unset | UUID, data)

        in_reply_to_email_id = _parse_in_reply_to_email_id(d.pop("in_reply_to_email_id", UNSET))


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


        def _parse_queue_id(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        queue_id = _parse_queue_id(d.pop("queue_id", UNSET))


        def _parse_smtp_response_code(data: object) -> int | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(int | None | Unset, data)

        smtp_response_code = _parse_smtp_response_code(d.pop("smtp_response_code", UNSET))


        def _parse_smtp_response_text(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        smtp_response_text = _parse_smtp_response_text(d.pop("smtp_response_text", UNSET))


        def _parse_smtp_enhanced_status_code(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        smtp_enhanced_status_code = _parse_smtp_enhanced_status_code(d.pop("smtp_enhanced_status_code", UNSET))


        def _parse_dkim_selector(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        dkim_selector = _parse_dkim_selector(d.pop("dkim_selector", UNSET))


        def _parse_dkim_domain(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        dkim_domain = _parse_dkim_domain(d.pop("dkim_domain", UNSET))


        def _parse_error_code(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        error_code = _parse_error_code(d.pop("error_code", UNSET))


        def _parse_error_message(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        error_message = _parse_error_message(d.pop("error_message", UNSET))


        def _parse_gates(data: object) -> list[GateDenial] | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                gates_type_0 = []
                _gates_type_0 = data
                for gates_type_0_item_data in (_gates_type_0):
                    gates_type_0_item = GateDenial.from_dict(gates_type_0_item_data)



                    gates_type_0.append(gates_type_0_item)

                return gates_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[GateDenial] | None | Unset, data)

        gates = _parse_gates(d.pop("gates", UNSET))


        def _parse_request_id(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        request_id = _parse_request_id(d.pop("request_id", UNSET))


        sent_email_summary = cls(
            id=id,
            status=status,
            status_changed_at=status_changed_at,
            created_at=created_at,
            updated_at=updated_at,
            content_hash=content_hash,
            from_header=from_header,
            from_address=from_address,
            to_header=to_header,
            to_address=to_address,
            subject=subject,
            body_size_bytes=body_size_bytes,
            client_idempotency_key=client_idempotency_key,
            content_discarded_at=content_discarded_at,
            message_id=message_id,
            in_reply_to=in_reply_to,
            email_references=email_references,
            in_reply_to_email_id=in_reply_to_email_id,
            thread_id=thread_id,
            queue_id=queue_id,
            smtp_response_code=smtp_response_code,
            smtp_response_text=smtp_response_text,
            smtp_enhanced_status_code=smtp_enhanced_status_code,
            dkim_selector=dkim_selector,
            dkim_domain=dkim_domain,
            error_code=error_code,
            error_message=error_message,
            gates=gates,
            request_id=request_id,
        )


        sent_email_summary.additional_properties = d
        return sent_email_summary

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
