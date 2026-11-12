from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.list_email_rule_results_result_classification_type_0 import ListEmailRuleResultsResultClassificationType0
  from ..models.list_email_rule_results_result_email import ListEmailRuleResultsResultEmail
  from ..models.list_email_rule_results_result_rules_item import ListEmailRuleResultsResultRulesItem





T = TypeVar("T", bound="ListEmailRuleResultsResult")



@_attrs_define
class ListEmailRuleResultsResult:
    """ 
        Attributes:
            rules (list[ListEmailRuleResultsResultRulesItem]): Rules you can see, and read_only ones: matched first, then
                not matched, then not run; newest first within each.
            hidden (int): Rules that decided on this email that you cannot see.
            email (ListEmailRuleResultsResultEmail | Unset): The email these results are about, so a saved answer says which
                one it was.
            not_listed (int | Unset): Rules you can see past the 50 listed.
            classification (ListEmailRuleResultsResultClassificationType0 | None | Unset): What the classifier read from
                this email (one classification per vocabulary); null when it has none (not classified, or never will be), or
                while the email's content is withheld, discarded or failed to parse.
     """

    rules: list[ListEmailRuleResultsResultRulesItem]
    hidden: int
    email: ListEmailRuleResultsResultEmail | Unset = UNSET
    not_listed: int | Unset = UNSET
    classification: ListEmailRuleResultsResultClassificationType0 | None | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.list_email_rule_results_result_classification_type_0 import ListEmailRuleResultsResultClassificationType0 # noqa: PLC0415
        from ..models.list_email_rule_results_result_email import ListEmailRuleResultsResultEmail # noqa: PLC0415
        from ..models.list_email_rule_results_result_rules_item import ListEmailRuleResultsResultRulesItem # noqa: PLC0415
        rules = []
        for rules_item_data in self.rules:
            rules_item = rules_item_data.to_dict()
            rules.append(rules_item)



        hidden = self.hidden

        email: dict[str, Any] | Unset = UNSET
        if not isinstance(self.email, Unset):
            email = self.email.to_dict()

        not_listed = self.not_listed

        classification: dict[str, Any] | None | Unset
        if isinstance(self.classification, Unset):
            classification = UNSET
        elif isinstance(self.classification, ListEmailRuleResultsResultClassificationType0):
            classification = self.classification.to_dict()
        else:
            classification = self.classification


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "rules": rules,
            "hidden": hidden,
        })
        if email is not UNSET:
            field_dict["email"] = email
        if not_listed is not UNSET:
            field_dict["not_listed"] = not_listed
        if classification is not UNSET:
            field_dict["classification"] = classification

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.list_email_rule_results_result_classification_type_0 import ListEmailRuleResultsResultClassificationType0 # noqa: PLC0415
        from ..models.list_email_rule_results_result_email import ListEmailRuleResultsResultEmail # noqa: PLC0415
        from ..models.list_email_rule_results_result_rules_item import ListEmailRuleResultsResultRulesItem # noqa: PLC0415
        d = dict(src_dict)
        rules = []
        _rules = d.pop("rules")
        for rules_item_data in (_rules):
            rules_item = ListEmailRuleResultsResultRulesItem.from_dict(rules_item_data)



            rules.append(rules_item)


        hidden = d.pop("hidden")

        _email = d.pop("email", UNSET)
        email: ListEmailRuleResultsResultEmail | Unset
        if isinstance(_email,  Unset):
            email = UNSET
        else:
            email = ListEmailRuleResultsResultEmail.from_dict(_email)




        not_listed = d.pop("not_listed", UNSET)

        def _parse_classification(data: object) -> ListEmailRuleResultsResultClassificationType0 | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                classification_type_0 = ListEmailRuleResultsResultClassificationType0.from_dict(data)



                return classification_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(ListEmailRuleResultsResultClassificationType0 | None | Unset, data)

        classification = _parse_classification(d.pop("classification", UNSET))


        list_email_rule_results_result = cls(
            rules=rules,
            hidden=hidden,
            email=email,
            not_listed=not_listed,
            classification=classification,
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
