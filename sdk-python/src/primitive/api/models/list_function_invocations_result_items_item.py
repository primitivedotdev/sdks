from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="ListFunctionInvocationsResultItemsItem")



@_attrs_define
class ListFunctionInvocationsResultItemsItem:
    """ 
        Attributes:
            id (UUID):
            function_id (UUID):
            outcome (None | str):
            cf_truncated (bool):
            trigger_kind (None | str):
            cpu_time_ms (float | None):
            wall_time_ms (float | None):
            started_at (datetime.datetime):
            request_url (None | str):
            request_method (None | str):
            response_status (int | None):
            exception_name (None | str):
            exception_message (None | str):
            exception_fingerprint (None | str):
            cf_script_version_id (None | str):
            dispatch_namespace (None | str):
            webhook_delivery_id (None | str):
            log_line_count (int | None):
            log_bytes (int | None):
            created_at (datetime.datetime):
            exception_stack (None | str | Unset):
     """

    id: UUID
    function_id: UUID
    outcome: None | str
    cf_truncated: bool
    trigger_kind: None | str
    cpu_time_ms: float | None
    wall_time_ms: float | None
    started_at: datetime.datetime
    request_url: None | str
    request_method: None | str
    response_status: int | None
    exception_name: None | str
    exception_message: None | str
    exception_fingerprint: None | str
    cf_script_version_id: None | str
    dispatch_namespace: None | str
    webhook_delivery_id: None | str
    log_line_count: int | None
    log_bytes: int | None
    created_at: datetime.datetime
    exception_stack: None | str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        function_id = str(self.function_id)

        outcome: None | str
        outcome = self.outcome

        cf_truncated = self.cf_truncated

        trigger_kind: None | str
        trigger_kind = self.trigger_kind

        cpu_time_ms: float | None
        cpu_time_ms = self.cpu_time_ms

        wall_time_ms: float | None
        wall_time_ms = self.wall_time_ms

        started_at = self.started_at.isoformat()

        request_url: None | str
        request_url = self.request_url

        request_method: None | str
        request_method = self.request_method

        response_status: int | None
        response_status = self.response_status

        exception_name: None | str
        exception_name = self.exception_name

        exception_message: None | str
        exception_message = self.exception_message

        exception_fingerprint: None | str
        exception_fingerprint = self.exception_fingerprint

        cf_script_version_id: None | str
        cf_script_version_id = self.cf_script_version_id

        dispatch_namespace: None | str
        dispatch_namespace = self.dispatch_namespace

        webhook_delivery_id: None | str
        webhook_delivery_id = self.webhook_delivery_id

        log_line_count: int | None
        log_line_count = self.log_line_count

        log_bytes: int | None
        log_bytes = self.log_bytes

        created_at = self.created_at.isoformat()

        exception_stack: None | str | Unset
        if isinstance(self.exception_stack, Unset):
            exception_stack = UNSET
        else:
            exception_stack = self.exception_stack


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "function_id": function_id,
            "outcome": outcome,
            "cf_truncated": cf_truncated,
            "trigger_kind": trigger_kind,
            "cpu_time_ms": cpu_time_ms,
            "wall_time_ms": wall_time_ms,
            "started_at": started_at,
            "request_url": request_url,
            "request_method": request_method,
            "response_status": response_status,
            "exception_name": exception_name,
            "exception_message": exception_message,
            "exception_fingerprint": exception_fingerprint,
            "cf_script_version_id": cf_script_version_id,
            "dispatch_namespace": dispatch_namespace,
            "webhook_delivery_id": webhook_delivery_id,
            "log_line_count": log_line_count,
            "log_bytes": log_bytes,
            "created_at": created_at,
        })
        if exception_stack is not UNSET:
            field_dict["exception_stack"] = exception_stack

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        function_id = UUID(d.pop("function_id"))




        def _parse_outcome(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        outcome = _parse_outcome(d.pop("outcome"))


        cf_truncated = d.pop("cf_truncated")

        def _parse_trigger_kind(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        trigger_kind = _parse_trigger_kind(d.pop("trigger_kind"))


        def _parse_cpu_time_ms(data: object) -> float | None:
            if data is None:
                return data
            return cast(float | None, data)

        cpu_time_ms = _parse_cpu_time_ms(d.pop("cpu_time_ms"))


        def _parse_wall_time_ms(data: object) -> float | None:
            if data is None:
                return data
            return cast(float | None, data)

        wall_time_ms = _parse_wall_time_ms(d.pop("wall_time_ms"))


        started_at = datetime.datetime.fromisoformat(d.pop("started_at"))




        def _parse_request_url(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        request_url = _parse_request_url(d.pop("request_url"))


        def _parse_request_method(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        request_method = _parse_request_method(d.pop("request_method"))


        def _parse_response_status(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        response_status = _parse_response_status(d.pop("response_status"))


        def _parse_exception_name(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        exception_name = _parse_exception_name(d.pop("exception_name"))


        def _parse_exception_message(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        exception_message = _parse_exception_message(d.pop("exception_message"))


        def _parse_exception_fingerprint(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        exception_fingerprint = _parse_exception_fingerprint(d.pop("exception_fingerprint"))


        def _parse_cf_script_version_id(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        cf_script_version_id = _parse_cf_script_version_id(d.pop("cf_script_version_id"))


        def _parse_dispatch_namespace(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        dispatch_namespace = _parse_dispatch_namespace(d.pop("dispatch_namespace"))


        def _parse_webhook_delivery_id(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        webhook_delivery_id = _parse_webhook_delivery_id(d.pop("webhook_delivery_id"))


        def _parse_log_line_count(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        log_line_count = _parse_log_line_count(d.pop("log_line_count"))


        def _parse_log_bytes(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        log_bytes = _parse_log_bytes(d.pop("log_bytes"))


        created_at = datetime.datetime.fromisoformat(d.pop("created_at"))




        def _parse_exception_stack(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        exception_stack = _parse_exception_stack(d.pop("exception_stack", UNSET))


        list_function_invocations_result_items_item = cls(
            id=id,
            function_id=function_id,
            outcome=outcome,
            cf_truncated=cf_truncated,
            trigger_kind=trigger_kind,
            cpu_time_ms=cpu_time_ms,
            wall_time_ms=wall_time_ms,
            started_at=started_at,
            request_url=request_url,
            request_method=request_method,
            response_status=response_status,
            exception_name=exception_name,
            exception_message=exception_message,
            exception_fingerprint=exception_fingerprint,
            cf_script_version_id=cf_script_version_id,
            dispatch_namespace=dispatch_namespace,
            webhook_delivery_id=webhook_delivery_id,
            log_line_count=log_line_count,
            log_bytes=log_bytes,
            created_at=created_at,
            exception_stack=exception_stack,
        )


        list_function_invocations_result_items_item.additional_properties = d
        return list_function_invocations_result_items_item

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
