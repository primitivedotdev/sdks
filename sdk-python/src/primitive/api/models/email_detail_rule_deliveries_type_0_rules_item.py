from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID






T = TypeVar("T", bound="EmailDetailRuleDeliveriesType0RulesItem")



@_attrs_define
class EmailDetailRuleDeliveriesType0RulesItem:
    """ 
        Attributes:
            rule_id (UUID): The rule. A webhook sent it through several rules counts under one.
            name (str):
            delivered (int): Webhooks it was delivered to.
            pending (int): Webhooks still owed it.
            failed (int): Webhooks whose attempts gave up.
            not_sent (int): Webhooks it was not sent to after all.
            hosts (list[str]): The sites it was delivered to at the time, named as the covering view names sites; they may
                differ from the rule's current receivers there.
            hosts_not_listed (int): Sites past the listed ones.
     """

    rule_id: UUID
    name: str
    delivered: int
    pending: int
    failed: int
    not_sent: int
    hosts: list[str]
    hosts_not_listed: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        rule_id = str(self.rule_id)

        name = self.name

        delivered = self.delivered

        pending = self.pending

        failed = self.failed

        not_sent = self.not_sent

        hosts = self.hosts



        hosts_not_listed = self.hosts_not_listed


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "rule_id": rule_id,
            "name": name,
            "delivered": delivered,
            "pending": pending,
            "failed": failed,
            "not_sent": not_sent,
            "hosts": hosts,
            "hosts_not_listed": hosts_not_listed,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        rule_id = UUID(d.pop("rule_id"))




        name = d.pop("name")

        delivered = d.pop("delivered")

        pending = d.pop("pending")

        failed = d.pop("failed")

        not_sent = d.pop("not_sent")

        hosts = cast(list[str], d.pop("hosts"))


        hosts_not_listed = d.pop("hosts_not_listed")

        email_detail_rule_deliveries_type_0_rules_item = cls(
            rule_id=rule_id,
            name=name,
            delivered=delivered,
            pending=pending,
            failed=failed,
            not_sent=not_sent,
            hosts=hosts,
            hosts_not_listed=hosts_not_listed,
        )


        email_detail_rule_deliveries_type_0_rules_item.additional_properties = d
        return email_detail_rule_deliveries_type_0_rules_item

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
