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
            receivers (EmailRuleReceivers | None): Null when it could not be read in time; try again.
            created_at (datetime.datetime):
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
    created_at: datetime.datetime
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

        created_at = self.created_at.isoformat()


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
            "created_at": created_at,
        })

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


        created_at = datetime.datetime.fromisoformat(d.pop("created_at"))




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
            created_at=created_at,
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
