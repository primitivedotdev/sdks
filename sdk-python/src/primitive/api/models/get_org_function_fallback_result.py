from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.get_org_function_fallback_result_kind import GetOrgFunctionFallbackResultKind
from typing import cast
from uuid import UUID






T = TypeVar("T", bound="GetOrgFunctionFallbackResult")



@_attrs_define
class GetOrgFunctionFallbackResult:
    """ 
        Attributes:
            kind (GetOrgFunctionFallbackResultKind):
            function_id (None | UUID):
            function_name (None | str):
     """

    kind: GetOrgFunctionFallbackResultKind
    function_id: None | UUID
    function_name: None | str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        kind = self.kind.value

        function_id: None | str
        if isinstance(self.function_id, UUID):
            function_id = str(self.function_id)
        else:
            function_id = self.function_id

        function_name: None | str
        function_name = self.function_name


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "kind": kind,
            "functionId": function_id,
            "functionName": function_name,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        kind = GetOrgFunctionFallbackResultKind(d.pop("kind"))




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

        function_id = _parse_function_id(d.pop("functionId"))


        def _parse_function_name(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        function_name = _parse_function_name(d.pop("functionName"))


        get_org_function_fallback_result = cls(
            kind=kind,
            function_id=function_id,
            function_name=function_name,
        )


        get_org_function_fallback_result.additional_properties = d
        return get_org_function_fallback_result

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
