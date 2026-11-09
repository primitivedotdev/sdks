from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.put_address_note_request_visibility import PutAddressNoteRequestVisibility






T = TypeVar("T", bound="PutAddressNoteRequest")



@_attrs_define
class PutAddressNoteRequest:
    """ 
        Attributes:
            value (Any): Any JSON value. Both UTF-8 serialized JSON and stored JSONB text must fit within 65536 bytes.
            visibility (PutAddressNoteRequestVisibility | Unset): New notes default to private. Omit to retain current
                visibility. Public edits become public immediately. Publishing requires current active verified domain
                ownership.
            if_absent (bool | Unset): When true, fail with 409 if a live note exists. Mutually exclusive with if_version.
            if_version (str | Unset): Monotonic version for this org, address and name, including deletion and recreation.
     """

    value: Any
    visibility: PutAddressNoteRequestVisibility | Unset = UNSET
    if_absent: bool | Unset = UNSET
    if_version: str | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        value = self.value

        visibility: str | Unset = UNSET
        if not isinstance(self.visibility, Unset):
            visibility = self.visibility.value


        if_absent = self.if_absent

        if_version = self.if_version


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "value": value,
        })
        if visibility is not UNSET:
            field_dict["visibility"] = visibility
        if if_absent is not UNSET:
            field_dict["if_absent"] = if_absent
        if if_version is not UNSET:
            field_dict["if_version"] = if_version

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        value = d.pop("value")

        _visibility = d.pop("visibility", UNSET)
        visibility: PutAddressNoteRequestVisibility | Unset
        if isinstance(_visibility,  Unset):
            visibility = UNSET
        else:
            visibility = PutAddressNoteRequestVisibility(_visibility)




        if_absent = d.pop("if_absent", UNSET)

        if_version = d.pop("if_version", UNSET)

        put_address_note_request = cls(
            value=value,
            visibility=visibility,
            if_absent=if_absent,
            if_version=if_version,
        )

        return put_address_note_request

