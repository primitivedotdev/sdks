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
            email_id (None | UUID): The inbound email this delivery is about. Null for deliveries that are not about a
                received email, such as `sent_email.*` events.
            org_id (UUID):
            endpoint_id (UUID):
            endpoint_url (None | str): The endpoint's URL. For a function-backed endpoint, an opaque `function://<id>`
                identifier rather than a callable URL.
            status (DeliverySummaryStatus):
            attempt_count (int):
            created_at (datetime.datetime):
            updated_at (datetime.datetime):
            event_type (None | str | Unset): The delivered event type, for example `email.received` or
                `sent_email.delivered`. Null for deliveries recorded before event types existed.
            sent_email_id (None | Unset | UUID): The sent email a `sent_email.*` delivery is about. Null for every other
                delivery.
            duration_ms (int | None | Unset):
            last_error (None | str | Unset):
            last_error_code (None | str | Unset): A stable code for the last failure, for example `http_500`.
            email (DeliverySummaryEmailType0 | None | Unset): Null for deliveries that are not about a received email.
     """

    id: str
    email_id: None | UUID
    org_id: UUID
    endpoint_id: UUID
    endpoint_url: None | str
    status: DeliverySummaryStatus
    attempt_count: int
    created_at: datetime.datetime
    updated_at: datetime.datetime
    event_type: None | str | Unset = UNSET
    sent_email_id: None | Unset | UUID = UNSET
    duration_ms: int | None | Unset = UNSET
    last_error: None | str | Unset = UNSET
    last_error_code: None | str | Unset = UNSET
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

        endpoint_url: None | str
        endpoint_url = self.endpoint_url

        status = self.status.value

        attempt_count = self.attempt_count

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()

        event_type: None | str | Unset
        if isinstance(self.event_type, Unset):
            event_type = UNSET
        else:
            event_type = self.event_type

        sent_email_id: None | str | Unset
        if isinstance(self.sent_email_id, Unset):
            sent_email_id = UNSET
        elif isinstance(self.sent_email_id, UUID):
            sent_email_id = str(self.sent_email_id)
        else:
            sent_email_id = self.sent_email_id

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

        last_error_code: None | str | Unset
        if isinstance(self.last_error_code, Unset):
            last_error_code = UNSET
        else:
            last_error_code = self.last_error_code

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
        })
        if event_type is not UNSET:
            field_dict["event_type"] = event_type
        if sent_email_id is not UNSET:
            field_dict["sent_email_id"] = sent_email_id
        if duration_ms is not UNSET:
            field_dict["duration_ms"] = duration_ms
        if last_error is not UNSET:
            field_dict["last_error"] = last_error
        if last_error_code is not UNSET:
            field_dict["last_error_code"] = last_error_code
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




        def _parse_endpoint_url(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        endpoint_url = _parse_endpoint_url(d.pop("endpoint_url"))


        status = DeliverySummaryStatus(d.pop("status"))




        attempt_count = d.pop("attempt_count")

        created_at = datetime.datetime.fromisoformat(d.pop("created_at"))




        updated_at = datetime.datetime.fromisoformat(d.pop("updated_at"))




        def _parse_event_type(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        event_type = _parse_event_type(d.pop("event_type", UNSET))


        def _parse_sent_email_id(data: object) -> None | Unset | UUID:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                sent_email_id_type_0 = UUID(data)



                return sent_email_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | Unset | UUID, data)

        sent_email_id = _parse_sent_email_id(d.pop("sent_email_id", UNSET))


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


        def _parse_last_error_code(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        last_error_code = _parse_last_error_code(d.pop("last_error_code", UNSET))


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
            duration_ms=duration_ms,
            last_error=last_error,
            last_error_code=last_error_code,
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
