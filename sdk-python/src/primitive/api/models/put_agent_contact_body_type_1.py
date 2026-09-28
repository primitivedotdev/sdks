from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID






T = TypeVar("T", bound="PutAgentContactBodyType1")



@_attrs_define
class PutAgentContactBodyType1:
    """ 
        Attributes:
            if_version (UUID): Opaque CAS token. Changes on mutations and cannot be reused after deletion/recreation.
            purpose (None | str | Unset):
            notify (bool | Unset):
     """

    if_version: UUID
    purpose: None | str | Unset = UNSET
    notify: bool | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        if_version = str(self.if_version)

        purpose: None | str | Unset
        if isinstance(self.purpose, Unset):
            purpose = UNSET
        else:
            purpose = self.purpose

        notify = self.notify


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "if_version": if_version,
        })
        if purpose is not UNSET:
            field_dict["purpose"] = purpose
        if notify is not UNSET:
            field_dict["notify"] = notify

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        if_version = UUID(d.pop("if_version"))




        def _parse_purpose(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        purpose = _parse_purpose(d.pop("purpose", UNSET))


        notify = d.pop("notify", UNSET)

        put_agent_contact_body_type_1 = cls(
            if_version=if_version,
            purpose=purpose,
            notify=notify,
        )

        return put_agent_contact_body_type_1

