from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.email_rule_row_attachment import EmailRuleRowAttachment
  from ..models.list_email_rule_results_result_rules_item import ListEmailRuleResultsResultRulesItem





T = TypeVar("T", bound="ListEmailRuleResultsResult")



@_attrs_define
class ListEmailRuleResultsResult:
    """ 
        Attributes:
            attachments (list[EmailRuleRowAttachment] | None): The email's named attachments, in order, at most 10
                (attachment_count counts them all), each with its one-line description where one was read: the email every rule
                here decided on, so given once rather than on each rule. An empty list means it has none. Null when its content
                cannot be read (withheld, not parsed yet, failed to parse, or discarded).
            attachment_count (int | None): How many named attachments the email has in all, listed or not. Null exactly when
                attachments is.
            rules (list[ListEmailRuleResultsResultRulesItem]): Rules you can see, and read_only ones: matched first, then
                not matched, then not run; newest first within each.
            hidden (int): Rules that decided on this email that you cannot see.
            not_listed (int): Rules you can see past the 50 listed.
     """

    attachments: list[EmailRuleRowAttachment] | None
    attachment_count: int | None
    rules: list[ListEmailRuleResultsResultRulesItem]
    hidden: int
    not_listed: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_row_attachment import EmailRuleRowAttachment # noqa: PLC0415
        from ..models.list_email_rule_results_result_rules_item import ListEmailRuleResultsResultRulesItem # noqa: PLC0415
        attachments: list[dict[str, Any]] | None
        if isinstance(self.attachments, list):
            attachments = []
            for attachments_type_0_item_data in self.attachments:
                attachments_type_0_item = attachments_type_0_item_data.to_dict()
                attachments.append(attachments_type_0_item)


        else:
            attachments = self.attachments

        attachment_count: int | None
        attachment_count = self.attachment_count

        rules = []
        for rules_item_data in self.rules:
            rules_item = rules_item_data.to_dict()
            rules.append(rules_item)



        hidden = self.hidden

        not_listed = self.not_listed


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "attachments": attachments,
            "attachment_count": attachment_count,
            "rules": rules,
            "hidden": hidden,
            "not_listed": not_listed,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_row_attachment import EmailRuleRowAttachment # noqa: PLC0415
        from ..models.list_email_rule_results_result_rules_item import ListEmailRuleResultsResultRulesItem # noqa: PLC0415
        d = dict(src_dict)
        def _parse_attachments(data: object) -> list[EmailRuleRowAttachment] | None:
            if data is None:
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                attachments_type_0 = []
                _attachments_type_0 = data
                for attachments_type_0_item_data in (_attachments_type_0):
                    attachments_type_0_item = EmailRuleRowAttachment.from_dict(attachments_type_0_item_data)



                    attachments_type_0.append(attachments_type_0_item)

                return attachments_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[EmailRuleRowAttachment] | None, data)

        attachments = _parse_attachments(d.pop("attachments"))


        def _parse_attachment_count(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        attachment_count = _parse_attachment_count(d.pop("attachment_count"))


        rules = []
        _rules = d.pop("rules")
        for rules_item_data in (_rules):
            rules_item = ListEmailRuleResultsResultRulesItem.from_dict(rules_item_data)



            rules.append(rules_item)


        hidden = d.pop("hidden")

        not_listed = d.pop("not_listed")

        list_email_rule_results_result = cls(
            attachments=attachments,
            attachment_count=attachment_count,
            rules=rules,
            hidden=hidden,
            not_listed=not_listed,
        )


        list_email_rule_results_result.additional_properties = d
        return list_email_rule_results_result

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
