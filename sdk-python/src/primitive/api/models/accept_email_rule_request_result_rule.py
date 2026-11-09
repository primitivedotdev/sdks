from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.accept_email_rule_request_result_rule_state import AcceptEmailRuleRequestResultRuleState
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.accept_email_rule_request_result_rule_current_type_0 import AcceptEmailRuleRequestResultRuleCurrentType0





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
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.accept_email_rule_request_result_rule_current_type_0 import AcceptEmailRuleRequestResultRuleCurrentType0 # noqa: PLC0415
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

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.accept_email_rule_request_result_rule_current_type_0 import AcceptEmailRuleRequestResultRuleCurrentType0 # noqa: PLC0415
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
