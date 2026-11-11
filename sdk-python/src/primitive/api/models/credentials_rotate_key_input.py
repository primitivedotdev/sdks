from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime






T = TypeVar("T", bound="CredentialsRotateKeyInput")



@_attrs_define
class CredentialsRotateKeyInput:
    """ 
        Attributes:
            overlap_seconds (int | Unset): How long the old key keeps working, in seconds, up to 604800 (7 days), and never
                past its own expires_at. 86400 (24 hours) when omitted. 0 stops the old key at once: use it when rotating
                because the secret leaked.
            expires_at (datetime.datetime | None | Unset): The new key's expiry. Omitted, it keeps the old key's expiry:
                rotating alone never extends a key. A time sets it, within the organization's credential policy (its maximum key
                lifetime counts from now); null makes it never expire, where the policy allows. Needs keys:manage, as changing a
                key does. The old key stops when the overlap ends, or at this expiry if that comes first.
     """

    overlap_seconds: int | Unset = UNSET
    expires_at: datetime.datetime | None | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        overlap_seconds = self.overlap_seconds

        expires_at: None | str | Unset
        if isinstance(self.expires_at, Unset):
            expires_at = UNSET
        elif isinstance(self.expires_at, datetime.datetime):
            expires_at = self.expires_at.isoformat()
        else:
            expires_at = self.expires_at


        field_dict: dict[str, Any] = {}

        field_dict.update({
        })
        if overlap_seconds is not UNSET:
            field_dict["overlap_seconds"] = overlap_seconds
        if expires_at is not UNSET:
            field_dict["expires_at"] = expires_at

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        overlap_seconds = d.pop("overlap_seconds", UNSET)

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


        credentials_rotate_key_input = cls(
            overlap_seconds=overlap_seconds,
            expires_at=expires_at,
        )

        return credentials_rotate_key_input

