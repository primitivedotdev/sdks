from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="CompileEmailRuleRequest")



@_attrs_define
class CompileEmailRuleRequest:
    """ 
        Attributes:
            english (str): What the rule should match, in plain English.
            include_sql (bool | Unset): Also return the SQL the rule renders to. Off by default.
     """

    english: str
    include_sql: bool | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        english = self.english

        include_sql = self.include_sql


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "english": english,
        })
        if include_sql is not UNSET:
            field_dict["include_sql"] = include_sql

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        english = d.pop("english")

        include_sql = d.pop("include_sql", UNSET)

        compile_email_rule_request = cls(
            english=english,
            include_sql=include_sql,
        )

        return compile_email_rule_request

