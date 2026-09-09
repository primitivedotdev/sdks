from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.complete_webhook_stdout_input_mode import CompleteWebhookStdoutInputMode
from ..models.complete_webhook_stdout_input_transport_error import CompleteWebhookStdoutInputTransportError
from uuid import UUID






T = TypeVar("T", bound="CompleteWebhookStdoutInput")



@_attrs_define
class CompleteWebhookStdoutInput:
    """ 
        Attributes:
            queue_id (UUID):
            delivery_id (UUID):
            lease_token (UUID):
            duration_ms (int):
            mode (CompleteWebhookStdoutInputMode):
            write_succeeded (bool):
            transport_error (CompleteWebhookStdoutInputTransportError | Unset):
     """

    queue_id: UUID
    delivery_id: UUID
    lease_token: UUID
    duration_ms: int
    mode: CompleteWebhookStdoutInputMode
    write_succeeded: bool
    transport_error: CompleteWebhookStdoutInputTransportError | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        queue_id = str(self.queue_id)

        delivery_id = str(self.delivery_id)

        lease_token = str(self.lease_token)

        duration_ms = self.duration_ms

        mode = self.mode.value

        write_succeeded = self.write_succeeded

        transport_error: str | Unset = UNSET
        if not isinstance(self.transport_error, Unset):
            transport_error = self.transport_error.value



        field_dict: dict[str, Any] = {}

        field_dict.update({
            "queue_id": queue_id,
            "delivery_id": delivery_id,
            "lease_token": lease_token,
            "duration_ms": duration_ms,
            "mode": mode,
            "write_succeeded": write_succeeded,
        })
        if transport_error is not UNSET:
            field_dict["transport_error"] = transport_error

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        queue_id = UUID(d.pop("queue_id"))




        delivery_id = UUID(d.pop("delivery_id"))




        lease_token = UUID(d.pop("lease_token"))




        duration_ms = d.pop("duration_ms")

        mode = CompleteWebhookStdoutInputMode(d.pop("mode"))




        write_succeeded = d.pop("write_succeeded")

        _transport_error = d.pop("transport_error", UNSET)
        transport_error: CompleteWebhookStdoutInputTransportError | Unset
        if isinstance(_transport_error,  Unset):
            transport_error = UNSET
        else:
            transport_error = CompleteWebhookStdoutInputTransportError(_transport_error)




        complete_webhook_stdout_input = cls(
            queue_id=queue_id,
            delivery_id=delivery_id,
            lease_token=lease_token,
            duration_ms=duration_ms,
            mode=mode,
            write_succeeded=write_succeeded,
            transport_error=transport_error,
        )

        return complete_webhook_stdout_input

