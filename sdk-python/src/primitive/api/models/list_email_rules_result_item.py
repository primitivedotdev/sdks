from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.list_email_rules_result_item_state import ListEmailRulesResultItemState
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="ListEmailRulesResultItem")



@_attrs_define
class ListEmailRulesResultItem:
    """ 
        Attributes:
            id (UUID):
            name (str):
            state (ListEmailRulesResultItemState):
            current_version (int | None):
            author_user_id (UUID):
            is_author (bool): Whether the caller wrote the rule (under their current membership). Only the author edits a
                rule; anyone else who can see it may only disable or delete it, and while it is shared only if they manage
                members.
            created_at (datetime.datetime):
            updated_at (datetime.datetime):
     """

    id: UUID
    name: str
    state: ListEmailRulesResultItemState
    current_version: int | None
    author_user_id: UUID
    is_author: bool
    created_at: datetime.datetime
    updated_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        name = self.name

        state = self.state.value

        current_version: int | None
        current_version = self.current_version

        author_user_id = str(self.author_user_id)

        is_author = self.is_author

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()


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

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        name = d.pop("name")

        state = ListEmailRulesResultItemState(d.pop("state"))




        def _parse_current_version(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        current_version = _parse_current_version(d.pop("current_version"))


        author_user_id = UUID(d.pop("author_user_id"))




        is_author = d.pop("is_author")

        created_at = datetime.datetime.fromisoformat(d.pop("created_at"))




        updated_at = datetime.datetime.fromisoformat(d.pop("updated_at"))




        list_email_rules_result_item = cls(
            id=id,
            name=name,
            state=state,
            current_version=current_version,
            author_user_id=author_user_id,
            is_author=is_author,
            created_at=created_at,
            updated_at=updated_at,
        )


        list_email_rules_result_item.additional_properties = d
        return list_email_rules_result_item

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
