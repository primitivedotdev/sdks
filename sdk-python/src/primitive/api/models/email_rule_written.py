from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.email_rule_written_evaluation_scope import EmailRuleWrittenEvaluationScope
from ..models.email_rule_written_kind import EmailRuleWrittenKind
from ..models.email_rule_written_state import EmailRuleWrittenState
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.email_rule_author import EmailRuleAuthor
  from ..models.email_rule_expectation_sample import EmailRuleExpectationSample
  from ..models.email_rule_scope_names import EmailRuleScopeNames
  from ..models.email_rule_scope_warning import EmailRuleScopeWarning
  from ..models.email_rule_version import EmailRuleVersion
  from ..models.email_rule_written_affects import EmailRuleWrittenAffects
  from ..models.email_rule_written_expectations_check import EmailRuleWrittenExpectationsCheck
  from ..models.email_rule_written_restored_from import EmailRuleWrittenRestoredFrom





T = TypeVar("T", bound="EmailRuleWritten")



@_attrs_define
class EmailRuleWritten:
    """ 
        Attributes:
            id (UUID):
            name (str):
            state (EmailRuleWrittenState):
            current_version (int | None):
            author_user_id (UUID):
            is_author (bool): Whether you are its author, in your current membership. Only its author edits it; others who
                see it may only disable or delete it (while shared, only if they manage members).
            created_at (datetime.datetime):
            updated_at (datetime.datetime):
            current (EmailRuleVersion | None): Its current version: its text (english, tree, explanation, assumptions,
                warnings) and who compiled it. current_version is its number. GET /email-rules lists rules without it.
            kind (EmailRuleWrittenKind | Unset): grant: what it matches can be shared. do_not_share: it blocks sharing what
                it matches. Optional only for an older core-api: every answer carries it.
            protection_note (str | Unset): On a do_not_share rule only: it protects nothing yet (not active), or a
                classifier fact narrows it.
            evaluation_scope (EmailRuleWrittenEvaluationScope | Unset): Whose mail it runs over, as stored (GET /email-
                rules/{id}/scope: what that is now).
            scope_selection (EmailRuleScopeNames | None | Unset): What a selected rule names; null for any other scope.
            revision (int | Unset): Moves on by one with every update. Send it as if_revision.
            author (EmailRuleAuthor | Unset):
            scope_warnings (list[EmailRuleScopeWarning] | Unset): Names in scope_selection that match nothing this
                organization receives mail at (a typo, or an inbox not yet in use). Present only when there are some.
            expectation_samples (list[EmailRuleExpectationSample] | Unset): Its saved made-up emails, when this write set or
                added some.
            expectations_check (EmailRuleWrittenExpectationsCheck | Unset): After a write that saved a version or changed
                its expectations or made-up emails, if it has some: the emails by id judged on that version from stored
                classifications without asking its questions, and any made-up emails listed as undecided. Undecided: one that
                needs answers not yet kept for that version, is unclassified, skipped or not reached, or that its author does
                not read. Absent when it could not be judged (the rule changed again, its author cannot be resolved, your access
                shows headers only, it could not finish in time, or the check failed), and after a write that changed only made-
                up emails on a rule with emails by id. Test by rule_id for the rest. With if_expectations_pass, the judgment
                made before the save, which passed.
            restored_from (EmailRuleWrittenRestoredFrom | Unset): When this write saved an earlier version again
                (restore_version): which, and that the scope is not part of a version.
            affects (EmailRuleWrittenAffects | Unset): After an update that saved a version: API keys listing the rule, the
                webhooks they own, and shares this write ended. The rule keeps its state. Absent if not read.
     """

    id: UUID
    name: str
    state: EmailRuleWrittenState
    current_version: int | None
    author_user_id: UUID
    is_author: bool
    created_at: datetime.datetime
    updated_at: datetime.datetime
    current: EmailRuleVersion | None
    kind: EmailRuleWrittenKind | Unset = UNSET
    protection_note: str | Unset = UNSET
    evaluation_scope: EmailRuleWrittenEvaluationScope | Unset = UNSET
    scope_selection: EmailRuleScopeNames | None | Unset = UNSET
    revision: int | Unset = UNSET
    author: EmailRuleAuthor | Unset = UNSET
    scope_warnings: list[EmailRuleScopeWarning] | Unset = UNSET
    expectation_samples: list[EmailRuleExpectationSample] | Unset = UNSET
    expectations_check: EmailRuleWrittenExpectationsCheck | Unset = UNSET
    restored_from: EmailRuleWrittenRestoredFrom | Unset = UNSET
    affects: EmailRuleWrittenAffects | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_author import EmailRuleAuthor # noqa: PLC0415
        from ..models.email_rule_expectation_sample import EmailRuleExpectationSample # noqa: PLC0415
        from ..models.email_rule_scope_names import EmailRuleScopeNames # noqa: PLC0415
        from ..models.email_rule_scope_warning import EmailRuleScopeWarning # noqa: PLC0415
        from ..models.email_rule_version import EmailRuleVersion # noqa: PLC0415
        from ..models.email_rule_written_affects import EmailRuleWrittenAffects # noqa: PLC0415
        from ..models.email_rule_written_expectations_check import EmailRuleWrittenExpectationsCheck # noqa: PLC0415
        from ..models.email_rule_written_restored_from import EmailRuleWrittenRestoredFrom # noqa: PLC0415
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

        scope_warnings: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.scope_warnings, Unset):
            scope_warnings = []
            for scope_warnings_item_data in self.scope_warnings:
                scope_warnings_item = scope_warnings_item_data.to_dict()
                scope_warnings.append(scope_warnings_item)



        expectation_samples: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.expectation_samples, Unset):
            expectation_samples = []
            for expectation_samples_item_data in self.expectation_samples:
                expectation_samples_item = expectation_samples_item_data.to_dict()
                expectation_samples.append(expectation_samples_item)



        expectations_check: dict[str, Any] | Unset = UNSET
        if not isinstance(self.expectations_check, Unset):
            expectations_check = self.expectations_check.to_dict()

        restored_from: dict[str, Any] | Unset = UNSET
        if not isinstance(self.restored_from, Unset):
            restored_from = self.restored_from.to_dict()

        affects: dict[str, Any] | Unset = UNSET
        if not isinstance(self.affects, Unset):
            affects = self.affects.to_dict()


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
        if scope_warnings is not UNSET:
            field_dict["scope_warnings"] = scope_warnings
        if expectation_samples is not UNSET:
            field_dict["expectation_samples"] = expectation_samples
        if expectations_check is not UNSET:
            field_dict["expectations_check"] = expectations_check
        if restored_from is not UNSET:
            field_dict["restored_from"] = restored_from
        if affects is not UNSET:
            field_dict["affects"] = affects

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_author import EmailRuleAuthor # noqa: PLC0415
        from ..models.email_rule_expectation_sample import EmailRuleExpectationSample # noqa: PLC0415
        from ..models.email_rule_scope_names import EmailRuleScopeNames # noqa: PLC0415
        from ..models.email_rule_scope_warning import EmailRuleScopeWarning # noqa: PLC0415
        from ..models.email_rule_version import EmailRuleVersion # noqa: PLC0415
        from ..models.email_rule_written_affects import EmailRuleWrittenAffects # noqa: PLC0415
        from ..models.email_rule_written_expectations_check import EmailRuleWrittenExpectationsCheck # noqa: PLC0415
        from ..models.email_rule_written_restored_from import EmailRuleWrittenRestoredFrom # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        name = d.pop("name")

        state = EmailRuleWrittenState(d.pop("state"))




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
        kind: EmailRuleWrittenKind | Unset
        if isinstance(_kind,  Unset):
            kind = UNSET
        else:
            kind = EmailRuleWrittenKind(_kind)




        protection_note = d.pop("protection_note", UNSET)

        _evaluation_scope = d.pop("evaluation_scope", UNSET)
        evaluation_scope: EmailRuleWrittenEvaluationScope | Unset
        if isinstance(_evaluation_scope,  Unset):
            evaluation_scope = UNSET
        else:
            evaluation_scope = EmailRuleWrittenEvaluationScope(_evaluation_scope)




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




        _scope_warnings = d.pop("scope_warnings", UNSET)
        scope_warnings: list[EmailRuleScopeWarning] | Unset = UNSET
        if _scope_warnings is not UNSET:
            scope_warnings = []
            for scope_warnings_item_data in _scope_warnings:
                scope_warnings_item = EmailRuleScopeWarning.from_dict(scope_warnings_item_data)



                scope_warnings.append(scope_warnings_item)


        _expectation_samples = d.pop("expectation_samples", UNSET)
        expectation_samples: list[EmailRuleExpectationSample] | Unset = UNSET
        if _expectation_samples is not UNSET:
            expectation_samples = []
            for expectation_samples_item_data in _expectation_samples:
                expectation_samples_item = EmailRuleExpectationSample.from_dict(expectation_samples_item_data)



                expectation_samples.append(expectation_samples_item)


        _expectations_check = d.pop("expectations_check", UNSET)
        expectations_check: EmailRuleWrittenExpectationsCheck | Unset
        if isinstance(_expectations_check,  Unset):
            expectations_check = UNSET
        else:
            expectations_check = EmailRuleWrittenExpectationsCheck.from_dict(_expectations_check)




        _restored_from = d.pop("restored_from", UNSET)
        restored_from: EmailRuleWrittenRestoredFrom | Unset
        if isinstance(_restored_from,  Unset):
            restored_from = UNSET
        else:
            restored_from = EmailRuleWrittenRestoredFrom.from_dict(_restored_from)




        _affects = d.pop("affects", UNSET)
        affects: EmailRuleWrittenAffects | Unset
        if isinstance(_affects,  Unset):
            affects = UNSET
        else:
            affects = EmailRuleWrittenAffects.from_dict(_affects)




        email_rule_written = cls(
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
            protection_note=protection_note,
            evaluation_scope=evaluation_scope,
            scope_selection=scope_selection,
            revision=revision,
            author=author,
            scope_warnings=scope_warnings,
            expectation_samples=expectation_samples,
            expectations_check=expectations_check,
            restored_from=restored_from,
            affects=affects,
        )


        email_rule_written.additional_properties = d
        return email_rule_written

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
