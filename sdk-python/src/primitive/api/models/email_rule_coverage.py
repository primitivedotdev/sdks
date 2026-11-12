from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.email_rule_coverage_via import EmailRuleCoverageVia
from typing import cast






T = TypeVar("T", bound="EmailRuleCoverage")



@_attrs_define
class EmailRuleCoverage:
    """ 
        Attributes:
            addresses (list[str]): Your own mailboxes (your member mailbox and your personal agents' addresses) it reaches
                now, lowercase.
            via (EmailRuleCoverageVia): author_reach: it runs over everything its author can read, which includes these.
                selected: it names these mailboxes or their domain. own_mailboxes: it is your own rule over your own mail.
     """

    addresses: list[str]
    via: EmailRuleCoverageVia
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        addresses = self.addresses



        via = self.via.value


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "addresses": addresses,
            "via": via,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        addresses = cast(list[str], d.pop("addresses"))


        via = EmailRuleCoverageVia(d.pop("via"))




        email_rule_coverage = cls(
            addresses=addresses,
            via=via,
        )


        email_rule_coverage.additional_properties = d
        return email_rule_coverage

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
