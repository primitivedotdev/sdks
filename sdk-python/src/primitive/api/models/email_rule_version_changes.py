from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.email_rule_changed_emails import EmailRuleChangedEmails





T = TypeVar("T", bound="EmailRuleVersionChanges")



@_attrs_define
class EmailRuleVersionChanges:
    """ 
        Attributes:
            compared_to_version (int): The rule's current version, compared against.
            newly_matched (EmailRuleChangedEmails):
            stops_matching (EmailRuleChangedEmails):
            undecided (int): Emails listed in results that either version could not decide (unclassified, skipped and not
                found included), in neither list.
     """

    compared_to_version: int
    newly_matched: EmailRuleChangedEmails
    stops_matching: EmailRuleChangedEmails
    undecided: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_changed_emails import EmailRuleChangedEmails # noqa: PLC0415
        compared_to_version = self.compared_to_version

        newly_matched = self.newly_matched.to_dict()

        stops_matching = self.stops_matching.to_dict()

        undecided = self.undecided


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "compared_to_version": compared_to_version,
            "newly_matched": newly_matched,
            "stops_matching": stops_matching,
            "undecided": undecided,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_changed_emails import EmailRuleChangedEmails # noqa: PLC0415
        d = dict(src_dict)
        compared_to_version = d.pop("compared_to_version")

        newly_matched = EmailRuleChangedEmails.from_dict(d.pop("newly_matched"))




        stops_matching = EmailRuleChangedEmails.from_dict(d.pop("stops_matching"))




        undecided = d.pop("undecided")

        email_rule_version_changes = cls(
            compared_to_version=compared_to_version,
            newly_matched=newly_matched,
            stops_matching=stops_matching,
            undecided=undecided,
        )


        email_rule_version_changes.additional_properties = d
        return email_rule_version_changes

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
