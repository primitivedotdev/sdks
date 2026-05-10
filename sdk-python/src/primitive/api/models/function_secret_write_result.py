from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from dateutil.parser import isoparse
from typing import cast
import datetime






T = TypeVar("T", bound="FunctionSecretWriteResult")



@_attrs_define
class FunctionSecretWriteResult:
    """ Returned by POST and PUT secret routes.

        Attributes:
            key (str):
            created_at (datetime.datetime):
            updated_at (datetime.datetime):
            created (bool): True if this call inserted a new row, false if it updated an existing one.
     """

    key: str
    created_at: datetime.datetime
    updated_at: datetime.datetime
    created: bool
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        key = self.key

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()

        created = self.created


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "key": key,
            "created_at": created_at,
            "updated_at": updated_at,
            "created": created,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        key = d.pop("key")

        created_at = isoparse(d.pop("created_at"))




        updated_at = isoparse(d.pop("updated_at"))




        created = d.pop("created")

        function_secret_write_result = cls(
            key=key,
            created_at=created_at,
            updated_at=updated_at,
            created=created,
        )


        function_secret_write_result.additional_properties = d
        return function_secret_write_result

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
