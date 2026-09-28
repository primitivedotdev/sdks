from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="PutAgentContactBodyType0")



@_attrs_define
class PutAgentContactBodyType0:
    """ 
        Attributes:
            if_absent (bool):
            purpose (None | str | Unset):
            notify (bool | Unset):
     """

    if_absent: bool
    purpose: None | str | Unset = UNSET
    notify: bool | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        if_absent = self.if_absent

        purpose: None | str | Unset
        if isinstance(self.purpose, Unset):
            purpose = UNSET
        else:
            purpose = self.purpose

        notify = self.notify


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "if_absent": if_absent,
        })
        if purpose is not UNSET:
            field_dict["purpose"] = purpose
        if notify is not UNSET:
            field_dict["notify"] = notify

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        if_absent = d.pop("if_absent")

        def _parse_purpose(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        purpose = _parse_purpose(d.pop("purpose", UNSET))


        notify = d.pop("notify", UNSET)

        put_agent_contact_body_type_0 = cls(
            if_absent=if_absent,
            purpose=purpose,
            notify=notify,
        )

        return put_agent_contact_body_type_0

