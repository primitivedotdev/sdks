from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.function_test_run_delivery_status import FunctionTestRunDeliveryStatus
from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.function_test_run_delivery_endpoint_type_0 import FunctionTestRunDeliveryEndpointType0





T = TypeVar("T", bound="FunctionTestRunDelivery")



@_attrs_define
class FunctionTestRunDelivery:
    """ 
        Attributes:
            id (str): Webhook delivery id.
            endpoint_id (UUID):
            endpoint_url (str):
            status (FunctionTestRunDeliveryStatus):
            attempt_count (int):
            duration_ms (int | None):
            last_error (None | str):
            last_error_code (None | str):
            created_at (datetime.datetime):
            updated_at (datetime.datetime):
            endpoint (FunctionTestRunDeliveryEndpointType0 | None):
     """

    id: str
    endpoint_id: UUID
    endpoint_url: str
    status: FunctionTestRunDeliveryStatus
    attempt_count: int
    duration_ms: int | None
    last_error: None | str
    last_error_code: None | str
    created_at: datetime.datetime
    updated_at: datetime.datetime
    endpoint: FunctionTestRunDeliveryEndpointType0 | None
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.function_test_run_delivery_endpoint_type_0 import FunctionTestRunDeliveryEndpointType0
        id = self.id

        endpoint_id = str(self.endpoint_id)

        endpoint_url = self.endpoint_url

        status = self.status.value

        attempt_count = self.attempt_count

        duration_ms: int | None
        duration_ms = self.duration_ms

        last_error: None | str
        last_error = self.last_error

        last_error_code: None | str
        last_error_code = self.last_error_code

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()

        endpoint: dict[str, Any] | None
        if isinstance(self.endpoint, FunctionTestRunDeliveryEndpointType0):
            endpoint = self.endpoint.to_dict()
        else:
            endpoint = self.endpoint


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "endpoint_id": endpoint_id,
            "endpoint_url": endpoint_url,
            "status": status,
            "attempt_count": attempt_count,
            "duration_ms": duration_ms,
            "last_error": last_error,
            "last_error_code": last_error_code,
            "created_at": created_at,
            "updated_at": updated_at,
            "endpoint": endpoint,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.function_test_run_delivery_endpoint_type_0 import FunctionTestRunDeliveryEndpointType0
        d = dict(src_dict)
        id = d.pop("id")

        endpoint_id = UUID(d.pop("endpoint_id"))




        endpoint_url = d.pop("endpoint_url")

        status = FunctionTestRunDeliveryStatus(d.pop("status"))




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


        created_at = isoparse(d.pop("created_at"))




        updated_at = isoparse(d.pop("updated_at"))




        def _parse_endpoint(data: object) -> FunctionTestRunDeliveryEndpointType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_function_test_run_delivery_endpoint_type_0 = FunctionTestRunDeliveryEndpointType0.from_dict(data)



                return componentsschemas_function_test_run_delivery_endpoint_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(FunctionTestRunDeliveryEndpointType0 | None, data)

        endpoint = _parse_endpoint(d.pop("endpoint"))


        function_test_run_delivery = cls(
            id=id,
            endpoint_id=endpoint_id,
            endpoint_url=endpoint_url,
            status=status,
            attempt_count=attempt_count,
            duration_ms=duration_ms,
            last_error=last_error,
            last_error_code=last_error_code,
            created_at=created_at,
            updated_at=updated_at,
            endpoint=endpoint,
        )


        function_test_run_delivery.additional_properties = d
        return function_test_run_delivery

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
