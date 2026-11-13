from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="DeclineEmailRuleObjectionRequest")



@_attrs_define
class DeclineEmailRuleObjectionRequest:
    """ 
        Attributes:
            reason (None | str | Unset): Why you are declining, up to 500 characters; null or absent for none. The member
                who objected sees it: it is how to answer one that asks you to narrow the rule or explain who receives it.
     """

    reason: None | str | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        reason: None | str | Unset
        if isinstance(self.reason, Unset):
            reason = UNSET
        else:
            reason = self.reason


        field_dict: dict[str, Any] = {}

        field_dict.update({
        })
        if reason is not UNSET:
            field_dict["reason"] = reason

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        def _parse_reason(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        reason = _parse_reason(d.pop("reason", UNSET))


        decline_email_rule_objection_request = cls(
            reason=reason,
        )

        return decline_email_rule_objection_request

