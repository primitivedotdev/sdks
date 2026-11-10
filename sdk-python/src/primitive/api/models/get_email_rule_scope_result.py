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
  from ..models.get_email_rule_scope_result_no_longer_readable import GetEmailRuleScopeResultNoLongerReadable
  from ..models.get_email_rule_scope_result_scope_selection_type_0 import GetEmailRuleScopeResultScopeSelectionType0





T = TypeVar("T", bound="GetEmailRuleScopeResult")



@_attrs_define
class GetEmailRuleScopeResult:
    """ 
        Attributes:
            evaluation_scope (GetEmailRuleScopeResultEvaluationScope): author: all mail its author can read. own_mailboxes:
                mail to their own addresses. selected: what scope_selection names. Never more than the author can read.
            scope_selection (GetEmailRuleScopeResultScopeSelectionType0 | None):
            locked (bool): Shared, so its scope cannot change.
            author_reach (GetEmailRuleScopeResultAuthorReachType1 | GetEmailRuleScopeResultAuthorReachType2Type1 |
                GetEmailRuleScopeResultAuthorReachType3Type1 | None): How much its author can read now; null when it cannot run
                as them.
            no_longer_readable (GetEmailRuleScopeResultNoLongerReadable): What scope_selection names that its author no
                longer reads in full.
            stopped_reason (None | str): Why it cannot run now (a reason as on POST /email-rules/test), or null.
     """

    evaluation_scope: GetEmailRuleScopeResultEvaluationScope
    scope_selection: GetEmailRuleScopeResultScopeSelectionType0 | None
    locked: bool
    author_reach: GetEmailRuleScopeResultAuthorReachType1 | GetEmailRuleScopeResultAuthorReachType2Type1 | GetEmailRuleScopeResultAuthorReachType3Type1 | None
    no_longer_readable: GetEmailRuleScopeResultNoLongerReadable
    stopped_reason: None | str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.get_email_rule_scope_result_no_longer_readable import GetEmailRuleScopeResultNoLongerReadable # noqa: PLC0415
        from ..models.get_email_rule_scope_result_scope_selection_type_0 import GetEmailRuleScopeResultScopeSelectionType0 # noqa: PLC0415
        evaluation_scope = self.evaluation_scope.value

        scope_selection: dict[str, Any] | None
        if isinstance(self.scope_selection, GetEmailRuleScopeResultScopeSelectionType0):
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

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.get_email_rule_scope_result_no_longer_readable import GetEmailRuleScopeResultNoLongerReadable # noqa: PLC0415
        from ..models.get_email_rule_scope_result_scope_selection_type_0 import GetEmailRuleScopeResultScopeSelectionType0 # noqa: PLC0415
        d = dict(src_dict)
        evaluation_scope = GetEmailRuleScopeResultEvaluationScope(d.pop("evaluation_scope"))




        def _parse_scope_selection(data: object) -> GetEmailRuleScopeResultScopeSelectionType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                scope_selection_type_0 = GetEmailRuleScopeResultScopeSelectionType0.from_dict(data)



                return scope_selection_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(GetEmailRuleScopeResultScopeSelectionType0 | None, data)

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


        no_longer_readable = GetEmailRuleScopeResultNoLongerReadable.from_dict(d.pop("no_longer_readable"))




        def _parse_stopped_reason(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        stopped_reason = _parse_stopped_reason(d.pop("stopped_reason"))


        get_email_rule_scope_result = cls(
            evaluation_scope=evaluation_scope,
            scope_selection=scope_selection,
            locked=locked,
            author_reach=author_reach,
            no_longer_readable=no_longer_readable,
            stopped_reason=stopped_reason,
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
