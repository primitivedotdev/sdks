from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="FunctionTestRunOutboundRequest")



@_attrs_define
class FunctionTestRunOutboundRequest:
    """ 
        Attributes:
            id (UUID):
            function_id (UUID):
            webhook_delivery_id (None | str):
            email_id (None | UUID):
            endpoint_id (None | UUID):
            method (str):
            url (str):
            host (str):
            path (str):
            status_code (int | None):
            ok (bool | None):
            duration_ms (int):
            error (None | str):
            ts (datetime.datetime):
     """

    id: UUID
    function_id: UUID
    webhook_delivery_id: None | str
    email_id: None | UUID
    endpoint_id: None | UUID
    method: str
    url: str
    host: str
    path: str
    status_code: int | None
    ok: bool | None
    duration_ms: int
    error: None | str
    ts: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        function_id = str(self.function_id)

        webhook_delivery_id: None | str
        webhook_delivery_id = self.webhook_delivery_id

        email_id: None | str
        if isinstance(self.email_id, UUID):
            email_id = str(self.email_id)
        else:
            email_id = self.email_id

        endpoint_id: None | str
        if isinstance(self.endpoint_id, UUID):
            endpoint_id = str(self.endpoint_id)
        else:
            endpoint_id = self.endpoint_id

        method = self.method

        url = self.url

        host = self.host

        path = self.path

        status_code: int | None
        status_code = self.status_code

        ok: bool | None
        ok = self.ok

        duration_ms = self.duration_ms

        error: None | str
        error = self.error

        ts = self.ts.isoformat()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "function_id": function_id,
            "webhook_delivery_id": webhook_delivery_id,
            "email_id": email_id,
            "endpoint_id": endpoint_id,
            "method": method,
            "url": url,
            "host": host,
            "path": path,
            "status_code": status_code,
            "ok": ok,
            "duration_ms": duration_ms,
            "error": error,
            "ts": ts,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        function_id = UUID(d.pop("function_id"))




        def _parse_webhook_delivery_id(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        webhook_delivery_id = _parse_webhook_delivery_id(d.pop("webhook_delivery_id"))


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


        def _parse_endpoint_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                endpoint_id_type_0 = UUID(data)



                return endpoint_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        endpoint_id = _parse_endpoint_id(d.pop("endpoint_id"))


        method = d.pop("method")

        url = d.pop("url")

        host = d.pop("host")

        path = d.pop("path")

        def _parse_status_code(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        status_code = _parse_status_code(d.pop("status_code"))


        def _parse_ok(data: object) -> bool | None:
            if data is None:
                return data
            return cast(bool | None, data)

        ok = _parse_ok(d.pop("ok"))


        duration_ms = d.pop("duration_ms")

        def _parse_error(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        error = _parse_error(d.pop("error"))


        ts = isoparse(d.pop("ts"))




        function_test_run_outbound_request = cls(
            id=id,
            function_id=function_id,
            webhook_delivery_id=webhook_delivery_id,
            email_id=email_id,
            endpoint_id=endpoint_id,
            method=method,
            url=url,
            host=host,
            path=path,
            status_code=status_code,
            ok=ok,
            duration_ms=duration_ms,
            error=error,
            ts=ts,
        )


        function_test_run_outbound_request.additional_properties = d
        return function_test_run_outbound_request

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
