from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.function_log_row_level import FunctionLogRowLevel
from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.function_log_row_metadata_type_0 import FunctionLogRowMetadataType0





T = TypeVar("T", bound="FunctionLogRow")



@_attrs_define
class FunctionLogRow:
    """ One row from GET /functions/{id}/logs. Represents a single
    captured log line emitted by the running handler (e.g. via
    `console.log` / `console.error`).

        Attributes:
            id (UUID): Unique log row id (stable across pages).
            function_id (UUID): The function this log row belongs to.
            level (FunctionLogRowLevel): Severity. `log` is the runtime's default for unannotated
                `console.log` calls; the other levels match standard
                `console.*` methods.
            message (str): The textual message body. The runtime stringifies non-string
                arguments before persisting, so this is always a plain
                string.
            ts (datetime.datetime): When the handler emitted this line. Newest-first ordering
                on this column drives pagination; clock is the runtime's,
                not the gateway's.
            metadata (FunctionLogRowMetadataType0 | None | Unset): Optional structured payload the runtime attaches
                alongside
                the message (e.g. extra args passed to `console.log`).
                Shape is opaque; treat keys as untyped.
     """

    id: UUID
    function_id: UUID
    level: FunctionLogRowLevel
    message: str
    ts: datetime.datetime
    metadata: FunctionLogRowMetadataType0 | None | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.function_log_row_metadata_type_0 import FunctionLogRowMetadataType0
        id = str(self.id)

        function_id = str(self.function_id)

        level = self.level.value

        message = self.message

        ts = self.ts.isoformat()

        metadata: dict[str, Any] | None | Unset
        if isinstance(self.metadata, Unset):
            metadata = UNSET
        elif isinstance(self.metadata, FunctionLogRowMetadataType0):
            metadata = self.metadata.to_dict()
        else:
            metadata = self.metadata


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "function_id": function_id,
            "level": level,
            "message": message,
            "ts": ts,
        })
        if metadata is not UNSET:
            field_dict["metadata"] = metadata

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.function_log_row_metadata_type_0 import FunctionLogRowMetadataType0
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        function_id = UUID(d.pop("function_id"))




        level = FunctionLogRowLevel(d.pop("level"))




        message = d.pop("message")

        ts = isoparse(d.pop("ts"))




        def _parse_metadata(data: object) -> FunctionLogRowMetadataType0 | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                metadata_type_0 = FunctionLogRowMetadataType0.from_dict(data)



                return metadata_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(FunctionLogRowMetadataType0 | None | Unset, data)

        metadata = _parse_metadata(d.pop("metadata", UNSET))


        function_log_row = cls(
            id=id,
            function_id=function_id,
            level=level,
            message=message,
            ts=ts,
            metadata=metadata,
        )


        function_log_row.additional_properties = d
        return function_log_row

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
