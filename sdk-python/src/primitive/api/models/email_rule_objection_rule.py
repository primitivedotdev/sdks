from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID






T = TypeVar("T", bound="EmailRuleObjectionRule")



@_attrs_define
class EmailRuleObjectionRule:
    """ 
        Attributes:
            id (None | UUID): Null once the rule was deleted outright.
            name (str): Its name when the objection was made.
            objected_version (int | None): The rule's version when the objection was made; null when it could not be told
                for an older objection.
            amended_version (int | None): The rule's version when its author answered amended; null otherwise.
     """

    id: None | UUID
    name: str
    objected_version: int | None
    amended_version: int | None
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id: None | str
        if isinstance(self.id, UUID):
            id = str(self.id)
        else:
            id = self.id

        name = self.name

        objected_version: int | None
        objected_version = self.objected_version

        amended_version: int | None
        amended_version = self.amended_version


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "name": name,
            "objected_version": objected_version,
            "amended_version": amended_version,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        def _parse_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                id_type_0 = UUID(data)



                return id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        id = _parse_id(d.pop("id"))


        name = d.pop("name")

        def _parse_objected_version(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        objected_version = _parse_objected_version(d.pop("objected_version"))


        def _parse_amended_version(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        amended_version = _parse_amended_version(d.pop("amended_version"))


        email_rule_objection_rule = cls(
            id=id,
            name=name,
            objected_version=objected_version,
            amended_version=amended_version,
        )


        email_rule_objection_rule.additional_properties = d
        return email_rule_objection_rule

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
