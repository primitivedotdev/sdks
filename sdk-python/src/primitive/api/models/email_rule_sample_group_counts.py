from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.email_rule_sample_group_counts_must_match import EmailRuleSampleGroupCountsMustMatch
  from ..models.email_rule_sample_group_counts_near_miss import EmailRuleSampleGroupCountsNearMiss
  from ..models.email_rule_sample_group_counts_private import EmailRuleSampleGroupCountsPrivate





T = TypeVar("T", bound="EmailRuleSampleGroupCounts")



@_attrs_define
class EmailRuleSampleGroupCounts:
    """ 
        Attributes:
            private (EmailRuleSampleGroupCountsPrivate):
            near_miss (EmailRuleSampleGroupCountsNearMiss):
            must_match (EmailRuleSampleGroupCountsMustMatch):
     """

    private: EmailRuleSampleGroupCountsPrivate
    near_miss: EmailRuleSampleGroupCountsNearMiss
    must_match: EmailRuleSampleGroupCountsMustMatch
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_sample_group_counts_must_match import EmailRuleSampleGroupCountsMustMatch # noqa: PLC0415
        from ..models.email_rule_sample_group_counts_near_miss import EmailRuleSampleGroupCountsNearMiss # noqa: PLC0415
        from ..models.email_rule_sample_group_counts_private import EmailRuleSampleGroupCountsPrivate # noqa: PLC0415
        private = self.private.to_dict()

        near_miss = self.near_miss.to_dict()

        must_match = self.must_match.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "private": private,
            "near_miss": near_miss,
            "must_match": must_match,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_sample_group_counts_must_match import EmailRuleSampleGroupCountsMustMatch # noqa: PLC0415
        from ..models.email_rule_sample_group_counts_near_miss import EmailRuleSampleGroupCountsNearMiss # noqa: PLC0415
        from ..models.email_rule_sample_group_counts_private import EmailRuleSampleGroupCountsPrivate # noqa: PLC0415
        d = dict(src_dict)
        private = EmailRuleSampleGroupCountsPrivate.from_dict(d.pop("private"))




        near_miss = EmailRuleSampleGroupCountsNearMiss.from_dict(d.pop("near_miss"))




        must_match = EmailRuleSampleGroupCountsMustMatch.from_dict(d.pop("must_match"))




        email_rule_sample_group_counts = cls(
            private=private,
            near_miss=near_miss,
            must_match=must_match,
        )


        email_rule_sample_group_counts.additional_properties = d
        return email_rule_sample_group_counts

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
