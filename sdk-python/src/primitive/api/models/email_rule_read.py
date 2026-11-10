from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.email_rule_read_evaluation_scope import EmailRuleReadEvaluationScope
from ..models.email_rule_read_kind import EmailRuleReadKind
from ..models.email_rule_read_state import EmailRuleReadState
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.email_rule_read_expectations import EmailRuleReadExpectations
  from ..models.email_rule_scope_names import EmailRuleScopeNames
  from ..models.email_rule_version import EmailRuleVersion





T = TypeVar("T", bound="EmailRuleRead")



@_attrs_define
class EmailRuleRead:
    """ 
        Attributes:
            id (UUID):
            name (str):
            state (EmailRuleReadState):
            current_version (int | None):
            author_user_id (UUID):
            is_author (bool): Whether you are its author, in your current membership. Only its author edits it; others who
                see it may only disable or delete it (while shared, only if they manage members).
            created_at (datetime.datetime):
            updated_at (datetime.datetime):
            current (EmailRuleVersion | None):
            kind (EmailRuleReadKind | Unset): grant: what it matches can be shared. do_not_share: it blocks sharing what it
                matches. Optional only for an older core-api: every answer carries it.
            evaluation_scope (EmailRuleReadEvaluationScope | Unset): Whose mail it runs over, as stored (GET /email-
                rules/{id}/scope: what that is now).
            scope_selection (EmailRuleScopeNames | None | Unset): What a selected rule names; null for any other scope.
            expectations (EmailRuleReadExpectations | Unset): Its saved expectations, each list by email id.
     """

    id: UUID
    name: str
    state: EmailRuleReadState
    current_version: int | None
    author_user_id: UUID
    is_author: bool
    created_at: datetime.datetime
    updated_at: datetime.datetime
    current: EmailRuleVersion | None
    kind: EmailRuleReadKind | Unset = UNSET
    evaluation_scope: EmailRuleReadEvaluationScope | Unset = UNSET
    scope_selection: EmailRuleScopeNames | None | Unset = UNSET
    expectations: EmailRuleReadExpectations | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_read_expectations import EmailRuleReadExpectations # noqa: PLC0415
        from ..models.email_rule_scope_names import EmailRuleScopeNames # noqa: PLC0415
        from ..models.email_rule_version import EmailRuleVersion # noqa: PLC0415
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
        if isinstance(self.current, EmailRuleVersion):
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
        elif isinstance(self.scope_selection, EmailRuleScopeNames):
            scope_selection = self.scope_selection.to_dict()
        else:
            scope_selection = self.scope_selection

        expectations: dict[str, Any] | Unset = UNSET
        if not isinstance(self.expectations, Unset):
            expectations = self.expectations.to_dict()


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
        if expectations is not UNSET:
            field_dict["expectations"] = expectations

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_read_expectations import EmailRuleReadExpectations # noqa: PLC0415
        from ..models.email_rule_scope_names import EmailRuleScopeNames # noqa: PLC0415
        from ..models.email_rule_version import EmailRuleVersion # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        name = d.pop("name")

        state = EmailRuleReadState(d.pop("state"))




        def _parse_current_version(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        current_version = _parse_current_version(d.pop("current_version"))


        author_user_id = UUID(d.pop("author_user_id"))




        is_author = d.pop("is_author")

        created_at = datetime.datetime.fromisoformat(d.pop("created_at"))




        updated_at = datetime.datetime.fromisoformat(d.pop("updated_at"))




        def _parse_current(data: object) -> EmailRuleVersion | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                current_type_1 = EmailRuleVersion.from_dict(data)



                return current_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(EmailRuleVersion | None, data)

        current = _parse_current(d.pop("current"))


        _kind = d.pop("kind", UNSET)
        kind: EmailRuleReadKind | Unset
        if isinstance(_kind,  Unset):
            kind = UNSET
        else:
            kind = EmailRuleReadKind(_kind)




        _evaluation_scope = d.pop("evaluation_scope", UNSET)
        evaluation_scope: EmailRuleReadEvaluationScope | Unset
        if isinstance(_evaluation_scope,  Unset):
            evaluation_scope = UNSET
        else:
            evaluation_scope = EmailRuleReadEvaluationScope(_evaluation_scope)




        def _parse_scope_selection(data: object) -> EmailRuleScopeNames | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                scope_selection_type_1 = EmailRuleScopeNames.from_dict(data)



                return scope_selection_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(EmailRuleScopeNames | None | Unset, data)

        scope_selection = _parse_scope_selection(d.pop("scope_selection", UNSET))


        _expectations = d.pop("expectations", UNSET)
        expectations: EmailRuleReadExpectations | Unset
        if isinstance(_expectations,  Unset):
            expectations = UNSET
        else:
            expectations = EmailRuleReadExpectations.from_dict(_expectations)




        email_rule_read = cls(
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
            expectations=expectations,
        )


        email_rule_read.additional_properties = d
        return email_rule_read

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
