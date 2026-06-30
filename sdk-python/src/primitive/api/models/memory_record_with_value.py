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

if TYPE_CHECKING:
  from ..models.memory_json_value_type_5 import MemoryJsonValueType5
  from ..models.memory_resolved_scope import MemoryResolvedScope





T = TypeVar("T", bound="MemoryRecordWithValue")



@_attrs_define
class MemoryRecordWithValue:
    """ Memory record returned by get and set operations.

        Attributes:
            id (UUID):
            key (str): Caller-defined key, at most 512 UTF-8 bytes.
            scope (MemoryResolvedScope): Resolved memory scope returned by the API.
            value (bool | float | list[Any] | MemoryJsonValueType5 | None | str): JSON value accepted by Primitive Memories.
                The server accepts strings,
                numbers, booleans, null, arrays, and objects, validates nested values,
                and rejects values that do not serialize as JSON.
            version (str): Bigint counter serialized as a base-10 string.
            created_at (datetime.datetime):
            updated_at (datetime.datetime):
            last_read_at (datetime.datetime | None): Last successful get timestamp, or null before any get.
            read_count (str): Bigint counter serialized as a base-10 string.
            write_count (str): Bigint counter serialized as a base-10 string.
            expires_at (datetime.datetime | None): Expiration timestamp, or null for no TTL.
            created_by (None | str): Actor that created the memory, when available.
            updated_by (None | str): Actor that last updated the memory, when available.
     """

    id: UUID
    key: str
    scope: MemoryResolvedScope
    value: bool | float | list[Any] | MemoryJsonValueType5 | None | str
    version: str
    created_at: datetime.datetime
    updated_at: datetime.datetime
    last_read_at: datetime.datetime | None
    read_count: str
    write_count: str
    expires_at: datetime.datetime | None
    created_by: None | str
    updated_by: None | str





    def to_dict(self) -> dict[str, Any]:
        from ..models.memory_json_value_type_5 import MemoryJsonValueType5
        from ..models.memory_resolved_scope import MemoryResolvedScope
        id = str(self.id)

        key = self.key

        scope = self.scope.to_dict()

        value: bool | dict[str, Any] | float | list[Any] | None | str
        if isinstance(self.value, list):
            value = self.value


        elif isinstance(self.value, MemoryJsonValueType5):
            value = self.value.to_dict()
        else:
            value = self.value

        version = self.version

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()

        last_read_at: None | str
        if isinstance(self.last_read_at, datetime.datetime):
            last_read_at = self.last_read_at.isoformat()
        else:
            last_read_at = self.last_read_at

        read_count = self.read_count

        write_count = self.write_count

        expires_at: None | str
        if isinstance(self.expires_at, datetime.datetime):
            expires_at = self.expires_at.isoformat()
        else:
            expires_at = self.expires_at

        created_by: None | str
        created_by = self.created_by

        updated_by: None | str
        updated_by = self.updated_by


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "key": key,
            "scope": scope,
            "value": value,
            "version": version,
            "created_at": created_at,
            "updated_at": updated_at,
            "last_read_at": last_read_at,
            "read_count": read_count,
            "write_count": write_count,
            "expires_at": expires_at,
            "created_by": created_by,
            "updated_by": updated_by,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.memory_json_value_type_5 import MemoryJsonValueType5
        from ..models.memory_resolved_scope import MemoryResolvedScope
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        key = d.pop("key")

        scope = MemoryResolvedScope.from_dict(d.pop("scope"))




        def _parse_value(data: object) -> bool | float | list[Any] | MemoryJsonValueType5 | None | str:
            if data is None:
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                componentsschemas_memory_json_value_type_4 = cast(list[Any], data)

                return componentsschemas_memory_json_value_type_4
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_memory_json_value_type_5 = MemoryJsonValueType5.from_dict(data)



                return componentsschemas_memory_json_value_type_5
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(bool | float | list[Any] | MemoryJsonValueType5 | None | str, data)

        value = _parse_value(d.pop("value"))


        version = d.pop("version")

        created_at = isoparse(d.pop("created_at"))




        updated_at = isoparse(d.pop("updated_at"))




        def _parse_last_read_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                last_read_at_type_0 = isoparse(data)



                return last_read_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        last_read_at = _parse_last_read_at(d.pop("last_read_at"))


        read_count = d.pop("read_count")

        write_count = d.pop("write_count")

        def _parse_expires_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                expires_at_type_0 = isoparse(data)



                return expires_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        expires_at = _parse_expires_at(d.pop("expires_at"))


        def _parse_created_by(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        created_by = _parse_created_by(d.pop("created_by"))


        def _parse_updated_by(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        updated_by = _parse_updated_by(d.pop("updated_by"))


        memory_record_with_value = cls(
            id=id,
            key=key,
            scope=scope,
            value=value,
            version=version,
            created_at=created_at,
            updated_at=updated_at,
            last_read_at=last_read_at,
            read_count=read_count,
            write_count=write_count,
            expires_at=expires_at,
            created_by=created_by,
            updated_by=updated_by,
        )

        return memory_record_with_value

