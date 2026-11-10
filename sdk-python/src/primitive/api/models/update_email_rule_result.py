from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.update_email_rule_result_kind import UpdateEmailRuleResultKind
from ..models.update_email_rule_result_state import UpdateEmailRuleResultState
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.update_email_rule_result_current_type_0 import UpdateEmailRuleResultCurrentType0





T = TypeVar("T", bound="UpdateEmailRuleResult")



@_attrs_define
class UpdateEmailRuleResult:
    """ 
        Attributes:
            id (UUID):
            name (str):
            state (UpdateEmailRuleResultState):
            current_version (int | None):
            author_user_id (UUID):
            is_author (bool): Whether the caller wrote the rule (under their current membership). Only the author edits a
                rule; anyone else who can see it may only disable or delete it, and while it is shared only if they manage
                members.
            created_at (datetime.datetime):
            updated_at (datetime.datetime):
            current (None | UpdateEmailRuleResultCurrentType0):
            kind (UpdateEmailRuleResultKind | Unset): do_not_share: the rule blocks sharing of what it matches. Absent (or
                grant) on a rule that shares what it matches.
     """

    id: UUID
    name: str
    state: UpdateEmailRuleResultState
    current_version: int | None
    author_user_id: UUID
    is_author: bool
    created_at: datetime.datetime
    updated_at: datetime.datetime
    current: None | UpdateEmailRuleResultCurrentType0
    kind: UpdateEmailRuleResultKind | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.update_email_rule_result_current_type_0 import UpdateEmailRuleResultCurrentType0 # noqa: PLC0415
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
        if isinstance(self.current, UpdateEmailRuleResultCurrentType0):
            current = self.current.to_dict()
        else:
            current = self.current

        kind: str | Unset = UNSET
        if not isinstance(self.kind, Unset):
            kind = self.kind.value



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

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.update_email_rule_result_current_type_0 import UpdateEmailRuleResultCurrentType0 # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        name = d.pop("name")

        state = UpdateEmailRuleResultState(d.pop("state"))




        def _parse_current_version(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        current_version = _parse_current_version(d.pop("current_version"))


        author_user_id = UUID(d.pop("author_user_id"))




        is_author = d.pop("is_author")

        created_at = datetime.datetime.fromisoformat(d.pop("created_at"))




        updated_at = datetime.datetime.fromisoformat(d.pop("updated_at"))




        def _parse_current(data: object) -> None | UpdateEmailRuleResultCurrentType0:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                current_type_0 = UpdateEmailRuleResultCurrentType0.from_dict(data)



                return current_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UpdateEmailRuleResultCurrentType0, data)

        current = _parse_current(d.pop("current"))


        _kind = d.pop("kind", UNSET)
        kind: UpdateEmailRuleResultKind | Unset
        if isinstance(_kind,  Unset):
            kind = UNSET
        else:
            kind = UpdateEmailRuleResultKind(_kind)




        update_email_rule_result = cls(
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
        )


        update_email_rule_result.additional_properties = d
        return update_email_rule_result

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
