from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime






T = TypeVar("T", bound="CredentialsRotateKeyResult")



@_attrs_define
class CredentialsRotateKeyResult:
    """ 
        Attributes:
            id (str):
            key (str):
            key_prefix (str):
            previous_key_id (str):
            previous_key_expires_at (datetime.datetime): When the old key stops working: the time of the rotation plus
                overlap_seconds (24 hours when it was omitted, now when it was 0), or the key's own expires_at when that comes
                first.
            expires_at (datetime.datetime | None | Unset):
     """

    id: str
    key: str
    key_prefix: str
    previous_key_id: str
    previous_key_expires_at: datetime.datetime
    expires_at: datetime.datetime | None | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = self.id

        key = self.key

        key_prefix = self.key_prefix

        previous_key_id = self.previous_key_id

        previous_key_expires_at = self.previous_key_expires_at.isoformat()

        expires_at: None | str | Unset
        if isinstance(self.expires_at, Unset):
            expires_at = UNSET
        elif isinstance(self.expires_at, datetime.datetime):
            expires_at = self.expires_at.isoformat()
        else:
            expires_at = self.expires_at


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "key": key,
            "key_prefix": key_prefix,
            "previous_key_id": previous_key_id,
            "previous_key_expires_at": previous_key_expires_at,
        })
        if expires_at is not UNSET:
            field_dict["expires_at"] = expires_at

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = d.pop("id")

        key = d.pop("key")

        key_prefix = d.pop("key_prefix")

        previous_key_id = d.pop("previous_key_id")

        previous_key_expires_at = datetime.datetime.fromisoformat(d.pop("previous_key_expires_at"))




        def _parse_expires_at(data: object) -> datetime.datetime | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                expires_at_type_0 = datetime.datetime.fromisoformat(data)



                return expires_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None | Unset, data)

        expires_at = _parse_expires_at(d.pop("expires_at", UNSET))


        credentials_rotate_key_result = cls(
            id=id,
            key=key,
            key_prefix=key_prefix,
            previous_key_id=previous_key_id,
            previous_key_expires_at=previous_key_expires_at,
            expires_at=expires_at,
        )


        credentials_rotate_key_result.additional_properties = d
        return credentials_rotate_key_result

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
