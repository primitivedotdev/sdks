from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.get_email_rule_result_evaluation_scope import GetEmailRuleResultEvaluationScope
from ..models.get_email_rule_result_kind import GetEmailRuleResultKind
from ..models.get_email_rule_result_state import GetEmailRuleResultState
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.email_rule_author import EmailRuleAuthor
  from ..models.email_rule_scope_names import EmailRuleScopeNames
  from ..models.email_rule_version import EmailRuleVersion
  from ..models.get_email_rule_result_expectations import GetEmailRuleResultExpectations





T = TypeVar("T", bound="GetEmailRuleResult")



@_attrs_define
class GetEmailRuleResult:
    """ 
        Attributes:
            id (UUID):
            name (str):
            state (GetEmailRuleResultState):
            current_version (int | None):
            author_user_id (UUID):
            is_author (bool): Whether you are its author, in your current membership. Only its author edits it; others who
                see it may only disable or delete it (while shared, only if they manage members).
            created_at (datetime.datetime):
            updated_at (datetime.datetime):
            current (EmailRuleVersion | None): Its current version: its text (english, tree, explanation, assumptions,
                warnings) and who compiled it. current_version is its number. GET /email-rules lists rules without it.
            kind (GetEmailRuleResultKind | Unset): grant: what it matches can be shared. do_not_share: it blocks sharing
                what it matches. Optional only for an older core-api: every answer carries it.
            evaluation_scope (GetEmailRuleResultEvaluationScope | Unset): Whose mail it runs over, as stored (GET /email-
                rules/{id}/scope: what that is now).
            scope_selection (EmailRuleScopeNames | None | Unset): What a selected rule names; null for any other scope.
            revision (int | Unset): Moves on by one with every update. Send it as if_revision.
            author (EmailRuleAuthor | Unset):
            expectations (GetEmailRuleResultExpectations | Unset): Its saved expectations, each list by email id.
     """

    id: UUID
    name: str
    state: GetEmailRuleResultState
    current_version: int | None
    author_user_id: UUID
    is_author: bool
    created_at: datetime.datetime
    updated_at: datetime.datetime
    current: EmailRuleVersion | None
    kind: GetEmailRuleResultKind | Unset = UNSET
    evaluation_scope: GetEmailRuleResultEvaluationScope | Unset = UNSET
    scope_selection: EmailRuleScopeNames | None | Unset = UNSET
    revision: int | Unset = UNSET
    author: EmailRuleAuthor | Unset = UNSET
    expectations: GetEmailRuleResultExpectations | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_author import EmailRuleAuthor # noqa: PLC0415
        from ..models.email_rule_scope_names import EmailRuleScopeNames # noqa: PLC0415
        from ..models.email_rule_version import EmailRuleVersion # noqa: PLC0415
        from ..models.get_email_rule_result_expectations import GetEmailRuleResultExpectations # noqa: PLC0415
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

        revision = self.revision

        author: dict[str, Any] | Unset = UNSET
        if not isinstance(self.author, Unset):
            author = self.author.to_dict()

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
        if revision is not UNSET:
            field_dict["revision"] = revision
        if author is not UNSET:
            field_dict["author"] = author
        if expectations is not UNSET:
            field_dict["expectations"] = expectations

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_author import EmailRuleAuthor # noqa: PLC0415
        from ..models.email_rule_scope_names import EmailRuleScopeNames # noqa: PLC0415
        from ..models.email_rule_version import EmailRuleVersion # noqa: PLC0415
        from ..models.get_email_rule_result_expectations import GetEmailRuleResultExpectations # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        name = d.pop("name")

        state = GetEmailRuleResultState(d.pop("state"))




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
        kind: GetEmailRuleResultKind | Unset
        if isinstance(_kind,  Unset):
            kind = UNSET
        else:
            kind = GetEmailRuleResultKind(_kind)




        _evaluation_scope = d.pop("evaluation_scope", UNSET)
        evaluation_scope: GetEmailRuleResultEvaluationScope | Unset
        if isinstance(_evaluation_scope,  Unset):
            evaluation_scope = UNSET
        else:
            evaluation_scope = GetEmailRuleResultEvaluationScope(_evaluation_scope)




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


        revision = d.pop("revision", UNSET)

        _author = d.pop("author", UNSET)
        author: EmailRuleAuthor | Unset
        if isinstance(_author,  Unset):
            author = UNSET
        else:
            author = EmailRuleAuthor.from_dict(_author)




        _expectations = d.pop("expectations", UNSET)
        expectations: GetEmailRuleResultExpectations | Unset
        if isinstance(_expectations,  Unset):
            expectations = UNSET
        else:
            expectations = GetEmailRuleResultExpectations.from_dict(_expectations)




        get_email_rule_result = cls(
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
            revision=revision,
            author=author,
            expectations=expectations,
        )


        get_email_rule_result.additional_properties = d
        return get_email_rule_result

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
