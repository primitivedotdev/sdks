from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.email_rule_covering_me_read_kind import EmailRuleCoveringMeReadKind
from ..models.email_rule_covering_me_read_state import EmailRuleCoveringMeReadState
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.email_rule_coverage import EmailRuleCoverage
  from ..models.email_rule_covering_author import EmailRuleCoveringAuthor
  from ..models.email_rule_covering_me_version import EmailRuleCoveringMeVersion





T = TypeVar("T", bound="EmailRuleCoveringMeRead")



@_attrs_define
class EmailRuleCoveringMeRead:
    """ 
        Attributes:
            id (UUID):
            name (None | str): Null when covers_now is false: its name now may describe something else.
            state (EmailRuleCoveringMeReadState): draft: it decides nothing. observe: it decides and records, and shares
                nothing. active: it decides and, for a grant rule, shares what it matches.
            kind (EmailRuleCoveringMeReadKind): grant: what it matches can be shared. do_not_share: it blocks sharing what
                it matches.
            author (EmailRuleCoveringAuthor):
            is_author (bool): Whether you wrote it.
            covers (EmailRuleCoverage | None): Null when it no longer covers your mailboxes and you see it because it
                decided on your mail.
            current_version (int | None): Null when covers_now is false.
            created_at (datetime.datetime):
            covers_now (bool): Whether it covers one of your own mailboxes now. False for a rule you see only because it
                decided on mail at your own mailbox before.
            current (EmailRuleCoveringMeVersion | None): Its current version: what it asks of each email. When covers_now is
                false, the newest version that decided on your mail instead.
            note (str | Unset): Present when covers_now is false: what is withheld, and why.
     """

    id: UUID
    name: None | str
    state: EmailRuleCoveringMeReadState
    kind: EmailRuleCoveringMeReadKind
    author: EmailRuleCoveringAuthor
    is_author: bool
    covers: EmailRuleCoverage | None
    current_version: int | None
    created_at: datetime.datetime
    covers_now: bool
    current: EmailRuleCoveringMeVersion | None
    note: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_coverage import EmailRuleCoverage # noqa: PLC0415
        from ..models.email_rule_covering_author import EmailRuleCoveringAuthor # noqa: PLC0415
        from ..models.email_rule_covering_me_version import EmailRuleCoveringMeVersion # noqa: PLC0415
        id = str(self.id)

        name: None | str
        name = self.name

        state = self.state.value

        kind = self.kind.value

        author = self.author.to_dict()

        is_author = self.is_author

        covers: dict[str, Any] | None
        if isinstance(self.covers, EmailRuleCoverage):
            covers = self.covers.to_dict()
        else:
            covers = self.covers

        current_version: int | None
        current_version = self.current_version

        created_at = self.created_at.isoformat()

        covers_now = self.covers_now

        current: dict[str, Any] | None
        if isinstance(self.current, EmailRuleCoveringMeVersion):
            current = self.current.to_dict()
        else:
            current = self.current

        note = self.note


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
            "created_at": created_at,
            "covers_now": covers_now,
            "current": current,
        })
        if note is not UNSET:
            field_dict["note"] = note

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_coverage import EmailRuleCoverage # noqa: PLC0415
        from ..models.email_rule_covering_author import EmailRuleCoveringAuthor # noqa: PLC0415
        from ..models.email_rule_covering_me_version import EmailRuleCoveringMeVersion # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        def _parse_name(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        name = _parse_name(d.pop("name"))


        state = EmailRuleCoveringMeReadState(d.pop("state"))




        kind = EmailRuleCoveringMeReadKind(d.pop("kind"))




        author = EmailRuleCoveringAuthor.from_dict(d.pop("author"))




        is_author = d.pop("is_author")

        def _parse_covers(data: object) -> EmailRuleCoverage | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                covers_type_1 = EmailRuleCoverage.from_dict(data)



                return covers_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(EmailRuleCoverage | None, data)

        covers = _parse_covers(d.pop("covers"))


        def _parse_current_version(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        current_version = _parse_current_version(d.pop("current_version"))


        created_at = datetime.datetime.fromisoformat(d.pop("created_at"))




        covers_now = d.pop("covers_now")

        def _parse_current(data: object) -> EmailRuleCoveringMeVersion | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                current_type_1 = EmailRuleCoveringMeVersion.from_dict(data)



                return current_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(EmailRuleCoveringMeVersion | None, data)

        current = _parse_current(d.pop("current"))


        note = d.pop("note", UNSET)

        email_rule_covering_me_read = cls(
            id=id,
            name=name,
            state=state,
            kind=kind,
            author=author,
            is_author=is_author,
            covers=covers,
            current_version=current_version,
            created_at=created_at,
            covers_now=covers_now,
            current=current,
            note=note,
        )


        email_rule_covering_me_read.additional_properties = d
        return email_rule_covering_me_read

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
