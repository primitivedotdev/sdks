from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.email_rule_receivers_keys_item_owner_kind import EmailRuleReceiversKeysItemOwnerKind
from typing import cast
from uuid import UUID






T = TypeVar("T", bound="EmailRuleReceiversKeysItemOwner")



@_attrs_define
class EmailRuleReceiversKeysItemOwner:
    """ 
        Attributes:
            kind (EmailRuleReceiversKeysItemOwnerKind):
            user_id (UUID | Unset): The member's user id.
            name (None | str | Unset): Their name; null when they have none set.
     """

    kind: EmailRuleReceiversKeysItemOwnerKind
    user_id: UUID | Unset = UNSET
    name: None | str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        kind = self.kind.value

        user_id: str | Unset = UNSET
        if not isinstance(self.user_id, Unset):
            user_id = str(self.user_id)

        name: None | str | Unset
        if isinstance(self.name, Unset):
            name = UNSET
        else:
            name = self.name


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "kind": kind,
        })
        if user_id is not UNSET:
            field_dict["user_id"] = user_id
        if name is not UNSET:
            field_dict["name"] = name

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        kind = EmailRuleReceiversKeysItemOwnerKind(d.pop("kind"))




        _user_id = d.pop("user_id", UNSET)
        user_id: UUID | Unset
        if isinstance(_user_id,  Unset):
            user_id = UNSET
        else:
            user_id = UUID(_user_id)




        def _parse_name(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        name = _parse_name(d.pop("name", UNSET))


        email_rule_receivers_keys_item_owner = cls(
            kind=kind,
            user_id=user_id,
            name=name,
        )


        email_rule_receivers_keys_item_owner.additional_properties = d
        return email_rule_receivers_keys_item_owner

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
