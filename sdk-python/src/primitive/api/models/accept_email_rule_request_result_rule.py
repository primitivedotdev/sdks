from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.accept_email_rule_request_result_rule_evaluation_scope import AcceptEmailRuleRequestResultRuleEvaluationScope
from ..models.accept_email_rule_request_result_rule_kind import AcceptEmailRuleRequestResultRuleKind
from ..models.accept_email_rule_request_result_rule_state import AcceptEmailRuleRequestResultRuleState
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.accept_email_rule_request_result_rule_current_type_0 import AcceptEmailRuleRequestResultRuleCurrentType0
  from ..models.accept_email_rule_request_result_rule_scope_selection_type_0 import AcceptEmailRuleRequestResultRuleScopeSelectionType0





T = TypeVar("T", bound="AcceptEmailRuleRequestResultRule")



@_attrs_define
class AcceptEmailRuleRequestResultRule:
    """ 
        Attributes:
            id (UUID):
            name (str):
            state (AcceptEmailRuleRequestResultRuleState):
            current_version (int | None):
            author_user_id (UUID):
            is_author (bool): Whether the caller wrote the rule (under their current membership). Only the author edits a
                rule; anyone else who can see it may only disable or delete it, and while it is shared only if they manage
                members.
            created_at (datetime.datetime):
            updated_at (datetime.datetime):
            current (AcceptEmailRuleRequestResultRuleCurrentType0 | None):
            kind (AcceptEmailRuleRequestResultRuleKind | Unset): do_not_share: the rule blocks sharing of what it matches.
                Absent (or grant) on a rule that shares what it matches.
            evaluation_scope (AcceptEmailRuleRequestResultRuleEvaluationScope | Unset): Whose mail the rule runs over, as
                stored; GET /email-rules/{id}/scope says what that comes to now.
            scope_selection (AcceptEmailRuleRequestResultRuleScopeSelectionType0 | None | Unset): What a selected rule
                names; null for any other scope.
     """

    id: UUID
    name: str
    state: AcceptEmailRuleRequestResultRuleState
    current_version: int | None
    author_user_id: UUID
    is_author: bool
    created_at: datetime.datetime
    updated_at: datetime.datetime
    current: AcceptEmailRuleRequestResultRuleCurrentType0 | None
    kind: AcceptEmailRuleRequestResultRuleKind | Unset = UNSET
    evaluation_scope: AcceptEmailRuleRequestResultRuleEvaluationScope | Unset = UNSET
    scope_selection: AcceptEmailRuleRequestResultRuleScopeSelectionType0 | None | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.accept_email_rule_request_result_rule_current_type_0 import AcceptEmailRuleRequestResultRuleCurrentType0 # noqa: PLC0415
        from ..models.accept_email_rule_request_result_rule_scope_selection_type_0 import AcceptEmailRuleRequestResultRuleScopeSelectionType0 # noqa: PLC0415
        id = str(self.id)

        name = self.name

        state = self.state.value

        current_version: int | None
        current_version = self.current_version

        author_user_id = str(self.author_user_id)

        is_author = self.is_author

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()

        current: dict[str, Any] | None
        if isinstance(self.current, AcceptEmailRuleRequestResultRuleCurrentType0):
            current = self.current.to_dict()
        else:
            current = self.current

        kind: str | Unset = UNSET
        if not isinstance(self.kind, Unset):
            kind = self.kind.value


        evaluation_scope: str | Unset = UNSET
        if not isinstance(self.evaluation_scope, Unset):
            evaluation_scope = self.evaluation_scope.value


        scope_selection: dict[str, Any] | None | Unset
        if isinstance(self.scope_selection, Unset):
            scope_selection = UNSET
        elif isinstance(self.scope_selection, AcceptEmailRuleRequestResultRuleScopeSelectionType0):
            scope_selection = self.scope_selection.to_dict()
        else:
            scope_selection = self.scope_selection


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "name": name,
            "state": state,
            "current_version": current_version,
            "author_user_id": author_user_id,
            "is_author": is_author,
            "created_at": created_at,
            "updated_at": updated_at,
            "current": current,
        })
        if kind is not UNSET:
            field_dict["kind"] = kind
        if evaluation_scope is not UNSET:
            field_dict["evaluation_scope"] = evaluation_scope
        if scope_selection is not UNSET:
            field_dict["scope_selection"] = scope_selection

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.accept_email_rule_request_result_rule_current_type_0 import AcceptEmailRuleRequestResultRuleCurrentType0 # noqa: PLC0415
        from ..models.accept_email_rule_request_result_rule_scope_selection_type_0 import AcceptEmailRuleRequestResultRuleScopeSelectionType0 # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        name = d.pop("name")

        state = AcceptEmailRuleRequestResultRuleState(d.pop("state"))




        def _parse_current_version(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        current_version = _parse_current_version(d.pop("current_version"))


        author_user_id = UUID(d.pop("author_user_id"))




        is_author = d.pop("is_author")

        created_at = datetime.datetime.fromisoformat(d.pop("created_at"))




        updated_at = datetime.datetime.fromisoformat(d.pop("updated_at"))




        def _parse_current(data: object) -> AcceptEmailRuleRequestResultRuleCurrentType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                current_type_0 = AcceptEmailRuleRequestResultRuleCurrentType0.from_dict(data)



                return current_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(AcceptEmailRuleRequestResultRuleCurrentType0 | None, data)

        current = _parse_current(d.pop("current"))


        _kind = d.pop("kind", UNSET)
        kind: AcceptEmailRuleRequestResultRuleKind | Unset
        if isinstance(_kind,  Unset):
            kind = UNSET
        else:
            kind = AcceptEmailRuleRequestResultRuleKind(_kind)




        _evaluation_scope = d.pop("evaluation_scope", UNSET)
        evaluation_scope: AcceptEmailRuleRequestResultRuleEvaluationScope | Unset
        if isinstance(_evaluation_scope,  Unset):
            evaluation_scope = UNSET
        else:
            evaluation_scope = AcceptEmailRuleRequestResultRuleEvaluationScope(_evaluation_scope)




        def _parse_scope_selection(data: object) -> AcceptEmailRuleRequestResultRuleScopeSelectionType0 | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                scope_selection_type_0 = AcceptEmailRuleRequestResultRuleScopeSelectionType0.from_dict(data)



                return scope_selection_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(AcceptEmailRuleRequestResultRuleScopeSelectionType0 | None | Unset, data)

        scope_selection = _parse_scope_selection(d.pop("scope_selection", UNSET))


        accept_email_rule_request_result_rule = cls(
            id=id,
            name=name,
            state=state,
            current_version=current_version,
            author_user_id=author_user_id,
            is_author=is_author,
            created_at=created_at,
            updated_at=updated_at,
            current=current,
            kind=kind,
            evaluation_scope=evaluation_scope,
            scope_selection=scope_selection,
        )


        accept_email_rule_request_result_rule.additional_properties = d
        return accept_email_rule_request_result_rule

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
