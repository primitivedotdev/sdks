from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.email_rule_covering_me_kind import EmailRuleCoveringMeKind
from ..models.email_rule_covering_me_state import EmailRuleCoveringMeState
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.email_rule_coverage import EmailRuleCoverage
  from ..models.email_rule_covering_author import EmailRuleCoveringAuthor
  from ..models.email_rule_receivers import EmailRuleReceivers





T = TypeVar("T", bound="EmailRuleCoveringMe")



@_attrs_define
class EmailRuleCoveringMe:
    """ 
        Attributes:
            id (UUID):
            name (str):
            state (EmailRuleCoveringMeState): draft: it decides nothing. observe: it decides and records, and shares
                nothing. active: it decides and, for a grant rule, shares what it matches.
            kind (EmailRuleCoveringMeKind): grant: what it matches can be shared. do_not_share: it blocks sharing what it
                matches.
            author (EmailRuleCoveringAuthor):
            is_author (bool): Whether you wrote it.
            covers (EmailRuleCoverage):
            current_version (int | None):
            receivers (EmailRuleReceivers | None): Null when it could not be read in time, or for a rule shown in draft or
                observe that turned active or was deleted after the page was read; try again.
            receivers_once_active (EmailRuleReceivers | None): For a grant rule in draft or observe: who would receive what
                it matches once it is turned active. None of them receives anything yet. Null for any other rule, and as
                receivers is null.
            created_at (datetime.datetime):
            do_not_share_note (str | Unset): On a grant rule: that the active do-not-share rules over an email run first,
                keeping from it what they match and holding back what they cannot decide, which is decided again for up to a day
                and shared only if none of them then matches it.
            english (None | str | Unset): What its author asked for, in their words, at its current version. Null when it
                has no version, was deleted after the page was read, or the words could not be read in time; GET /v1/email-
                rules/covering-me/{id} shows them with its tree.
            explanation (None | str | Unset): What its current version matches, as compiled. Null as english is.
     """

    id: UUID
    name: str
    state: EmailRuleCoveringMeState
    kind: EmailRuleCoveringMeKind
    author: EmailRuleCoveringAuthor
    is_author: bool
    covers: EmailRuleCoverage
    current_version: int | None
    receivers: EmailRuleReceivers | None
    receivers_once_active: EmailRuleReceivers | None
    created_at: datetime.datetime
    do_not_share_note: str | Unset = UNSET
    english: None | str | Unset = UNSET
    explanation: None | str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_coverage import EmailRuleCoverage # noqa: PLC0415
        from ..models.email_rule_covering_author import EmailRuleCoveringAuthor # noqa: PLC0415
        from ..models.email_rule_receivers import EmailRuleReceivers # noqa: PLC0415
        id = str(self.id)

        name = self.name

        state = self.state.value

        kind = self.kind.value

        author = self.author.to_dict()

        is_author = self.is_author

        covers = self.covers.to_dict()

        current_version: int | None
        current_version = self.current_version

        receivers: dict[str, Any] | None
        if isinstance(self.receivers, EmailRuleReceivers):
            receivers = self.receivers.to_dict()
        else:
            receivers = self.receivers

        receivers_once_active: dict[str, Any] | None
        if isinstance(self.receivers_once_active, EmailRuleReceivers):
            receivers_once_active = self.receivers_once_active.to_dict()
        else:
            receivers_once_active = self.receivers_once_active

        created_at = self.created_at.isoformat()

        do_not_share_note = self.do_not_share_note

        english: None | str | Unset
        if isinstance(self.english, Unset):
            english = UNSET
        else:
            english = self.english

        explanation: None | str | Unset
        if isinstance(self.explanation, Unset):
            explanation = UNSET
        else:
            explanation = self.explanation


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "name": name,
            "state": state,
            "kind": kind,
            "author": author,
            "is_author": is_author,
            "covers": covers,
            "current_version": current_version,
            "receivers": receivers,
            "receivers_once_active": receivers_once_active,
            "created_at": created_at,
        })
        if do_not_share_note is not UNSET:
            field_dict["do_not_share_note"] = do_not_share_note
        if english is not UNSET:
            field_dict["english"] = english
        if explanation is not UNSET:
            field_dict["explanation"] = explanation

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_coverage import EmailRuleCoverage # noqa: PLC0415
        from ..models.email_rule_covering_author import EmailRuleCoveringAuthor # noqa: PLC0415
        from ..models.email_rule_receivers import EmailRuleReceivers # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        name = d.pop("name")

        state = EmailRuleCoveringMeState(d.pop("state"))




        kind = EmailRuleCoveringMeKind(d.pop("kind"))




        author = EmailRuleCoveringAuthor.from_dict(d.pop("author"))




        is_author = d.pop("is_author")

        covers = EmailRuleCoverage.from_dict(d.pop("covers"))




        def _parse_current_version(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        current_version = _parse_current_version(d.pop("current_version"))


        def _parse_receivers(data: object) -> EmailRuleReceivers | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                receivers_type_1 = EmailRuleReceivers.from_dict(data)



                return receivers_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(EmailRuleReceivers | None, data)

        receivers = _parse_receivers(d.pop("receivers"))


        def _parse_receivers_once_active(data: object) -> EmailRuleReceivers | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                receivers_once_active_type_1 = EmailRuleReceivers.from_dict(data)



                return receivers_once_active_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(EmailRuleReceivers | None, data)

        receivers_once_active = _parse_receivers_once_active(d.pop("receivers_once_active"))


        created_at = datetime.datetime.fromisoformat(d.pop("created_at"))




        do_not_share_note = d.pop("do_not_share_note", UNSET)

        def _parse_english(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        english = _parse_english(d.pop("english", UNSET))


        def _parse_explanation(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        explanation = _parse_explanation(d.pop("explanation", UNSET))


        email_rule_covering_me = cls(
            id=id,
            name=name,
            state=state,
            kind=kind,
            author=author,
            is_author=is_author,
            covers=covers,
            current_version=current_version,
            receivers=receivers,
            receivers_once_active=receivers_once_active,
            created_at=created_at,
            do_not_share_note=do_not_share_note,
            english=english,
            explanation=explanation,
        )


        email_rule_covering_me.additional_properties = d
        return email_rule_covering_me

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
