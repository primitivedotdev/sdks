from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="GetDeliveryResultAttemptsItem")



@_attrs_define
class GetDeliveryResultAttemptsItem:
    """ 
        Attributes:
            id (str):
            attempt_count (int):
            status (str):
            last_error_code (None | str):
            duration_ms (int | None):
            created_at (str):
            response_status (int | None): The HTTP status the endpoint answered this attempt with: a webhook's own answer,
                or for a Function what its runtime answered, which is the platform's own error when the Function could not be
                run. Null when no answer came back (a network error, a timeout, an attempt refused or not sent) and on attempts
                recorded before this field.
            response_body (None | str): The first 2 KB of the body the endpoint answered this attempt with, so a handler
                that answers 200 and ignores a delivery can be seen doing so. It is whatever came back, which may echo what was
                sent. Null when no answer came back, and cleared when the message's content is discarded or the sent email is
                deleted. Withheld from a caller who cannot read message content, since an answer can echo what was sent.
            retry_scheduled (bool | None): Whether an automatic retry will try this delivery again. A retry is a delivery
                pass for the email: it sends again to the endpoint the email's routing resolves then (its recorded route, or the
                current endpoint for its domain), unless the email already reached it, deciding it afresh (its rules, its
                owner's access, whether it is still on), so true promises a pass, not a delivery to this endpoint. Null on every
                attempt of a delivery retried or settled on a schedule of its own, which this does not report: a held one (its
                release settles it, including the attempts it makes itself), a pull attempt, a rule-granted one, and a sent
                email's or other event's delivery. On the latest attempt that failed, is pending or was skipped in a way still
                owed, of an email that was not rejected and still has its content, to an endpoint that is still on, takes the
                event, has an owner the pass would deliver to (a revoked or suspended key, or an owner that may not receive the
                message, reads false) and has not received the email by another delivery: null while a delivery pass for the
                email is running (whether another follows is decided when it ends), true when the email has another automatic
                pass to come (a scheduled retry, the reclaim of a pass that stopped, or the recovery of a first pass that did
                not finish), and false otherwise. False on every other attempt, including every attempt a later one followed: no
                automatic retry of the email's delivery will try it again, which does not mean nothing else ever will.
     """

    id: str
    attempt_count: int
    status: str
    last_error_code: None | str
    duration_ms: int | None
    created_at: str
    response_status: int | None
    response_body: None | str
    retry_scheduled: bool | None
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = self.id

        attempt_count = self.attempt_count

        status = self.status

        last_error_code: None | str
        last_error_code = self.last_error_code

        duration_ms: int | None
        duration_ms = self.duration_ms

        created_at = self.created_at

        response_status: int | None
        response_status = self.response_status

        response_body: None | str
        response_body = self.response_body

        retry_scheduled: bool | None
        retry_scheduled = self.retry_scheduled


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "attempt_count": attempt_count,
            "status": status,
            "last_error_code": last_error_code,
            "duration_ms": duration_ms,
            "created_at": created_at,
            "response_status": response_status,
            "response_body": response_body,
            "retry_scheduled": retry_scheduled,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = d.pop("id")

        attempt_count = d.pop("attempt_count")

        status = d.pop("status")

        def _parse_last_error_code(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        last_error_code = _parse_last_error_code(d.pop("last_error_code"))


        def _parse_duration_ms(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        duration_ms = _parse_duration_ms(d.pop("duration_ms"))


        created_at = d.pop("created_at")

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


        def _parse_retry_scheduled(data: object) -> bool | None:
            if data is None:
                return data
            return cast(bool | None, data)

        retry_scheduled = _parse_retry_scheduled(d.pop("retry_scheduled"))


        get_delivery_result_attempts_item = cls(
            id=id,
            attempt_count=attempt_count,
            status=status,
            last_error_code=last_error_code,
            duration_ms=duration_ms,
            created_at=created_at,
            response_status=response_status,
            response_body=response_body,
            retry_scheduled=retry_scheduled,
        )


        get_delivery_result_attempts_item.additional_properties = d
        return get_delivery_result_attempts_item

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
