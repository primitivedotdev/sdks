from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.create_email_rule_result_evaluation_scope import CreateEmailRuleResultEvaluationScope
from ..models.create_email_rule_result_kind import CreateEmailRuleResultKind
from ..models.create_email_rule_result_state import CreateEmailRuleResultState
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.create_email_rule_result_affects import CreateEmailRuleResultAffects
  from ..models.create_email_rule_result_expectations import CreateEmailRuleResultExpectations
  from ..models.email_rule_author import EmailRuleAuthor
  from ..models.email_rule_expectation_sample import EmailRuleExpectationSample
  from ..models.email_rule_expectations_check import EmailRuleExpectationsCheck
  from ..models.email_rule_receivers import EmailRuleReceivers
  from ..models.email_rule_scope_names import EmailRuleScopeNames
  from ..models.email_rule_scope_warning import EmailRuleScopeWarning
  from ..models.email_rule_version import EmailRuleVersion





T = TypeVar("T", bound="CreateEmailRuleResult")



@_attrs_define
class CreateEmailRuleResult:
    """ 
        Attributes:
            id (UUID):
            name (str):
            state (CreateEmailRuleResultState):
            evaluation_scope (CreateEmailRuleResultEvaluationScope): Whose mail it runs over, as stored (GET /email-
                rules/{id}/scope: what that is now).
            scope_selection (EmailRuleScopeNames | None): What a selected rule names; null for any other scope.
            current_version (int | None):
            revision (int): Moves on by one with every update. Send it as if_revision.
            author (EmailRuleAuthor):
            is_author (bool): Whether you are its author, in your current membership. Only its author edits it.
            created_at (datetime.datetime):
            updated_at (datetime.datetime):
            current (EmailRuleVersion | None): Its current version: english and tree, with Primitive's reading and notes.
                current_version is its number. GET /email-rules lists rules without it.
            kind (CreateEmailRuleResultKind | Unset): grant: what it matches can be shared. do_not_share: it blocks sharing
                what it matches.
            protection_note (str | Unset): On a do_not_share rule only: it protects nothing yet (not active), a classifier
                fact narrows it, or its several questions are alternatives.
            pending_objections (int | Unset): To its author, on the dashboard or the Primitive CLI, on GET, the list and a
                create: objections to it waiting for their answer (GET /email-rule-objections).
            receivers (EmailRuleReceivers | None | Unset): On the list with all=true only: who receives what it matches now.
                Null when it could not be read in time.
            scope_warnings (list[EmailRuleScopeWarning] | Unset): Names in scope_selection that match nothing this
                organization receives mail at (a typo, or an inbox not yet in use). Present only when there are some.
            expectations (CreateEmailRuleResultExpectations | Unset): Its saved expectations, each list by email id, as
                stored: on every create, and on an update that set or removed them.
            expectation_samples (list[EmailRuleExpectationSample] | Unset): Its saved made-up emails, when this write set or
                added some.
            expectations_check (EmailRuleExpectationsCheck | Unset):
            affects (CreateEmailRuleResultAffects | Unset): After an update that saved a version, or turned a grant rule
                active: your own keys and webhooks that receive what it grants from now on, counted as receivers counts them,
                and how many live shares it has. Nothing about a colleague it is shared with is counted. All zero for a rule
                that is not an active grant rule. Absent after any other write, and if not read.
     """

    id: UUID
    name: str
    state: CreateEmailRuleResultState
    evaluation_scope: CreateEmailRuleResultEvaluationScope
    scope_selection: EmailRuleScopeNames | None
    current_version: int | None
    revision: int
    author: EmailRuleAuthor
    is_author: bool
    created_at: datetime.datetime
    updated_at: datetime.datetime
    current: EmailRuleVersion | None
    kind: CreateEmailRuleResultKind | Unset = UNSET
    protection_note: str | Unset = UNSET
    pending_objections: int | Unset = UNSET
    receivers: EmailRuleReceivers | None | Unset = UNSET
    scope_warnings: list[EmailRuleScopeWarning] | Unset = UNSET
    expectations: CreateEmailRuleResultExpectations | Unset = UNSET
    expectation_samples: list[EmailRuleExpectationSample] | Unset = UNSET
    expectations_check: EmailRuleExpectationsCheck | Unset = UNSET
    affects: CreateEmailRuleResultAffects | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.create_email_rule_result_affects import CreateEmailRuleResultAffects # noqa: PLC0415
        from ..models.create_email_rule_result_expectations import CreateEmailRuleResultExpectations # noqa: PLC0415
        from ..models.email_rule_author import EmailRuleAuthor # noqa: PLC0415
        from ..models.email_rule_expectation_sample import EmailRuleExpectationSample # noqa: PLC0415
        from ..models.email_rule_expectations_check import EmailRuleExpectationsCheck # noqa: PLC0415
        from ..models.email_rule_receivers import EmailRuleReceivers # noqa: PLC0415
        from ..models.email_rule_scope_names import EmailRuleScopeNames # noqa: PLC0415
        from ..models.email_rule_scope_warning import EmailRuleScopeWarning # noqa: PLC0415
        from ..models.email_rule_version import EmailRuleVersion # noqa: PLC0415
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

        current: dict[str, Any] | None
        if isinstance(self.current, EmailRuleVersion):
            current = self.current.to_dict()
        else:
            current = self.current

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

        scope_warnings: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.scope_warnings, Unset):
            scope_warnings = []
            for scope_warnings_item_data in self.scope_warnings:
                scope_warnings_item = scope_warnings_item_data.to_dict()
                scope_warnings.append(scope_warnings_item)



        expectations: dict[str, Any] | Unset = UNSET
        if not isinstance(self.expectations, Unset):
            expectations = self.expectations.to_dict()

        expectation_samples: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.expectation_samples, Unset):
            expectation_samples = []
            for expectation_samples_item_data in self.expectation_samples:
                expectation_samples_item = expectation_samples_item_data.to_dict()
                expectation_samples.append(expectation_samples_item)



        expectations_check: dict[str, Any] | Unset = UNSET
        if not isinstance(self.expectations_check, Unset):
            expectations_check = self.expectations_check.to_dict()

        affects: dict[str, Any] | Unset = UNSET
        if not isinstance(self.affects, Unset):
            affects = self.affects.to_dict()


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
            "current": current,
        })
        if kind is not UNSET:
            field_dict["kind"] = kind
        if protection_note is not UNSET:
            field_dict["protection_note"] = protection_note
        if pending_objections is not UNSET:
            field_dict["pending_objections"] = pending_objections
        if receivers is not UNSET:
            field_dict["receivers"] = receivers
        if scope_warnings is not UNSET:
            field_dict["scope_warnings"] = scope_warnings
        if expectations is not UNSET:
            field_dict["expectations"] = expectations
        if expectation_samples is not UNSET:
            field_dict["expectation_samples"] = expectation_samples
        if expectations_check is not UNSET:
            field_dict["expectations_check"] = expectations_check
        if affects is not UNSET:
            field_dict["affects"] = affects

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.create_email_rule_result_affects import CreateEmailRuleResultAffects # noqa: PLC0415
        from ..models.create_email_rule_result_expectations import CreateEmailRuleResultExpectations # noqa: PLC0415
        from ..models.email_rule_author import EmailRuleAuthor # noqa: PLC0415
        from ..models.email_rule_expectation_sample import EmailRuleExpectationSample # noqa: PLC0415
        from ..models.email_rule_expectations_check import EmailRuleExpectationsCheck # noqa: PLC0415
        from ..models.email_rule_receivers import EmailRuleReceivers # noqa: PLC0415
        from ..models.email_rule_scope_names import EmailRuleScopeNames # noqa: PLC0415
        from ..models.email_rule_scope_warning import EmailRuleScopeWarning # noqa: PLC0415
        from ..models.email_rule_version import EmailRuleVersion # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        name = d.pop("name")

        state = CreateEmailRuleResultState(d.pop("state"))




        evaluation_scope = CreateEmailRuleResultEvaluationScope(d.pop("evaluation_scope"))




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
        kind: CreateEmailRuleResultKind | Unset
        if isinstance(_kind,  Unset):
            kind = UNSET
        else:
            kind = CreateEmailRuleResultKind(_kind)




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


        _scope_warnings = d.pop("scope_warnings", UNSET)
        scope_warnings: list[EmailRuleScopeWarning] | Unset = UNSET
        if _scope_warnings is not UNSET:
            scope_warnings = []
            for scope_warnings_item_data in _scope_warnings:
                scope_warnings_item = EmailRuleScopeWarning.from_dict(scope_warnings_item_data)



                scope_warnings.append(scope_warnings_item)


        _expectations = d.pop("expectations", UNSET)
        expectations: CreateEmailRuleResultExpectations | Unset
        if isinstance(_expectations,  Unset):
            expectations = UNSET
        else:
            expectations = CreateEmailRuleResultExpectations.from_dict(_expectations)




        _expectation_samples = d.pop("expectation_samples", UNSET)
        expectation_samples: list[EmailRuleExpectationSample] | Unset = UNSET
        if _expectation_samples is not UNSET:
            expectation_samples = []
            for expectation_samples_item_data in _expectation_samples:
                expectation_samples_item = EmailRuleExpectationSample.from_dict(expectation_samples_item_data)



                expectation_samples.append(expectation_samples_item)


        _expectations_check = d.pop("expectations_check", UNSET)
        expectations_check: EmailRuleExpectationsCheck | Unset
        if isinstance(_expectations_check,  Unset):
            expectations_check = UNSET
        else:
            expectations_check = EmailRuleExpectationsCheck.from_dict(_expectations_check)




        _affects = d.pop("affects", UNSET)
        affects: CreateEmailRuleResultAffects | Unset
        if isinstance(_affects,  Unset):
            affects = UNSET
        else:
            affects = CreateEmailRuleResultAffects.from_dict(_affects)




        create_email_rule_result = cls(
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
            current=current,
            kind=kind,
            protection_note=protection_note,
            pending_objections=pending_objections,
            receivers=receivers,
            scope_warnings=scope_warnings,
            expectations=expectations,
            expectation_samples=expectation_samples,
            expectations_check=expectations_check,
            affects=affects,
        )


        create_email_rule_result.additional_properties = d
        return create_email_rule_result

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
