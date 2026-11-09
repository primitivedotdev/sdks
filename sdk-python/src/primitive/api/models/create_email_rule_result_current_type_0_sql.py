from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="CreateEmailRuleResultCurrentType0Sql")



@_attrs_define
class CreateEmailRuleResultCurrentType0Sql:
    """ Present only when include_sql was true.

        Attributes:
            expression (str): A parameterized boolean expression over one row per email.
            params (list[Any]): The values bound to $1, $2 and so on.
     """

    expression: str
    params: list[Any]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        expression = self.expression

        params = self.params




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "expression": expression,
            "params": params,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        expression = d.pop("expression")

        params = cast(list[Any], d.pop("params"))


        create_email_rule_result_current_type_0_sql = cls(
            expression=expression,
            params=params,
        )


        create_email_rule_result_current_type_0_sql.additional_properties = d
        return create_email_rule_result_current_type_0_sql

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
