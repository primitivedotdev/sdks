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
  from ..models.email_rule_receivers import EmailRuleReceivers
  from ..models.email_rule_scope_names import EmailRuleScopeNames





T = TypeVar("T", bound="EmailRule")



@_attrs_define
class EmailRule:
    """ 
        Attributes:
            id (UUID):
            name (str):
            state (EmailRuleState):
            evaluation_scope (EmailRuleEvaluationScope): Whose mail it runs over, as stored (GET /email-rules/{id}/scope:
                what that is now).
            scope_selection (EmailRuleScopeNames | None): What a selected rule names; null for any other scope.
            current_version (int | None):
            revision (int): Moves on by one with every update. Send it as if_revision.
            author (EmailRuleAuthor):
            is_author (bool): Whether you are its author, in your current membership. Only its author edits it.
            created_at (datetime.datetime):
            updated_at (datetime.datetime):
            kind (EmailRuleKind | Unset): grant: what it matches can be shared. do_not_share: it blocks sharing what it
                matches.
            protection_note (str | Unset): On a do_not_share rule only: it protects nothing yet (not active), a classifier
                fact narrows it, or its several questions are alternatives.
            pending_objections (int | Unset): To its author, on the dashboard or the Primitive CLI, on GET, the list and a
                create: objections to it waiting for their answer (GET /email-rule-objections).
            receivers (EmailRuleReceivers | None | Unset): On the list with all=true only: who receives what it matches now.
                Null when it could not be read in time.
     """

    id: UUID
    name: str
    state: EmailRuleState
    evaluation_scope: EmailRuleEvaluationScope
    scope_selection: EmailRuleScopeNames | None
    current_version: int | None
    revision: int
    author: EmailRuleAuthor
    is_author: bool
    created_at: datetime.datetime
    updated_at: datetime.datetime
    kind: EmailRuleKind | Unset = UNSET
    protection_note: str | Unset = UNSET
    pending_objections: int | Unset = UNSET
    receivers: EmailRuleReceivers | None | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_author import EmailRuleAuthor # noqa: PLC0415
        from ..models.email_rule_receivers import EmailRuleReceivers # noqa: PLC0415
        from ..models.email_rule_scope_names import EmailRuleScopeNames # noqa: PLC0415
        id = str(self.id)

        name = self.name

        state = self.state.value

        evaluation_scope = self.evaluation_scope.value

        scope_selection: dict[str, Any] | None
        if isinstance(self.scope_selection, EmailRuleScopeNames):
            scope_selection = self.scope_selection.to_dict()
        else:
            scope_selection = self.scope_selection

        current_version: int | None
        current_version = self.current_version

        revision = self.revision

        author = self.author.to_dict()

        is_author = self.is_author

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()

        kind: str | Unset = UNSET
        if not isinstance(self.kind, Unset):
            kind = self.kind.value


        protection_note = self.protection_note

        pending_objections = self.pending_objections

        receivers: dict[str, Any] | None | Unset
        if isinstance(self.receivers, Unset):
            receivers = UNSET
        elif isinstance(self.receivers, EmailRuleReceivers):
            receivers = self.receivers.to_dict()
        else:
            receivers = self.receivers


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "name": name,
            "state": state,
            "evaluation_scope": evaluation_scope,
            "scope_selection": scope_selection,
            "current_version": current_version,
            "revision": revision,
            "author": author,
            "is_author": is_author,
            "created_at": created_at,
            "updated_at": updated_at,
        })
        if kind is not UNSET:
            field_dict["kind"] = kind
        if protection_note is not UNSET:
            field_dict["protection_note"] = protection_note
        if pending_objections is not UNSET:
            field_dict["pending_objections"] = pending_objections
        if receivers is not UNSET:
            field_dict["receivers"] = receivers

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_author import EmailRuleAuthor # noqa: PLC0415
        from ..models.email_rule_receivers import EmailRuleReceivers # noqa: PLC0415
        from ..models.email_rule_scope_names import EmailRuleScopeNames # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        name = d.pop("name")

        state = EmailRuleState(d.pop("state"))




        evaluation_scope = EmailRuleEvaluationScope(d.pop("evaluation_scope"))




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


        def _parse_current_version(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        current_version = _parse_current_version(d.pop("current_version"))


        revision = d.pop("revision")

        author = EmailRuleAuthor.from_dict(d.pop("author"))




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

        pending_objections = d.pop("pending_objections", UNSET)

        def _parse_receivers(data: object) -> EmailRuleReceivers | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                receivers_type_1 = EmailRuleReceivers.from_dict(data)



                return receivers_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(EmailRuleReceivers | None | Unset, data)

        receivers = _parse_receivers(d.pop("receivers", UNSET))


        email_rule = cls(
            id=id,
            name=name,
            state=state,
            evaluation_scope=evaluation_scope,
            scope_selection=scope_selection,
            current_version=current_version,
            revision=revision,
            author=author,
            is_author=is_author,
            created_at=created_at,
            updated_at=updated_at,
            kind=kind,
            protection_note=protection_note,
            pending_objections=pending_objections,
            receivers=receivers,
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
