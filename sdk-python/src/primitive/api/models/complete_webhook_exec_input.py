from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.complete_webhook_exec_input_mode import CompleteWebhookExecInputMode
from ..models.complete_webhook_exec_input_transport_error import CompleteWebhookExecInputTransportError
from typing import cast
from uuid import UUID






T = TypeVar("T", bound="CompleteWebhookExecInput")



@_attrs_define
class CompleteWebhookExecInput:
    """ 
        Attributes:
            queue_id (UUID):
            delivery_id (UUID):
            lease_token (UUID):
            duration_ms (int):
            mode (CompleteWebhookExecInputMode):
            exit_code (int | None):
            transport_error (CompleteWebhookExecInputTransportError | Unset):
     """

    queue_id: UUID
    delivery_id: UUID
    lease_token: UUID
    duration_ms: int
    mode: CompleteWebhookExecInputMode
    exit_code: int | None
    transport_error: CompleteWebhookExecInputTransportError | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        queue_id = str(self.queue_id)

        delivery_id = str(self.delivery_id)

        lease_token = str(self.lease_token)

        duration_ms = self.duration_ms

        mode = self.mode.value

        exit_code: int | None
        exit_code = self.exit_code

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
            "exit_code": exit_code,
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

        mode = CompleteWebhookExecInputMode(d.pop("mode"))




        def _parse_exit_code(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        exit_code = _parse_exit_code(d.pop("exit_code"))


        _transport_error = d.pop("transport_error", UNSET)
        transport_error: CompleteWebhookExecInputTransportError | Unset
        if isinstance(_transport_error,  Unset):
            transport_error = UNSET
        else:
            transport_error = CompleteWebhookExecInputTransportError(_transport_error)




        complete_webhook_exec_input = cls(
            queue_id=queue_id,
            delivery_id=delivery_id,
            lease_token=lease_token,
            duration_ms=duration_ms,
            mode=mode,
            exit_code=exit_code,
            transport_error=transport_error,
        )

        return complete_webhook_exec_input

