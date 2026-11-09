from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.memory_json_value_type_5 import MemoryJsonValueType5
  from ..models.memory_scope import MemoryScope





T = TypeVar("T", bound="SetMemoryInput")



@_attrs_define
class SetMemoryInput:
    """ 
        Attributes:
            key (str): Caller-defined key, at most 512 UTF-8 bytes.
            value (bool | float | list[Any] | MemoryJsonValueType5 | None | str): JSON value accepted by Primitive Memories.
                The server accepts strings, numbers, booleans, null, arrays, and objects, validates nested values, and rejects
                values that do not serialize as JSON.
            scope (MemoryScope | Unset): Memory scope. `org` resolves to the authenticated organization. `function` requires
                the function id UUID in `id`; function names are not valid scope identifiers. Function-authenticated requests
                cannot override their own Function scope. A Function scope is available only to that Function's own credential,
                to an org-wide API key that can manage the Function, or to a person that can manage the Function; other
                credentials get `403 forbidden`.
            ttl_seconds (int | Unset): Set or replace the TTL in seconds. Mutually exclusive with `expires_at` and
                `clear_ttl`.
            expires_at (datetime.datetime | Unset): Set or replace the absolute expiration timestamp. Mutually exclusive
                with `ttl_seconds` and `clear_ttl`.
            clear_ttl (bool | Unset): Clear any existing TTL. Mutually exclusive with `ttl_seconds` and `expires_at`.
            if_absent (bool | Unset): Create only when the key is absent. Mutually exclusive with `if_version`.
            if_version (str | Unset): Bigint counter serialized as a base-10 string.
     """

    key: str
    value: bool | float | list[Any] | MemoryJsonValueType5 | None | str
    scope: MemoryScope | Unset = UNSET
    ttl_seconds: int | Unset = UNSET
    expires_at: datetime.datetime | Unset = UNSET
    clear_ttl: bool | Unset = UNSET
    if_absent: bool | Unset = UNSET
    if_version: str | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.memory_json_value_type_5 import MemoryJsonValueType5 # noqa: PLC0415
        from ..models.memory_scope import MemoryScope # noqa: PLC0415
        key = self.key

        value: bool | dict[str, Any] | float | list[Any] | None | str
        if isinstance(self.value, list):
            value = self.value


        elif isinstance(self.value, MemoryJsonValueType5):
            value = self.value.to_dict()
        else:
            value = self.value

        scope: dict[str, Any] | Unset = UNSET
        if not isinstance(self.scope, Unset):
            scope = self.scope.to_dict()

        ttl_seconds = self.ttl_seconds

        expires_at: str | Unset = UNSET
        if not isinstance(self.expires_at, Unset):
            expires_at = self.expires_at.isoformat()

        clear_ttl = self.clear_ttl

        if_absent = self.if_absent

        if_version = self.if_version


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "key": key,
            "value": value,
        })
        if scope is not UNSET:
            field_dict["scope"] = scope
        if ttl_seconds is not UNSET:
            field_dict["ttl_seconds"] = ttl_seconds
        if expires_at is not UNSET:
            field_dict["expires_at"] = expires_at
        if clear_ttl is not UNSET:
            field_dict["clear_ttl"] = clear_ttl
        if if_absent is not UNSET:
            field_dict["if_absent"] = if_absent
        if if_version is not UNSET:
            field_dict["if_version"] = if_version

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.memory_json_value_type_5 import MemoryJsonValueType5 # noqa: PLC0415
        from ..models.memory_scope import MemoryScope # noqa: PLC0415
        d = dict(src_dict)
        key = d.pop("key")

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


        _scope = d.pop("scope", UNSET)
        scope: MemoryScope | Unset
        if isinstance(_scope,  Unset):
            scope = UNSET
        else:
            scope = MemoryScope.from_dict(_scope)




        ttl_seconds = d.pop("ttl_seconds", UNSET)

        _expires_at = d.pop("expires_at", UNSET)
        expires_at: datetime.datetime | Unset
        if isinstance(_expires_at,  Unset):
            expires_at = UNSET
        else:
            expires_at = datetime.datetime.fromisoformat(_expires_at)




        clear_ttl = d.pop("clear_ttl", UNSET)

        if_absent = d.pop("if_absent", UNSET)

        if_version = d.pop("if_version", UNSET)

        set_memory_input = cls(
            key=key,
            value=value,
            scope=scope,
            ttl_seconds=ttl_seconds,
            expires_at=expires_at,
            clear_ttl=clear_ttl,
            if_absent=if_absent,
            if_version=if_version,
        )

        return set_memory_input

