from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime






T = TypeVar("T", bound="RotatedKey")



@_attrs_define
class RotatedKey:
    """ 
        Attributes:
            id (str):
            key (str): The new secret. Shown once; store it now.
            key_prefix (str):
            previous_key_id (str):
            previous_key_expires_at (datetime.datetime):
     """

    id: str
    key: str
    key_prefix: str
    previous_key_id: str
    previous_key_expires_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = self.id

        key = self.key

        key_prefix = self.key_prefix

        previous_key_id = self.previous_key_id

        previous_key_expires_at = self.previous_key_expires_at.isoformat()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "key": key,
            "key_prefix": key_prefix,
            "previous_key_id": previous_key_id,
            "previous_key_expires_at": previous_key_expires_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = d.pop("id")

        key = d.pop("key")

        key_prefix = d.pop("key_prefix")

        previous_key_id = d.pop("previous_key_id")

        previous_key_expires_at = datetime.datetime.fromisoformat(d.pop("previous_key_expires_at"))




        rotated_key = cls(
            id=id,
            key=key,
            key_prefix=key_prefix,
            previous_key_id=previous_key_id,
            previous_key_expires_at=previous_key_expires_at,
        )


        rotated_key.additional_properties = d
        return rotated_key

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
