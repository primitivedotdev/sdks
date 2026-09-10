from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.complete_webhook_http_input_mode import CompleteWebhookHttpInputMode
from ..models.complete_webhook_http_input_transport_error import CompleteWebhookHttpInputTransportError
from typing import cast
from uuid import UUID






T = TypeVar("T", bound="CompleteWebhookHttpInput")



@_attrs_define
class CompleteWebhookHttpInput:
    """ 
        Attributes:
            queue_id (UUID):
            delivery_id (UUID):
            lease_token (UUID):
            duration_ms (int):
            mode (CompleteWebhookHttpInputMode):
            status_code (int | None):
            transport_error (CompleteWebhookHttpInputTransportError | Unset):
            error_code (str | Unset):
            confirmed (bool | Unset):  Default: False.
     """

    queue_id: UUID
    delivery_id: UUID
    lease_token: UUID
    duration_ms: int
    mode: CompleteWebhookHttpInputMode
    status_code: int | None
    transport_error: CompleteWebhookHttpInputTransportError | Unset = UNSET
    error_code: str | Unset = UNSET
    confirmed: bool | Unset = False





    def to_dict(self) -> dict[str, Any]:
        queue_id = str(self.queue_id)

        delivery_id = str(self.delivery_id)

        lease_token = str(self.lease_token)

        duration_ms = self.duration_ms

        mode = self.mode.value

        status_code: int | None
        status_code = self.status_code

        transport_error: str | Unset = UNSET
        if not isinstance(self.transport_error, Unset):
            transport_error = self.transport_error.value


        error_code = self.error_code

        confirmed = self.confirmed


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "queue_id": queue_id,
            "delivery_id": delivery_id,
            "lease_token": lease_token,
            "duration_ms": duration_ms,
            "mode": mode,
            "status_code": status_code,
        })
        if transport_error is not UNSET:
            field_dict["transport_error"] = transport_error
        if error_code is not UNSET:
            field_dict["error_code"] = error_code
        if confirmed is not UNSET:
            field_dict["confirmed"] = confirmed

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        queue_id = UUID(d.pop("queue_id"))




        delivery_id = UUID(d.pop("delivery_id"))




        lease_token = UUID(d.pop("lease_token"))




        duration_ms = d.pop("duration_ms")

        mode = CompleteWebhookHttpInputMode(d.pop("mode"))




        def _parse_status_code(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        status_code = _parse_status_code(d.pop("status_code"))


        _transport_error = d.pop("transport_error", UNSET)
        transport_error: CompleteWebhookHttpInputTransportError | Unset
        if isinstance(_transport_error,  Unset):
            transport_error = UNSET
        else:
            transport_error = CompleteWebhookHttpInputTransportError(_transport_error)




        error_code = d.pop("error_code", UNSET)

        confirmed = d.pop("confirmed", UNSET)

        complete_webhook_http_input = cls(
            queue_id=queue_id,
            delivery_id=delivery_id,
            lease_token=lease_token,
            duration_ms=duration_ms,
            mode=mode,
            status_code=status_code,
            transport_error=transport_error,
            error_code=error_code,
            confirmed=confirmed,
        )

        return complete_webhook_http_input

