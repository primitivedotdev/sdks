from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="EmailRule")



@_attrs_define
class EmailRule:
    """ 
        Attributes:
            id (UUID): Rule id.
            name (str): Rule name.
            state (str): `draft`, `observe` or `active`. Treat an unfamiliar value as one added after your client was built.
            current_version (int | None): Current version number, or null.
            author_user_id (UUID): The member who wrote the rule.
            is_author (bool): Whether the caller wrote the rule.
            created_at (datetime.datetime):
            updated_at (datetime.datetime):
     """

    id: UUID
    name: str
    state: str
    current_version: int | None
    author_user_id: UUID
    is_author: bool
    created_at: datetime.datetime
    updated_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        name = self.name

        state = self.state

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

        state = d.pop("state")

        def _parse_current_version(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        current_version = _parse_current_version(d.pop("current_version"))


        author_user_id = UUID(d.pop("author_user_id"))




        is_author = d.pop("is_author")

        created_at = datetime.datetime.fromisoformat(d.pop("created_at"))




        updated_at = datetime.datetime.fromisoformat(d.pop("updated_at"))




        email_rule = cls(
            id=id,
            name=name,
            state=state,
            current_version=current_version,
            author_user_id=author_user_id,
            is_author=is_author,
            created_at=created_at,
            updated_at=updated_at,
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
