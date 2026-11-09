from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="TestEmailRuleResultCounts")



@_attrs_define
class TestEmailRuleResultCounts:
    """ 
        Attributes:
            emails (int):
            matched (int):
            near_miss (int):
            no_match (int):
            unclassified (int):
            not_found (int):
     """

    emails: int
    matched: int
    near_miss: int
    no_match: int
    unclassified: int
    not_found: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        emails = self.emails

        matched = self.matched

        near_miss = self.near_miss

        no_match = self.no_match

        unclassified = self.unclassified

        not_found = self.not_found


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "emails": emails,
            "matched": matched,
            "near_miss": near_miss,
            "no_match": no_match,
            "unclassified": unclassified,
            "not_found": not_found,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        emails = d.pop("emails")

        matched = d.pop("matched")

        near_miss = d.pop("near_miss")

        no_match = d.pop("no_match")

        unclassified = d.pop("unclassified")

        not_found = d.pop("not_found")

        test_email_rule_result_counts = cls(
            emails=emails,
            matched=matched,
            near_miss=near_miss,
            no_match=no_match,
            unclassified=unclassified,
            not_found=not_found,
        )


        test_email_rule_result_counts.additional_properties = d
        return test_email_rule_result_counts

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
