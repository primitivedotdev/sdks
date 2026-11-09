from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="GetFunctionInvocationResultLogsItem")



@_attrs_define
class GetFunctionInvocationResultLogsItem:
    """ 
        Attributes:
            id (UUID):
            function_id (UUID):
            level (str):
            message (None | str):
            ts (datetime.datetime):
            metadata (Any):
     """

    id: UUID
    function_id: UUID
    level: str
    message: None | str
    ts: datetime.datetime
    metadata: Any
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        function_id = str(self.function_id)

        level = self.level

        message: None | str
        message = self.message

        ts = self.ts.isoformat()

        metadata = self.metadata


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "function_id": function_id,
            "level": level,
            "message": message,
            "ts": ts,
            "metadata": metadata,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        function_id = UUID(d.pop("function_id"))




        level = d.pop("level")

        def _parse_message(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        message = _parse_message(d.pop("message"))


        ts = datetime.datetime.fromisoformat(d.pop("ts"))




        metadata = d.pop("metadata")

        get_function_invocation_result_logs_item = cls(
            id=id,
            function_id=function_id,
            level=level,
            message=message,
            ts=ts,
            metadata=metadata,
        )


        get_function_invocation_result_logs_item.additional_properties = d
        return get_function_invocation_result_logs_item

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
