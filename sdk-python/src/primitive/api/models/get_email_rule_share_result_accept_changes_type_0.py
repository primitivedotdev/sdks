from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="GetEmailRuleShareResultAcceptChangesType0")



@_attrs_define
class GetEmailRuleShareResultAcceptChangesType0:
    """ When edited_on_accept, for the member sharing their mail and the member it is shared with, live or not: what was
    asked for beside what was accepted. Null otherwise, and for anyone else.

        Attributes:
            requested_english (str): The English the member who asked asked for.
            accepted_english (str): The English that was accepted. Can match requested_english when only the tree changed.
     """

    requested_english: str
    accepted_english: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        requested_english = self.requested_english

        accepted_english = self.accepted_english


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "requested_english": requested_english,
            "accepted_english": accepted_english,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        requested_english = d.pop("requested_english")

        accepted_english = d.pop("accepted_english")

        get_email_rule_share_result_accept_changes_type_0 = cls(
            requested_english=requested_english,
            accepted_english=accepted_english,
        )


        get_email_rule_share_result_accept_changes_type_0.additional_properties = d
        return get_email_rule_share_result_accept_changes_type_0

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
