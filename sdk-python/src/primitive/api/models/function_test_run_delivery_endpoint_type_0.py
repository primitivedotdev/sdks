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






T = TypeVar("T", bound="FunctionTestRunDeliveryEndpointType0")



@_attrs_define
class FunctionTestRunDeliveryEndpointType0:
    """ 
        Attributes:
            id (UUID):
            kind (str): Endpoint kind. Current traces may include `http` or `function`; future endpoint kinds may appear.
            function_id (None | UUID):
            function_name (None | str):
            domain_id (None | UUID):
            enabled (bool):
            deactivated_at (datetime.datetime | None):
            is_current_function (bool):
     """

    id: UUID
    kind: str
    function_id: None | UUID
    function_name: None | str
    domain_id: None | UUID
    enabled: bool
    deactivated_at: datetime.datetime | None
    is_current_function: bool
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        kind = self.kind

        function_id: None | str
        if isinstance(self.function_id, UUID):
            function_id = str(self.function_id)
        else:
            function_id = self.function_id

        function_name: None | str
        function_name = self.function_name

        domain_id: None | str
        if isinstance(self.domain_id, UUID):
            domain_id = str(self.domain_id)
        else:
            domain_id = self.domain_id

        enabled = self.enabled

        deactivated_at: None | str
        if isinstance(self.deactivated_at, datetime.datetime):
            deactivated_at = self.deactivated_at.isoformat()
        else:
            deactivated_at = self.deactivated_at

        is_current_function = self.is_current_function


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "kind": kind,
            "function_id": function_id,
            "function_name": function_name,
            "domain_id": domain_id,
            "enabled": enabled,
            "deactivated_at": deactivated_at,
            "is_current_function": is_current_function,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        kind = d.pop("kind")

        def _parse_function_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                function_id_type_0 = UUID(data)



                return function_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        function_id = _parse_function_id(d.pop("function_id"))


        def _parse_function_name(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        function_name = _parse_function_name(d.pop("function_name"))


        def _parse_domain_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                domain_id_type_0 = UUID(data)



                return domain_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        domain_id = _parse_domain_id(d.pop("domain_id"))


        enabled = d.pop("enabled")

        def _parse_deactivated_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                deactivated_at_type_0 = isoparse(data)



                return deactivated_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        deactivated_at = _parse_deactivated_at(d.pop("deactivated_at"))


        is_current_function = d.pop("is_current_function")

        function_test_run_delivery_endpoint_type_0 = cls(
            id=id,
            kind=kind,
            function_id=function_id,
            function_name=function_name,
            domain_id=domain_id,
            enabled=enabled,
            deactivated_at=deactivated_at,
            is_current_function=is_current_function,
        )


        function_test_run_delivery_endpoint_type_0.additional_properties = d
        return function_test_run_delivery_endpoint_type_0

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
