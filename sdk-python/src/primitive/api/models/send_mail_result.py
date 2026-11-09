from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.delivery_status import DeliveryStatus
from ..models.send_mail_result_dedup_reason_type_1 import SendMailResultDedupReasonType1
from ..models.send_mail_result_dedup_reason_type_2_type_1 import SendMailResultDedupReasonType2Type1
from ..models.send_mail_result_dedup_reason_type_3_type_1 import SendMailResultDedupReasonType3Type1
from ..models.sent_email_status import SentEmailStatus
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.send_mail_idempotency_replay import SendMailIdempotencyReplay





T = TypeVar("T", bound="SendMailResult")



@_attrs_define
class SendMailResult:
    """ 
        Attributes:
            id (str): Persisted sent-email attempt ID.
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
                  - `scheduled`: created with a future `scheduled_at` and
                    not yet executed; `scheduled_at` carries the pending
                    execution time. Reschedulable via PATCH
                    /sent-emails/{id} and cancelable via
                    /sent-emails/{id}/cancel while in this status.
                  - `canceled`: terminal; a scheduled send canceled before
                    execution. `canceled_at` carries the cancellation time
                    and nothing was dispatched.
            from_ (str): Bare from-address actually written on the wire. Echoed
                on every success branch so callers can confirm what
                went out, particularly useful for the /emails/{id}/reply
                path where `from` is server-derived from the inbound's
                recipient when the caller doesn't override.

                For sends where the caller passed a from-header that
                included a display name (e.g. `"Acme Support" <support@acme.test>`),
                this field is the parsed bare address (`support@acme.test`).
                The display name was sent on the wire intact; this field
                just makes the address easy to compare against allowlists.
            queue_id (None | str): Message identifier assigned by Primitive's OUTBOUND relay
                (the box that signs your mail and submits it to the
                receiving MTA). NOT the receiver's queue id.

                The receiver may also report its own queue id in
                `smtp_response_text` (e.g. `"250 2.0.0 Ok: queued as
                99D111927CDA"`). Those two ids
                refer to different mail systems and are NOT comparable.
                Treat `queue_id` as Primitive-internal and the
                receiver's id as remote-system-internal.

                Null on rows that never reached the relay (queued,
                gate_denied, agent_failed before signing).
            accepted (list[str]): Recipient addresses accepted by the relay.
            rejected (list[str]): Recipient addresses rejected by the relay.
            client_idempotency_key (None | str): Effective idempotency key used for this send. Null when a replayed send was
                stored without one.
            request_id (None | str): Server-issued request identifier for support and tracing. Null when a replayed send was
                stored without one.
            content_hash (str): Stable hash of the canonical send payload.
            idempotent_replay (bool): True when the response replays a previously-recorded send
                keyed by `client_idempotency_key` (same key, same canonical
                payload). False on a fresh send and on gate-denied
                responses. Lets callers branch on cache state without
                diffing fields.
            repeat_id (UUID | Unset): Present when the request carried `repeat`. Manage it under `/repeating-sends/{id}`.
            delivery_status (DeliveryStatus | Unset): Narrower enum covering only the four terminal delivery
                outcomes returned to a synchronous `wait: true` send.

                On the SendMailResult shape, `delivery_status` is always
                equal to `status` whenever both are present (i.e. on
                terminal-state replays and live wait=true responses).
                The two fields exist so callers that want to type-narrow
                on "this is a delivery outcome" can pattern-match against
                the four-value enum without handling the broader
                SentEmailStatus value set (which also covers `queued`,
                `submitted_to_agent`, `agent_failed`, `gate_denied`,
                `unknown`).

                On async-mode and pre-terminal responses, `delivery_status`
                is absent and only `status` is populated. Use `status` if
                you want a single field that's always present.
            smtp_response_code (int | None | Unset): SMTP response code from the first downstream delivery outcome when wait
                is true.
            smtp_response_text (str | Unset): SMTP response text from the first downstream delivery outcome when wait is
                true.
            scheduled_at (datetime.datetime | Unset): Echoed requested execution time on a `scheduled`
                response. On scheduled creates, nothing is dispatched
                yet: `queue_id` is null and `accepted` / `rejected` are
                empty. Absent on immediate sends.
            smtp_enhanced_status_code (None | str | Unset): Enhanced SMTP status code (for example `2.0.0`) from the first
                downstream delivery outcome when wait is true, or null when the server did not report one.
            idempotency (SendMailIdempotencyReplay | Unset): Present only when the request was answered with an existing
                send instead of making a new one (`idempotent_replay: true`). Nothing was sent for this request. Says how the
                idempotency key was derived and which send the request collapsed onto.
            dedup_reason (None | SendMailResultDedupReasonType1 | SendMailResultDedupReasonType2Type1 |
                SendMailResultDedupReasonType3Type1 | Unset): Why the request was answered with an existing send. Set on every
                replay (`idempotent_replay: true`), whether it answers with `200` or with the stored error of an earlier send
                that failed. `content_hash_match`: the request's idempotency key matched an earlier send. That key is the
                `Idempotency-Key` header when one was sent, otherwise the key derived from the request content (see
                `idempotency.key_source`). `parent_already_replied`: a send with no `Idempotency-Key` collapsed onto an earlier
                reply to the same inbound email made in the last 5 minutes (at any time for a retry from the same Function
                answering the same inbound email) with the same credential, the same `from`, the same set of recipients (`to`,
                `cc`, `bcc`) and the same `in_reply_to`, even though its body differs. Any other difference is sent. Pass an
                `Idempotency-Key` to send a second reply. Absent or null on a request that made a send of its own.
            deduplicated (bool | Unset): Present and `true` when nothing was sent for this request because it collapsed onto
                an earlier send (`original_sent_email_id`). Absent on a request that made a send of its own.
            original_sent_email_id (UUID | Unset): With `deduplicated: true`: the earlier send this request collapsed onto.
                Same value as `id`.
     """

    id: str
    status: SentEmailStatus
    from_: str
    queue_id: None | str
    accepted: list[str]
    rejected: list[str]
    client_idempotency_key: None | str
    request_id: None | str
    content_hash: str
    idempotent_replay: bool
    repeat_id: UUID | Unset = UNSET
    delivery_status: DeliveryStatus | Unset = UNSET
    smtp_response_code: int | None | Unset = UNSET
    smtp_response_text: str | Unset = UNSET
    scheduled_at: datetime.datetime | Unset = UNSET
    smtp_enhanced_status_code: None | str | Unset = UNSET
    idempotency: SendMailIdempotencyReplay | Unset = UNSET
    dedup_reason: None | SendMailResultDedupReasonType1 | SendMailResultDedupReasonType2Type1 | SendMailResultDedupReasonType3Type1 | Unset = UNSET
    deduplicated: bool | Unset = UNSET
    original_sent_email_id: UUID | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.send_mail_idempotency_replay import SendMailIdempotencyReplay # noqa: PLC0415
        id = self.id

        status = self.status.value

        from_ = self.from_

        queue_id: None | str
        queue_id = self.queue_id

        accepted = self.accepted



        rejected = self.rejected



        client_idempotency_key: None | str
        client_idempotency_key = self.client_idempotency_key

        request_id: None | str
        request_id = self.request_id

        content_hash = self.content_hash

        idempotent_replay = self.idempotent_replay

        repeat_id: str | Unset = UNSET
        if not isinstance(self.repeat_id, Unset):
            repeat_id = str(self.repeat_id)

        delivery_status: str | Unset = UNSET
        if not isinstance(self.delivery_status, Unset):
            delivery_status = self.delivery_status.value


        smtp_response_code: int | None | Unset
        if isinstance(self.smtp_response_code, Unset):
            smtp_response_code = UNSET
        else:
            smtp_response_code = self.smtp_response_code

        smtp_response_text = self.smtp_response_text

        scheduled_at: str | Unset = UNSET
        if not isinstance(self.scheduled_at, Unset):
            scheduled_at = self.scheduled_at.isoformat()

        smtp_enhanced_status_code: None | str | Unset
        if isinstance(self.smtp_enhanced_status_code, Unset):
            smtp_enhanced_status_code = UNSET
        else:
            smtp_enhanced_status_code = self.smtp_enhanced_status_code

        idempotency: dict[str, Any] | Unset = UNSET
        if not isinstance(self.idempotency, Unset):
            idempotency = self.idempotency.to_dict()

        dedup_reason: None | str | Unset
        if isinstance(self.dedup_reason, Unset):
            dedup_reason = UNSET
        elif isinstance(self.dedup_reason, SendMailResultDedupReasonType1):
            dedup_reason = self.dedup_reason.value
        elif isinstance(self.dedup_reason, SendMailResultDedupReasonType2Type1):
            dedup_reason = self.dedup_reason.value
        elif isinstance(self.dedup_reason, SendMailResultDedupReasonType3Type1):
            dedup_reason = self.dedup_reason.value
        else:
            dedup_reason = self.dedup_reason

        deduplicated = self.deduplicated

        original_sent_email_id: str | Unset = UNSET
        if not isinstance(self.original_sent_email_id, Unset):
            original_sent_email_id = str(self.original_sent_email_id)


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "status": status,
            "from": from_,
            "queue_id": queue_id,
            "accepted": accepted,
            "rejected": rejected,
            "client_idempotency_key": client_idempotency_key,
            "request_id": request_id,
            "content_hash": content_hash,
            "idempotent_replay": idempotent_replay,
        })
        if repeat_id is not UNSET:
            field_dict["repeat_id"] = repeat_id
        if delivery_status is not UNSET:
            field_dict["delivery_status"] = delivery_status
        if smtp_response_code is not UNSET:
            field_dict["smtp_response_code"] = smtp_response_code
        if smtp_response_text is not UNSET:
            field_dict["smtp_response_text"] = smtp_response_text
        if scheduled_at is not UNSET:
            field_dict["scheduled_at"] = scheduled_at
        if smtp_enhanced_status_code is not UNSET:
            field_dict["smtp_enhanced_status_code"] = smtp_enhanced_status_code
        if idempotency is not UNSET:
            field_dict["idempotency"] = idempotency
        if dedup_reason is not UNSET:
            field_dict["dedup_reason"] = dedup_reason
        if deduplicated is not UNSET:
            field_dict["deduplicated"] = deduplicated
        if original_sent_email_id is not UNSET:
            field_dict["original_sent_email_id"] = original_sent_email_id

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.send_mail_idempotency_replay import SendMailIdempotencyReplay # noqa: PLC0415
        d = dict(src_dict)
        id = d.pop("id")

        status = SentEmailStatus(d.pop("status"))




        from_ = d.pop("from")

        def _parse_queue_id(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        queue_id = _parse_queue_id(d.pop("queue_id"))


        accepted = cast(list[str], d.pop("accepted"))


        rejected = cast(list[str], d.pop("rejected"))


        def _parse_client_idempotency_key(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        client_idempotency_key = _parse_client_idempotency_key(d.pop("client_idempotency_key"))


        def _parse_request_id(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        request_id = _parse_request_id(d.pop("request_id"))


        content_hash = d.pop("content_hash")

        idempotent_replay = d.pop("idempotent_replay")

        _repeat_id = d.pop("repeat_id", UNSET)
        repeat_id: UUID | Unset
        if isinstance(_repeat_id,  Unset):
            repeat_id = UNSET
        else:
            repeat_id = UUID(_repeat_id)




        _delivery_status = d.pop("delivery_status", UNSET)
        delivery_status: DeliveryStatus | Unset
        if isinstance(_delivery_status,  Unset):
            delivery_status = UNSET
        else:
            delivery_status = DeliveryStatus(_delivery_status)




        def _parse_smtp_response_code(data: object) -> int | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(int | None | Unset, data)

        smtp_response_code = _parse_smtp_response_code(d.pop("smtp_response_code", UNSET))


        smtp_response_text = d.pop("smtp_response_text", UNSET)

        _scheduled_at = d.pop("scheduled_at", UNSET)
        scheduled_at: datetime.datetime | Unset
        if isinstance(_scheduled_at,  Unset):
            scheduled_at = UNSET
        else:
            scheduled_at = datetime.datetime.fromisoformat(_scheduled_at)




        def _parse_smtp_enhanced_status_code(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        smtp_enhanced_status_code = _parse_smtp_enhanced_status_code(d.pop("smtp_enhanced_status_code", UNSET))


        _idempotency = d.pop("idempotency", UNSET)
        idempotency: SendMailIdempotencyReplay | Unset
        if isinstance(_idempotency,  Unset):
            idempotency = UNSET
        else:
            idempotency = SendMailIdempotencyReplay.from_dict(_idempotency)




        def _parse_dedup_reason(data: object) -> None | SendMailResultDedupReasonType1 | SendMailResultDedupReasonType2Type1 | SendMailResultDedupReasonType3Type1 | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                dedup_reason_type_1 = SendMailResultDedupReasonType1(data)



                return dedup_reason_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                dedup_reason_type_2_type_1 = SendMailResultDedupReasonType2Type1(data)



                return dedup_reason_type_2_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                dedup_reason_type_3_type_1 = SendMailResultDedupReasonType3Type1(data)



                return dedup_reason_type_3_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | SendMailResultDedupReasonType1 | SendMailResultDedupReasonType2Type1 | SendMailResultDedupReasonType3Type1 | Unset, data)

        dedup_reason = _parse_dedup_reason(d.pop("dedup_reason", UNSET))


        deduplicated = d.pop("deduplicated", UNSET)

        _original_sent_email_id = d.pop("original_sent_email_id", UNSET)
        original_sent_email_id: UUID | Unset
        if isinstance(_original_sent_email_id,  Unset):
            original_sent_email_id = UNSET
        else:
            original_sent_email_id = UUID(_original_sent_email_id)




        send_mail_result = cls(
            id=id,
            status=status,
            from_=from_,
            queue_id=queue_id,
            accepted=accepted,
            rejected=rejected,
            client_idempotency_key=client_idempotency_key,
            request_id=request_id,
            content_hash=content_hash,
            idempotent_replay=idempotent_replay,
            repeat_id=repeat_id,
            delivery_status=delivery_status,
            smtp_response_code=smtp_response_code,
            smtp_response_text=smtp_response_text,
            scheduled_at=scheduled_at,
            smtp_enhanced_status_code=smtp_enhanced_status_code,
            idempotency=idempotency,
            dedup_reason=dedup_reason,
            deduplicated=deduplicated,
            original_sent_email_id=original_sent_email_id,
        )


        send_mail_result.additional_properties = d
        return send_mail_result

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
