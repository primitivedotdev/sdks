from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="PutContactResponse200Data")



@_attrs_define
class PutContactResponse200Data:
    """ 
        Attributes:
            address (str): Bare email address; trim and lowercase, preserving dots and plus tags.
            display_name (None | str):
            version (UUID): Opaque CAS token. Changes on mutations and cannot be reused after deletion/recreation.
            created_at (datetime.datetime):
            updated_at (datetime.datetime):
     """

    address: str
    display_name: None | str
    version: UUID
    created_at: datetime.datetime
    updated_at: datetime.datetime





    def to_dict(self) -> dict[str, Any]:
        address = self.address

        display_name: None | str
        display_name = self.display_name

        version = str(self.version)

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "address": address,
            "display_name": display_name,
            "version": version,
            "created_at": created_at,
            "updated_at": updated_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        address = d.pop("address")

        def _parse_display_name(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        display_name = _parse_display_name(d.pop("display_name"))


        version = UUID(d.pop("version"))




        created_at = datetime.datetime.fromisoformat(d.pop("created_at"))




        updated_at = datetime.datetime.fromisoformat(d.pop("updated_at"))




        put_contact_response_200_data = cls(
            address=address,
            display_name=display_name,
            version=version,
            created_at=created_at,
            updated_at=updated_at,
        )

        return put_contact_response_200_data

