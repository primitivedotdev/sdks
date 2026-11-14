from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="AmendEmailRuleObjectionRequest")



@_attrs_define
class AmendEmailRuleObjectionRequest:
    """ 
        Attributes:
            note (None | str | Unset): What you changed, up to 500 characters; null or absent for none. The member who
                objected sees it.
     """

    note: None | str | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        note: None | str | Unset
        if isinstance(self.note, Unset):
            note = UNSET
        else:
            note = self.note


        field_dict: dict[str, Any] = {}

        field_dict.update({
        })
        if note is not UNSET:
            field_dict["note"] = note

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        def _parse_note(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        note = _parse_note(d.pop("note", UNSET))


        amend_email_rule_objection_request = cls(
            note=note,
        )

        return amend_email_rule_objection_request

