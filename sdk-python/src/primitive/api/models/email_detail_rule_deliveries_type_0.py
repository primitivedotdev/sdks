from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.email_detail_rule_deliveries_type_0_rules_item import EmailDetailRuleDeliveriesType0RulesItem





T = TypeVar("T", bound="EmailDetailRuleDeliveriesType0")



@_attrs_define
class EmailDetailRuleDeliveriesType0:
    """ Where Email Rules delivered this email by webhook, for the owner of the mailbox it is at, on their own dashboard
    session or the Primitive CLI. Null for everyone else, and when it could not be read in time. A key reading it
    through a rule is not a delivery.

        Attributes:
            rules (list[EmailDetailRuleDeliveriesType0RulesItem]): Each rule over your mail that queued a webhook delivery
                of this email, newest rule first.
            hidden (int): Rules that queued a delivery of it that are not listed: they do not cover your mailboxes now, or
                are past the 50 one answer judges.
            complete (bool): False when a delivery may be missing: the email is older than 14 days, or it has more
                deliveries or rules than one answer reads.
     """

    rules: list[EmailDetailRuleDeliveriesType0RulesItem]
    hidden: int
    complete: bool
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_detail_rule_deliveries_type_0_rules_item import EmailDetailRuleDeliveriesType0RulesItem # noqa: PLC0415
        rules = []
        for rules_item_data in self.rules:
            rules_item = rules_item_data.to_dict()
            rules.append(rules_item)



        hidden = self.hidden

        complete = self.complete


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "rules": rules,
            "hidden": hidden,
            "complete": complete,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_detail_rule_deliveries_type_0_rules_item import EmailDetailRuleDeliveriesType0RulesItem # noqa: PLC0415
        d = dict(src_dict)
        rules = []
        _rules = d.pop("rules")
        for rules_item_data in (_rules):
            rules_item = EmailDetailRuleDeliveriesType0RulesItem.from_dict(rules_item_data)



            rules.append(rules_item)


        hidden = d.pop("hidden")

        complete = d.pop("complete")

        email_detail_rule_deliveries_type_0 = cls(
            rules=rules,
            hidden=hidden,
            complete=complete,
        )


        email_detail_rule_deliveries_type_0.additional_properties = d
        return email_detail_rule_deliveries_type_0

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
