from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.gate_fix_action import GateFixAction






T = TypeVar("T", bound="GateFix")



@_attrs_define
class GateFix:
    """ 
        Attributes:
            action (GateFixAction): Suggested next action for the caller.
            subject (str): Entity the action applies to.
     """

    action: GateFixAction
    subject: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        action = self.action.value

        subject = self.subject


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "action": action,
            "subject": subject,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        action = GateFixAction(d.pop("action"))




        subject = d.pop("subject")

        gate_fix = cls(
            action=action,
            subject=subject,
        )


        gate_fix.additional_properties = d
        return gate_fix

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
