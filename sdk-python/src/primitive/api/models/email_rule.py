from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.email_rule_evaluation_scope import EmailRuleEvaluationScope
from ..models.email_rule_kind import EmailRuleKind
from ..models.email_rule_state import EmailRuleState
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.email_rule_author import EmailRuleAuthor
  from ..models.email_rule_scope_names import EmailRuleScopeNames





T = TypeVar("T", bound="EmailRule")



@_attrs_define
class EmailRule:
    """ 
        Attributes:
            id (UUID):
            name (str):
            state (EmailRuleState):
            current_version (int | None):
            author_user_id (UUID):
            is_author (bool): Whether you are its author, in your current membership. Only its author edits it.
            created_at (datetime.datetime):
            updated_at (datetime.datetime):
            kind (EmailRuleKind | Unset): grant: what it matches can be shared. do_not_share: it blocks sharing what it
                matches.
            protection_note (str | Unset): On a do_not_share rule only: it protects nothing yet (not active), a classifier
                fact narrows it, or its several questions are alternatives.
            evaluation_scope (EmailRuleEvaluationScope | Unset): Whose mail it runs over, as stored (GET /email-
                rules/{id}/scope: what that is now).
            scope_selection (EmailRuleScopeNames | None | Unset): What a selected rule names; null for any other scope.
            revision (int | Unset): Moves on by one with every update. Send it as if_revision.
            author (EmailRuleAuthor | Unset):
     """

    id: UUID
    name: str
    state: EmailRuleState
    current_version: int | None
    author_user_id: UUID
    is_author: bool
    created_at: datetime.datetime
    updated_at: datetime.datetime
    kind: EmailRuleKind | Unset = UNSET
    protection_note: str | Unset = UNSET
    evaluation_scope: EmailRuleEvaluationScope | Unset = UNSET
    scope_selection: EmailRuleScopeNames | None | Unset = UNSET
    revision: int | Unset = UNSET
    author: EmailRuleAuthor | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_author import EmailRuleAuthor # noqa: PLC0415
        from ..models.email_rule_scope_names import EmailRuleScopeNames # noqa: PLC0415
        id = str(self.id)

        name = self.name

        state = self.state.value

        current_version: int | None
        current_version = self.current_version

        author_user_id = str(self.author_user_id)

        is_author = self.is_author

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()

        kind: str | Unset = UNSET
        if not isinstance(self.kind, Unset):
            kind = self.kind.value


        protection_note = self.protection_note

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
        })
        if kind is not UNSET:
            field_dict["kind"] = kind
        if protection_note is not UNSET:
            field_dict["protection_note"] = protection_note
        if evaluation_scope is not UNSET:
            field_dict["evaluation_scope"] = evaluation_scope
        if scope_selection is not UNSET:
            field_dict["scope_selection"] = scope_selection
        if revision is not UNSET:
            field_dict["revision"] = revision
        if author is not UNSET:
            field_dict["author"] = author

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_author import EmailRuleAuthor # noqa: PLC0415
        from ..models.email_rule_scope_names import EmailRuleScopeNames # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        name = d.pop("name")

        state = EmailRuleState(d.pop("state"))




        def _parse_current_version(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        current_version = _parse_current_version(d.pop("current_version"))


        author_user_id = UUID(d.pop("author_user_id"))




        is_author = d.pop("is_author")

        created_at = datetime.datetime.fromisoformat(d.pop("created_at"))




        updated_at = datetime.datetime.fromisoformat(d.pop("updated_at"))




        _kind = d.pop("kind", UNSET)
        kind: EmailRuleKind | Unset
        if isinstance(_kind,  Unset):
            kind = UNSET
        else:
            kind = EmailRuleKind(_kind)




        protection_note = d.pop("protection_note", UNSET)

        _evaluation_scope = d.pop("evaluation_scope", UNSET)
        evaluation_scope: EmailRuleEvaluationScope | Unset
        if isinstance(_evaluation_scope,  Unset):
            evaluation_scope = UNSET
        else:
            evaluation_scope = EmailRuleEvaluationScope(_evaluation_scope)




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




        email_rule = cls(
            id=id,
            name=name,
            state=state,
            current_version=current_version,
            author_user_id=author_user_id,
            is_author=is_author,
            created_at=created_at,
            updated_at=updated_at,
            kind=kind,
            protection_note=protection_note,
            evaluation_scope=evaluation_scope,
            scope_selection=scope_selection,
            revision=revision,
            author=author,
        )


        email_rule.additional_properties = d
        return email_rule

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
