from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.get_delivery_result_attempts_item import GetDeliveryResultAttemptsItem
  from ..models.get_delivery_result_email_type_0 import GetDeliveryResultEmailType0





T = TypeVar("T", bound="GetDeliveryResult")



@_attrs_define
class GetDeliveryResult:
    """ 
        Attributes:
            id (str):
            email_id (None | UUID):
            event_type (None | str):
            sent_email_id (None | UUID):
            org_id (str):
            endpoint_id (UUID):
            endpoint_url (str):
            status (str):
            attempt_count (int):
            duration_ms (int | None):
            last_error (None | str):
            last_error_code (None | str):
            response_status (int | None): The HTTP status the endpoint answered this attempt with: a webhook's own answer,
                or for a Function what its runtime answered, which is the platform's own error when the Function could not be
                run. Null when no answer came back (a network error, a timeout, an attempt refused or not sent) and on attempts
                recorded before this field.
            response_body (None | str): The first 2 KB of the body the endpoint answered this attempt with, so a handler
                that answers 200 and ignores a delivery can be seen doing so. It is whatever came back, which may echo what was
                sent. Null when no answer came back, and cleared when the message's content is discarded or the sent email is
                deleted. Withheld from a caller who cannot read message content, since an answer can echo what was sent.
            created_at (str):
            updated_at (str):
            email (GetDeliveryResultEmailType0 | None):
            latest_attempt (bool): Whether this is the latest attempt of its delivery: the one recorded last, where a record
                of no attempt (a rule skip or a held send, attempt_count 0) is latest only when no attempt was made. A retry is
                recorded as a new attempt with its own id and attempt_count (not always higher than the one before), so an
                earlier attempt never changes: follow the latest one, or read attempts on any of them.
            next_attempt_at (None | str): When the next automatic retry of this delivery is due. Not reported yet: always
                null.
            attempts (list[GetDeliveryResultAttemptsItem]): Every attempt of this delivery in the order recorded, oldest
                first, this one included: the same endpoint, and the same event (or, for an attempt recorded without one, the
                same email). Records of no attempt (attempt_count 0) are listed where they were recorded, so the last entry is
                not always the latest attempt (latest_attempt says which is). The newest 100 when there are more.
     """

    id: str
    email_id: None | UUID
    event_type: None | str
    sent_email_id: None | UUID
    org_id: str
    endpoint_id: UUID
    endpoint_url: str
    status: str
    attempt_count: int
    duration_ms: int | None
    last_error: None | str
    last_error_code: None | str
    response_status: int | None
    response_body: None | str
    created_at: str
    updated_at: str
    email: GetDeliveryResultEmailType0 | None
    latest_attempt: bool
    next_attempt_at: None | str
    attempts: list[GetDeliveryResultAttemptsItem]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.get_delivery_result_attempts_item import GetDeliveryResultAttemptsItem # noqa: PLC0415
        from ..models.get_delivery_result_email_type_0 import GetDeliveryResultEmailType0 # noqa: PLC0415
        id = self.id

        email_id: None | str
        if isinstance(self.email_id, UUID):
            email_id = str(self.email_id)
        else:
            email_id = self.email_id

        event_type: None | str
        event_type = self.event_type

        sent_email_id: None | str
        if isinstance(self.sent_email_id, UUID):
            sent_email_id = str(self.sent_email_id)
        else:
            sent_email_id = self.sent_email_id

        org_id = self.org_id

        endpoint_id = str(self.endpoint_id)

        endpoint_url = self.endpoint_url

        status = self.status

        attempt_count = self.attempt_count

        duration_ms: int | None
        duration_ms = self.duration_ms

        last_error: None | str
        last_error = self.last_error

        last_error_code: None | str
        last_error_code = self.last_error_code

        response_status: int | None
        response_status = self.response_status

        response_body: None | str
        response_body = self.response_body

        created_at = self.created_at

        updated_at = self.updated_at

        email: dict[str, Any] | None
        if isinstance(self.email, GetDeliveryResultEmailType0):
            email = self.email.to_dict()
        else:
            email = self.email

        latest_attempt = self.latest_attempt

        next_attempt_at: None | str
        next_attempt_at = self.next_attempt_at

        attempts = []
        for attempts_item_data in self.attempts:
            attempts_item = attempts_item_data.to_dict()
            attempts.append(attempts_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "email_id": email_id,
            "event_type": event_type,
            "sent_email_id": sent_email_id,
            "org_id": org_id,
            "endpoint_id": endpoint_id,
            "endpoint_url": endpoint_url,
            "status": status,
            "attempt_count": attempt_count,
            "duration_ms": duration_ms,
            "last_error": last_error,
            "last_error_code": last_error_code,
            "response_status": response_status,
            "response_body": response_body,
            "created_at": created_at,
            "updated_at": updated_at,
            "email": email,
            "latest_attempt": latest_attempt,
            "next_attempt_at": next_attempt_at,
            "attempts": attempts,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.get_delivery_result_attempts_item import GetDeliveryResultAttemptsItem # noqa: PLC0415
        from ..models.get_delivery_result_email_type_0 import GetDeliveryResultEmailType0 # noqa: PLC0415
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


        org_id = d.pop("org_id")

        endpoint_id = UUID(d.pop("endpoint_id"))




        endpoint_url = d.pop("endpoint_url")

        status = d.pop("status")

        attempt_count = d.pop("attempt_count")

        def _parse_duration_ms(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        duration_ms = _parse_duration_ms(d.pop("duration_ms"))


        def _parse_last_error(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        last_error = _parse_last_error(d.pop("last_error"))


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


        created_at = d.pop("created_at")

        updated_at = d.pop("updated_at")

        def _parse_email(data: object) -> GetDeliveryResultEmailType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                email_type_0 = GetDeliveryResultEmailType0.from_dict(data)



                return email_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(GetDeliveryResultEmailType0 | None, data)

        email = _parse_email(d.pop("email"))


        latest_attempt = d.pop("latest_attempt")

        def _parse_next_attempt_at(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        next_attempt_at = _parse_next_attempt_at(d.pop("next_attempt_at"))


        attempts = []
        _attempts = d.pop("attempts")
        for attempts_item_data in (_attempts):
            attempts_item = GetDeliveryResultAttemptsItem.from_dict(attempts_item_data)



            attempts.append(attempts_item)


        get_delivery_result = cls(
            id=id,
            email_id=email_id,
            event_type=event_type,
            sent_email_id=sent_email_id,
            org_id=org_id,
            endpoint_id=endpoint_id,
            endpoint_url=endpoint_url,
            status=status,
            attempt_count=attempt_count,
            duration_ms=duration_ms,
            last_error=last_error,
            last_error_code=last_error_code,
            response_status=response_status,
            response_body=response_body,
            created_at=created_at,
            updated_at=updated_at,
            email=email,
            latest_attempt=latest_attempt,
            next_attempt_at=next_attempt_at,
            attempts=attempts,
        )


        get_delivery_result.additional_properties = d
        return get_delivery_result

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
