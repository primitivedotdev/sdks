from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.get_email_rule_scope_result_author_reach_type_1 import GetEmailRuleScopeResultAuthorReachType1
from ..models.get_email_rule_scope_result_author_reach_type_2_type_1 import GetEmailRuleScopeResultAuthorReachType2Type1
from ..models.get_email_rule_scope_result_author_reach_type_3_type_1 import GetEmailRuleScopeResultAuthorReachType3Type1
from ..models.get_email_rule_scope_result_evaluation_scope import GetEmailRuleScopeResultEvaluationScope
from typing import cast

if TYPE_CHECKING:
  from ..models.email_rule_scope_names import EmailRuleScopeNames
  from ..models.email_rule_scope_warning import EmailRuleScopeWarning





T = TypeVar("T", bound="GetEmailRuleScopeResult")



@_attrs_define
class GetEmailRuleScopeResult:
    """ 
        Attributes:
            evaluation_scope (GetEmailRuleScopeResultEvaluationScope): own_mailboxes: mail to its author's own addresses and
                agents (for a rule that shares, those mail:share_own lets them share). author: all its author can read, inboxes
                added later included. selected: what scope_selection names.
            scope_selection (EmailRuleScopeNames | None):
            locked (bool): Shared, so its scope cannot change.
            author_reach (GetEmailRuleScopeResultAuthorReachType1 | GetEmailRuleScopeResultAuthorReachType2Type1 |
                GetEmailRuleScopeResultAuthorReachType3Type1 | None): How much its author can read now; null when it cannot run
                as them.
            no_longer_readable (EmailRuleScopeNames):
            stopped_reason (None | str): Why it cannot run now (a reason as on POST /email-rules/test), or null.
            still_read (list[str] | Unset): Inboxes its author still reads at the domains in no_longer_readable; the rule
                still covers them.
            scope_warnings (list[EmailRuleScopeWarning] | Unset): Names in scope_selection that match nothing this
                organization receives mail at (a typo, or an inbox not yet in use). Present only when there are some.
            reads_nothing (bool | Unset): It can decide no email: it cannot run as its author, or everything its scope names
                is at none of the organization's domains or no longer read. An inbox not in use yet, or a domain not active now,
                does not count.
     """

    evaluation_scope: GetEmailRuleScopeResultEvaluationScope
    scope_selection: EmailRuleScopeNames | None
    locked: bool
    author_reach: GetEmailRuleScopeResultAuthorReachType1 | GetEmailRuleScopeResultAuthorReachType2Type1 | GetEmailRuleScopeResultAuthorReachType3Type1 | None
    no_longer_readable: EmailRuleScopeNames
    stopped_reason: None | str
    still_read: list[str] | Unset = UNSET
    scope_warnings: list[EmailRuleScopeWarning] | Unset = UNSET
    reads_nothing: bool | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_scope_names import EmailRuleScopeNames # noqa: PLC0415
        from ..models.email_rule_scope_warning import EmailRuleScopeWarning # noqa: PLC0415
        evaluation_scope = self.evaluation_scope.value

        scope_selection: dict[str, Any] | None
        if isinstance(self.scope_selection, EmailRuleScopeNames):
            scope_selection = self.scope_selection.to_dict()
        else:
            scope_selection = self.scope_selection

        locked = self.locked

        author_reach: None | str
        if isinstance(self.author_reach, GetEmailRuleScopeResultAuthorReachType1):
            author_reach = self.author_reach.value
        elif isinstance(self.author_reach, GetEmailRuleScopeResultAuthorReachType2Type1):
            author_reach = self.author_reach.value
        elif isinstance(self.author_reach, GetEmailRuleScopeResultAuthorReachType3Type1):
            author_reach = self.author_reach.value
        else:
            author_reach = self.author_reach

        no_longer_readable = self.no_longer_readable.to_dict()

        stopped_reason: None | str
        stopped_reason = self.stopped_reason

        still_read: list[str] | Unset = UNSET
        if not isinstance(self.still_read, Unset):
            still_read = self.still_read



        scope_warnings: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.scope_warnings, Unset):
            scope_warnings = []
            for scope_warnings_item_data in self.scope_warnings:
                scope_warnings_item = scope_warnings_item_data.to_dict()
                scope_warnings.append(scope_warnings_item)



        reads_nothing = self.reads_nothing


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "evaluation_scope": evaluation_scope,
            "scope_selection": scope_selection,
            "locked": locked,
            "author_reach": author_reach,
            "no_longer_readable": no_longer_readable,
            "stopped_reason": stopped_reason,
        })
        if still_read is not UNSET:
            field_dict["still_read"] = still_read
        if scope_warnings is not UNSET:
            field_dict["scope_warnings"] = scope_warnings
        if reads_nothing is not UNSET:
            field_dict["reads_nothing"] = reads_nothing

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_scope_names import EmailRuleScopeNames # noqa: PLC0415
        from ..models.email_rule_scope_warning import EmailRuleScopeWarning # noqa: PLC0415
        d = dict(src_dict)
        evaluation_scope = GetEmailRuleScopeResultEvaluationScope(d.pop("evaluation_scope"))




        def _parse_scope_selection(data: object) -> EmailRuleScopeNames | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                scope_selection_type_1 = EmailRuleScopeNames.from_dict(data)



                return scope_selection_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(EmailRuleScopeNames | None, data)

        scope_selection = _parse_scope_selection(d.pop("scope_selection"))


        locked = d.pop("locked")

        def _parse_author_reach(data: object) -> GetEmailRuleScopeResultAuthorReachType1 | GetEmailRuleScopeResultAuthorReachType2Type1 | GetEmailRuleScopeResultAuthorReachType3Type1 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                author_reach_type_1 = GetEmailRuleScopeResultAuthorReachType1(data)



                return author_reach_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                author_reach_type_2_type_1 = GetEmailRuleScopeResultAuthorReachType2Type1(data)



                return author_reach_type_2_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                author_reach_type_3_type_1 = GetEmailRuleScopeResultAuthorReachType3Type1(data)



                return author_reach_type_3_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(GetEmailRuleScopeResultAuthorReachType1 | GetEmailRuleScopeResultAuthorReachType2Type1 | GetEmailRuleScopeResultAuthorReachType3Type1 | None, data)

        author_reach = _parse_author_reach(d.pop("author_reach"))


        no_longer_readable = EmailRuleScopeNames.from_dict(d.pop("no_longer_readable"))




        def _parse_stopped_reason(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        stopped_reason = _parse_stopped_reason(d.pop("stopped_reason"))


        still_read = cast(list[str], d.pop("still_read", UNSET))


        _scope_warnings = d.pop("scope_warnings", UNSET)
        scope_warnings: list[EmailRuleScopeWarning] | Unset = UNSET
        if _scope_warnings is not UNSET:
            scope_warnings = []
            for scope_warnings_item_data in _scope_warnings:
                scope_warnings_item = EmailRuleScopeWarning.from_dict(scope_warnings_item_data)



                scope_warnings.append(scope_warnings_item)


        reads_nothing = d.pop("reads_nothing", UNSET)

        get_email_rule_scope_result = cls(
            evaluation_scope=evaluation_scope,
            scope_selection=scope_selection,
            locked=locked,
            author_reach=author_reach,
            no_longer_readable=no_longer_readable,
            stopped_reason=stopped_reason,
            still_read=still_read,
            scope_warnings=scope_warnings,
            reads_nothing=reads_nothing,
        )


        get_email_rule_scope_result.additional_properties = d
        return get_email_rule_scope_result

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
