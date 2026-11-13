from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID






T = TypeVar("T", bound="CreateEmailRuleResultExpectations")



@_attrs_define
class CreateEmailRuleResultExpectations:
    """ Its saved expectations, each list by email id, as stored: on every create, and on an update that set or removed
    them.

        Attributes:
            match (list[UUID]):
            no_match (list[UUID]):
     """

    match: list[UUID]
    no_match: list[UUID]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        match = []
        for match_item_data in self.match:
            match_item = str(match_item_data)
            match.append(match_item)



        no_match = []
        for no_match_item_data in self.no_match:
            no_match_item = str(no_match_item_data)
            no_match.append(no_match_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "match": match,
            "no_match": no_match,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        match = []
        _match = d.pop("match")
        for match_item_data in (_match):
            match_item = UUID(match_item_data)



            match.append(match_item)


        no_match = []
        _no_match = d.pop("no_match")
        for no_match_item_data in (_no_match):
            no_match_item = UUID(no_match_item_data)



            no_match.append(no_match_item)


        create_email_rule_result_expectations = cls(
            match=match,
            no_match=no_match,
        )


        create_email_rule_result_expectations.additional_properties = d
        return create_email_rule_result_expectations

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
