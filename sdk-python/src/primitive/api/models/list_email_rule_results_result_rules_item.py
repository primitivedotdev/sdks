from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.list_email_rule_results_result_rules_item_kind import ListEmailRuleResultsResultRulesItemKind
from ..models.list_email_rule_results_result_rules_item_not_run_reason_type_1 import ListEmailRuleResultsResultRulesItemNotRunReasonType1
from ..models.list_email_rule_results_result_rules_item_not_run_reason_type_2_type_1 import ListEmailRuleResultsResultRulesItemNotRunReasonType2Type1
from ..models.list_email_rule_results_result_rules_item_not_run_reason_type_3_type_1 import ListEmailRuleResultsResultRulesItemNotRunReasonType3Type1
from ..models.list_email_rule_results_result_rules_item_state import ListEmailRuleResultsResultRulesItemState
from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.email_rule_covering_author import EmailRuleCoveringAuthor
  from ..models.list_email_rule_results_result_rules_item_decision_type_0 import ListEmailRuleResultsResultRulesItemDecisionType0





T = TypeVar("T", bound="ListEmailRuleResultsResultRulesItem")



@_attrs_define
class ListEmailRuleResultsResultRulesItem:
    """ 
        Attributes:
            id (UUID):
            name (None | str):
            state (ListEmailRuleResultsResultRulesItemState):
            decision (ListEmailRuleResultsResultRulesItemDecisionType0 | None): What the rule most recently decided about
                this email; null when it has not run on it.
            not_run_reason (ListEmailRuleResultsResultRulesItemNotRunReasonType1 |
                ListEmailRuleResultsResultRulesItemNotRunReasonType2Type1 |
                ListEmailRuleResultsResultRulesItemNotRunReasonType3Type1 | None): What is known about a rule with no result on
                this email. draft: the rule is a draft now. created_after_email: the rule was created after the email arrived.
                Null when it has a result, or when nothing is known.
            kind (ListEmailRuleResultsResultRulesItemKind | Unset): grant: the rule shares what it matches. do_not_share:
                the rule blocks sharing of what it matches. While it is active, no rule shares an email it has matched from then
                on; anything shared before, including while it was in observe, stays shared.
            author_left (bool | Unset): On a do-not-share rule whose author is no longer a member of the organization: it
                blocks nothing now, whatever it decided. Absent otherwise.
            read_only (bool | Unset): Another member's rule that decided on your own mail; dashboard and CLI only. name is
                null unless known to cover you.
            author (EmailRuleCoveringAuthor | Unset):
     """

    id: UUID
    name: None | str
    state: ListEmailRuleResultsResultRulesItemState
    decision: ListEmailRuleResultsResultRulesItemDecisionType0 | None
    not_run_reason: ListEmailRuleResultsResultRulesItemNotRunReasonType1 | ListEmailRuleResultsResultRulesItemNotRunReasonType2Type1 | ListEmailRuleResultsResultRulesItemNotRunReasonType3Type1 | None
    kind: ListEmailRuleResultsResultRulesItemKind | Unset = UNSET
    author_left: bool | Unset = UNSET
    read_only: bool | Unset = UNSET
    author: EmailRuleCoveringAuthor | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_covering_author import EmailRuleCoveringAuthor # noqa: PLC0415
        from ..models.list_email_rule_results_result_rules_item_decision_type_0 import ListEmailRuleResultsResultRulesItemDecisionType0 # noqa: PLC0415
        id = str(self.id)

        name: None | str
        name = self.name

        state = self.state.value

        decision: dict[str, Any] | None
        if isinstance(self.decision, ListEmailRuleResultsResultRulesItemDecisionType0):
            decision = self.decision.to_dict()
        else:
            decision = self.decision

        not_run_reason: None | str
        if isinstance(self.not_run_reason, ListEmailRuleResultsResultRulesItemNotRunReasonType1):
            not_run_reason = self.not_run_reason.value
        elif isinstance(self.not_run_reason, ListEmailRuleResultsResultRulesItemNotRunReasonType2Type1):
            not_run_reason = self.not_run_reason.value
        elif isinstance(self.not_run_reason, ListEmailRuleResultsResultRulesItemNotRunReasonType3Type1):
            not_run_reason = self.not_run_reason.value
        else:
            not_run_reason = self.not_run_reason

        kind: str | Unset = UNSET
        if not isinstance(self.kind, Unset):
            kind = self.kind.value


        author_left = self.author_left

        read_only = self.read_only

        author: dict[str, Any] | Unset = UNSET
        if not isinstance(self.author, Unset):
            author = self.author.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "name": name,
            "state": state,
            "decision": decision,
            "not_run_reason": not_run_reason,
        })
        if kind is not UNSET:
            field_dict["kind"] = kind
        if author_left is not UNSET:
            field_dict["author_left"] = author_left
        if read_only is not UNSET:
            field_dict["read_only"] = read_only
        if author is not UNSET:
            field_dict["author"] = author

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_covering_author import EmailRuleCoveringAuthor # noqa: PLC0415
        from ..models.list_email_rule_results_result_rules_item_decision_type_0 import ListEmailRuleResultsResultRulesItemDecisionType0 # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        def _parse_name(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        name = _parse_name(d.pop("name"))


        state = ListEmailRuleResultsResultRulesItemState(d.pop("state"))




        def _parse_decision(data: object) -> ListEmailRuleResultsResultRulesItemDecisionType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                decision_type_0 = ListEmailRuleResultsResultRulesItemDecisionType0.from_dict(data)



                return decision_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(ListEmailRuleResultsResultRulesItemDecisionType0 | None, data)

        decision = _parse_decision(d.pop("decision"))


        def _parse_not_run_reason(data: object) -> ListEmailRuleResultsResultRulesItemNotRunReasonType1 | ListEmailRuleResultsResultRulesItemNotRunReasonType2Type1 | ListEmailRuleResultsResultRulesItemNotRunReasonType3Type1 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                not_run_reason_type_1 = ListEmailRuleResultsResultRulesItemNotRunReasonType1(data)



                return not_run_reason_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                not_run_reason_type_2_type_1 = ListEmailRuleResultsResultRulesItemNotRunReasonType2Type1(data)



                return not_run_reason_type_2_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                not_run_reason_type_3_type_1 = ListEmailRuleResultsResultRulesItemNotRunReasonType3Type1(data)



                return not_run_reason_type_3_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(ListEmailRuleResultsResultRulesItemNotRunReasonType1 | ListEmailRuleResultsResultRulesItemNotRunReasonType2Type1 | ListEmailRuleResultsResultRulesItemNotRunReasonType3Type1 | None, data)

        not_run_reason = _parse_not_run_reason(d.pop("not_run_reason"))


        _kind = d.pop("kind", UNSET)
        kind: ListEmailRuleResultsResultRulesItemKind | Unset
        if isinstance(_kind,  Unset):
            kind = UNSET
        else:
            kind = ListEmailRuleResultsResultRulesItemKind(_kind)




        author_left = d.pop("author_left", UNSET)

        read_only = d.pop("read_only", UNSET)

        _author = d.pop("author", UNSET)
        author: EmailRuleCoveringAuthor | Unset
        if isinstance(_author,  Unset):
            author = UNSET
        else:
            author = EmailRuleCoveringAuthor.from_dict(_author)




        list_email_rule_results_result_rules_item = cls(
            id=id,
            name=name,
            state=state,
            decision=decision,
            not_run_reason=not_run_reason,
            kind=kind,
            author_left=author_left,
            read_only=read_only,
            author=author,
        )


        list_email_rule_results_result_rules_item.additional_properties = d
        return list_email_rule_results_result_rules_item

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
