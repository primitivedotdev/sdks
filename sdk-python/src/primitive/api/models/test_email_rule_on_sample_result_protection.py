from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.test_email_rule_on_sample_result_protection_outcome import TestEmailRuleOnSampleResultProtectionOutcome
from typing import cast

if TYPE_CHECKING:
  from ..models.test_email_rule_on_sample_result_protection_withheld_by_item import TestEmailRuleOnSampleResultProtectionWithheldByItem





T = TypeVar("T", bound="TestEmailRuleOnSampleResultProtection")



@_attrs_define
class TestEmailRuleOnSampleResultProtection:
    """ With with_protection: whether a match would be shared. Nothing is stored.

        Attributes:
            mailbox (str): The mailbox judged: the first recipient.
            outcome (TestEmailRuleOnSampleResultProtectionOutcome): not_matched: the rule did not match, so nothing would be
                shared and no do-not-share rule was judged.
            withheld_by (list[TestEmailRuleOnSampleResultProtectionWithheldByItem]): Do-not-share rules you can see that
                would keep it from being shared. undecided: left undecided as real mail would leave it, or not reached by this
                test (past 50 rules, 10 rules' questions, or the time limit); it is held back either way.
            withheld_by_hidden (int): Rules you cannot see that would.
     """

    mailbox: str
    outcome: TestEmailRuleOnSampleResultProtectionOutcome
    withheld_by: list[TestEmailRuleOnSampleResultProtectionWithheldByItem]
    withheld_by_hidden: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.test_email_rule_on_sample_result_protection_withheld_by_item import TestEmailRuleOnSampleResultProtectionWithheldByItem # noqa: PLC0415
        mailbox = self.mailbox

        outcome = self.outcome.value

        withheld_by = []
        for withheld_by_item_data in self.withheld_by:
            withheld_by_item = withheld_by_item_data.to_dict()
            withheld_by.append(withheld_by_item)



        withheld_by_hidden = self.withheld_by_hidden


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "mailbox": mailbox,
            "outcome": outcome,
            "withheld_by": withheld_by,
            "withheld_by_hidden": withheld_by_hidden,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.test_email_rule_on_sample_result_protection_withheld_by_item import TestEmailRuleOnSampleResultProtectionWithheldByItem # noqa: PLC0415
        d = dict(src_dict)
        mailbox = d.pop("mailbox")

        outcome = TestEmailRuleOnSampleResultProtectionOutcome(d.pop("outcome"))




        withheld_by = []
        _withheld_by = d.pop("withheld_by")
        for withheld_by_item_data in (_withheld_by):
            withheld_by_item = TestEmailRuleOnSampleResultProtectionWithheldByItem.from_dict(withheld_by_item_data)



            withheld_by.append(withheld_by_item)


        withheld_by_hidden = d.pop("withheld_by_hidden")

        test_email_rule_on_sample_result_protection = cls(
            mailbox=mailbox,
            outcome=outcome,
            withheld_by=withheld_by,
            withheld_by_hidden=withheld_by_hidden,
        )


        test_email_rule_on_sample_result_protection.additional_properties = d
        return test_email_rule_on_sample_result_protection

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
