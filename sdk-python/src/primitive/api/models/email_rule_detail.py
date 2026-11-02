from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.email_rule_version import EmailRuleVersion





T = TypeVar("T", bound="EmailRuleDetail")



@_attrs_define
class EmailRuleDetail:
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
            current (EmailRuleVersion | None): Current version, or null.
     """

    id: UUID
    name: str
    state: str
    current_version: int | None
    author_user_id: UUID
    is_author: bool
    created_at: datetime.datetime
    updated_at: datetime.datetime
    current: EmailRuleVersion | None
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_version import EmailRuleVersion # noqa: PLC0415
        id = str(self.id)

        name = self.name

        state = self.state

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
        from ..models.email_rule_version import EmailRuleVersion # noqa: PLC0415
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


        email_rule_detail = cls(
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


        email_rule_detail.additional_properties = d
        return email_rule_detail

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
