from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.function_route_result_conflict_kind import FunctionRouteResultConflictKind
from typing import cast
from uuid import UUID






T = TypeVar("T", bound="FunctionRouteResultConflict")



@_attrs_define
class FunctionRouteResultConflict:
    """ 
        Attributes:
            kind (FunctionRouteResultConflictKind):
            function_id (None | Unset | UUID):
            function_name (None | str | Unset):
            url (None | str | Unset):
     """

    kind: FunctionRouteResultConflictKind
    function_id: None | Unset | UUID = UNSET
    function_name: None | str | Unset = UNSET
    url: None | str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        kind = self.kind.value

        function_id: None | str | Unset
        if isinstance(self.function_id, Unset):
            function_id = UNSET
        elif isinstance(self.function_id, UUID):
            function_id = str(self.function_id)
        else:
            function_id = self.function_id

        function_name: None | str | Unset
        if isinstance(self.function_name, Unset):
            function_name = UNSET
        else:
            function_name = self.function_name

        url: None | str | Unset
        if isinstance(self.url, Unset):
            url = UNSET
        else:
            url = self.url


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "kind": kind,
        })
        if function_id is not UNSET:
            field_dict["functionId"] = function_id
        if function_name is not UNSET:
            field_dict["functionName"] = function_name
        if url is not UNSET:
            field_dict["url"] = url

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        kind = FunctionRouteResultConflictKind(d.pop("kind"))




        def _parse_function_id(data: object) -> None | Unset | UUID:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                function_id_type_0 = UUID(data)



                return function_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | Unset | UUID, data)

        function_id = _parse_function_id(d.pop("functionId", UNSET))


        def _parse_function_name(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        function_name = _parse_function_name(d.pop("functionName", UNSET))


        def _parse_url(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        url = _parse_url(d.pop("url", UNSET))


        function_route_result_conflict = cls(
            kind=kind,
            function_id=function_id,
            function_name=function_name,
            url=url,
        )


        function_route_result_conflict.additional_properties = d
        return function_route_result_conflict

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
