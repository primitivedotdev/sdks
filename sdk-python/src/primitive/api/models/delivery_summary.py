from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.delivery_summary_status import DeliverySummaryStatus
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.delivery_summary_email_type_0 import DeliverySummaryEmailType0





T = TypeVar("T", bound="DeliverySummary")



@_attrs_define
class DeliverySummary:
    """ 
        Attributes:
            id (str): Delivery ID (numeric string)
            email_id (None | UUID): The received email the delivery is about. Null for deliveries that are not about a
                received email, such as outbound sent_email.* events.
            org_id (UUID):
            endpoint_id (UUID):
            endpoint_url (str): Where it was sent: a webhook's scheme and host, followed by "/... (path and query hidden)"
                when its URL has more (GET /endpoints/{id} has the whole URL), function://<id> for a Function, or pull: for a
                pull subscription.
            status (DeliverySummaryStatus): Delivery status. skipped_by_rules: the endpoint's rules filtered the event out.
                held: kept back, unsent, until an owner or admin decides on the route that matched it. discarded: a held
                delivery that decision dropped.
            attempt_count (int):
            created_at (datetime.datetime):
            updated_at (datetime.datetime):
            event_type (None | str): The event type delivered, or null for a delivery recorded before event types existed.
            sent_email_id (None | UUID): The sent email an outbound sent_email.* delivery is about, otherwise null.
            last_error_code (None | str): Machine-readable code for the last failure, or null. A code the webhook chose in
                its answer is shown only to a caller who can read the webhook; anyone else gets handler_4xx or handler_5xx.
            response_status (int | None): The HTTP status the endpoint answered this attempt with: a webhook's own answer,
                or for a Function what its runtime answered, which is the platform's own error when the Function could not be
                run. Null when no answer came back (a network error, a timeout, an attempt refused or not sent) and on attempts
                recorded before this field.
            response_body (None | str): The first 2 KB of the body the endpoint answered this attempt with, so a handler
                that answers 200 and ignores a delivery can be seen doing so. It is whatever came back, which may echo what was
                sent. Null when no answer came back, and cleared when the message's content is discarded or the sent email is
                deleted. Withheld from a caller who cannot read message content, since an answer can echo what was sent. Null
                for a redirect (3xx), whose body repeats its Location; otherwise, in answers recorded since November 2026, the
                webhook URL's query string, its parameters, values long enough to be a credential and any userinfo are hidden
                wherever it repeats them, and the rest is as the endpoint wrote it. Null for a caller who cannot read the
                webhook (GET /endpoints/{id}; a deleted webhook only for a caller who reads every webhook), since a receiver's
                answer can restate its URL's credential.
            latest_attempt (bool): Whether this is the latest attempt of its delivery: the one recorded last, where a record
                of no attempt (a rule skip or a held send, attempt_count 0) is latest only when no attempt was made. A retry is
                recorded as a new attempt with its own id and attempt_count (not always higher than the one before), so an
                earlier attempt never changes: follow the latest one, or read attempts on any of them.
            retry_scheduled (bool | None): Whether an automatic retry will try this delivery again. A retry is a delivery
                pass for the email: it sends again to the endpoint the email's routing resolves then (its recorded route, or the
                current endpoint for its domain), unless the email already reached it, deciding it afresh (its rules, its
                owner's access, whether it is still on), so true promises a pass, not a delivery to this endpoint. A rule-
                granted delivery is retried on a schedule of its own, to the same endpoint, deciding it afresh: on its latest
                attempt true while another attempt is to come (the delivery's next_attempt_at says when); null while an attempt
                is under way (read it again shortly), while it waits on an owner who cannot receive mail or on a held endpoint
                (checked again hourly, and sent once that clears), when it is past its 7-day limit, or when that could not be
                read just now; and false otherwise, including once the endpoint is off or already has the email. Null on every
                attempt of a delivery retried or settled on a schedule of its own that this does not report: a held one (its
                release settles it, including the attempts it makes itself), a pull attempt, and a sent email's or other event's
                delivery. On the latest attempt that failed, is pending or was skipped in a way still owed, of an email that was
                not rejected and still has its content, to an endpoint that is still on, takes the event, has an owner the pass
                would deliver to (a revoked or suspended key, or an owner that may not receive the message, reads false) and has
                not received the email by another delivery: null while a delivery pass for the email is running (whether another
                follows is decided when it ends), true when the email has another automatic pass to come (a scheduled retry, the
                reclaim of a pass that stopped, or the recovery of a first pass that did not finish), and false otherwise. False
                on every other attempt, including every attempt a later one followed: no automatic retry of the email's delivery
                will try it again, which does not mean nothing else ever will.
            next_attempt_at (datetime.datetime | None): When the next automatic attempt of a rule-granted delivery is due:
                set on its latest attempt while retry_scheduled is true. The attempt runs at the first retry pass at or after
                this time (one runs every few minutes), so a time already past means it is due now. Null otherwise, and on every
                delivery that is not rule-granted, whose retries are passes for the email with no time reported (whether one is
                coming is retry_scheduled).
            duration_ms (int | None | Unset):
            last_error (None | str | Unset): Why the last attempt failed, or null. A webhook's answer follows its status
                (HTTP 404: ...) as plain text, at most 300 characters (response_body has more); older attempts can quote more.
                It is quoted only for a caller who can read the webhook (GET /endpoints/{id}; a deleted webhook only for a
                caller who reads every webhook); anyone else gets the status and a note. Text the platform writes (a redirect
                not followed, a network error) is shown to everyone.
            email (DeliverySummaryEmailType0 | None | Unset):
     """

    id: str
    email_id: None | UUID
    org_id: UUID
    endpoint_id: UUID
    endpoint_url: str
    status: DeliverySummaryStatus
    attempt_count: int
    created_at: datetime.datetime
    updated_at: datetime.datetime
    event_type: None | str
    sent_email_id: None | UUID
    last_error_code: None | str
    response_status: int | None
    response_body: None | str
    latest_attempt: bool
    retry_scheduled: bool | None
    next_attempt_at: datetime.datetime | None
    duration_ms: int | None | Unset = UNSET
    last_error: None | str | Unset = UNSET
    email: DeliverySummaryEmailType0 | None | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.delivery_summary_email_type_0 import DeliverySummaryEmailType0 # noqa: PLC0415
        id = self.id

        email_id: None | str
        if isinstance(self.email_id, UUID):
            email_id = str(self.email_id)
        else:
            email_id = self.email_id

        org_id = str(self.org_id)

        endpoint_id = str(self.endpoint_id)

        endpoint_url = self.endpoint_url

        status = self.status.value

        attempt_count = self.attempt_count

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()

        event_type: None | str
        event_type = self.event_type

        sent_email_id: None | str
        if isinstance(self.sent_email_id, UUID):
            sent_email_id = str(self.sent_email_id)
        else:
            sent_email_id = self.sent_email_id

        last_error_code: None | str
        last_error_code = self.last_error_code

        response_status: int | None
        response_status = self.response_status

        response_body: None | str
        response_body = self.response_body

        latest_attempt = self.latest_attempt

        retry_scheduled: bool | None
        retry_scheduled = self.retry_scheduled

        next_attempt_at: None | str
        if isinstance(self.next_attempt_at, datetime.datetime):
            next_attempt_at = self.next_attempt_at.isoformat()
        else:
            next_attempt_at = self.next_attempt_at

        duration_ms: int | None | Unset
        if isinstance(self.duration_ms, Unset):
            duration_ms = UNSET
        else:
            duration_ms = self.duration_ms

        last_error: None | str | Unset
        if isinstance(self.last_error, Unset):
            last_error = UNSET
        else:
            last_error = self.last_error

        email: dict[str, Any] | None | Unset
        if isinstance(self.email, Unset):
            email = UNSET
        elif isinstance(self.email, DeliverySummaryEmailType0):
            email = self.email.to_dict()
        else:
            email = self.email


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "email_id": email_id,
            "org_id": org_id,
            "endpoint_id": endpoint_id,
            "endpoint_url": endpoint_url,
            "status": status,
            "attempt_count": attempt_count,
            "created_at": created_at,
            "updated_at": updated_at,
            "event_type": event_type,
            "sent_email_id": sent_email_id,
            "last_error_code": last_error_code,
            "response_status": response_status,
            "response_body": response_body,
            "latest_attempt": latest_attempt,
            "retry_scheduled": retry_scheduled,
            "next_attempt_at": next_attempt_at,
        })
        if duration_ms is not UNSET:
            field_dict["duration_ms"] = duration_ms
        if last_error is not UNSET:
            field_dict["last_error"] = last_error
        if email is not UNSET:
            field_dict["email"] = email

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.delivery_summary_email_type_0 import DeliverySummaryEmailType0 # noqa: PLC0415
        d = dict(src_dict)
        id = d.pop("id")

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


        org_id = UUID(d.pop("org_id"))




        endpoint_id = UUID(d.pop("endpoint_id"))




        endpoint_url = d.pop("endpoint_url")

        status = DeliverySummaryStatus(d.pop("status"))




        attempt_count = d.pop("attempt_count")

        created_at = datetime.datetime.fromisoformat(d.pop("created_at"))




        updated_at = datetime.datetime.fromisoformat(d.pop("updated_at"))




        def _parse_event_type(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        event_type = _parse_event_type(d.pop("event_type"))


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


        def _parse_last_error_code(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        last_error_code = _parse_last_error_code(d.pop("last_error_code"))


        def _parse_response_status(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        response_status = _parse_response_status(d.pop("response_status"))


        def _parse_response_body(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        response_body = _parse_response_body(d.pop("response_body"))


        latest_attempt = d.pop("latest_attempt")

        def _parse_retry_scheduled(data: object) -> bool | None:
            if data is None:
                return data
            return cast(bool | None, data)

        retry_scheduled = _parse_retry_scheduled(d.pop("retry_scheduled"))


        def _parse_next_attempt_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                next_attempt_at_type_0 = datetime.datetime.fromisoformat(data)



                return next_attempt_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        next_attempt_at = _parse_next_attempt_at(d.pop("next_attempt_at"))


        def _parse_duration_ms(data: object) -> int | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(int | None | Unset, data)

        duration_ms = _parse_duration_ms(d.pop("duration_ms", UNSET))


        def _parse_last_error(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        last_error = _parse_last_error(d.pop("last_error", UNSET))


        def _parse_email(data: object) -> DeliverySummaryEmailType0 | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                email_type_0 = DeliverySummaryEmailType0.from_dict(data)



                return email_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(DeliverySummaryEmailType0 | None | Unset, data)

        email = _parse_email(d.pop("email", UNSET))


        delivery_summary = cls(
            id=id,
            email_id=email_id,
            org_id=org_id,
            endpoint_id=endpoint_id,
            endpoint_url=endpoint_url,
            status=status,
            attempt_count=attempt_count,
            created_at=created_at,
            updated_at=updated_at,
            event_type=event_type,
            sent_email_id=sent_email_id,
            last_error_code=last_error_code,
            response_status=response_status,
            response_body=response_body,
            latest_attempt=latest_attempt,
            retry_scheduled=retry_scheduled,
            next_attempt_at=next_attempt_at,
            duration_ms=duration_ms,
            last_error=last_error,
            email=email,
        )


        delivery_summary.additional_properties = d
        return delivery_summary

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
