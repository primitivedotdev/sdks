from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.contact_policy_rule_input import ContactPolicyRuleInput





T = TypeVar("T", bound="PutAgentContactPolicyCreate")



@_attrs_define
class PutAgentContactPolicyCreate:
    """ 
        Attributes:
            rules (list[ContactPolicyRuleInput]):
            allow_contact_requests (bool | None):
            if_absent (bool):
     """

    rules: list[ContactPolicyRuleInput]
    allow_contact_requests: bool | None
    if_absent: bool





    def to_dict(self) -> dict[str, Any]:
        from ..models.contact_policy_rule_input import ContactPolicyRuleInput # noqa: PLC0415
        rules = []
        for rules_item_data in self.rules:
            rules_item = rules_item_data.to_dict()
            rules.append(rules_item)



        allow_contact_requests: bool | None
        allow_contact_requests = self.allow_contact_requests

        if_absent = self.if_absent


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "rules": rules,
            "allow_contact_requests": allow_contact_requests,
            "if_absent": if_absent,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.contact_policy_rule_input import ContactPolicyRuleInput # noqa: PLC0415
        d = dict(src_dict)
        rules = []
        _rules = d.pop("rules")
        for rules_item_data in (_rules):
            rules_item = ContactPolicyRuleInput.from_dict(rules_item_data)



            rules.append(rules_item)


        def _parse_allow_contact_requests(data: object) -> bool | None:
            if data is None:
                return data
            return cast(bool | None, data)

        allow_contact_requests = _parse_allow_contact_requests(d.pop("allow_contact_requests"))


        if_absent = d.pop("if_absent")

        put_agent_contact_policy_create = cls(
            rules=rules,
            allow_contact_requests=allow_contact_requests,
            if_absent=if_absent,
        )

        return put_agent_contact_policy_create

