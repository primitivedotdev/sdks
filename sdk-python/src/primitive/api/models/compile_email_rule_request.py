from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.compile_email_rule_request_kind import CompileEmailRuleRequestKind






T = TypeVar("T", bound="CompileEmailRuleRequest")



@_attrs_define
class CompileEmailRuleRequest:
    """ 
        Attributes:
            english (str): What the rule should match, in plain English.
            kind (CompileEmailRuleRequestKind | Unset): What the rule will be: grant (the default) or do_not_share. A do-
                not-share rule is compiled for recall: conditions only as narrow as the description says, and the judgement of
                what it describes put into questions, since an email it misses can be shared.
            include_sql (bool | Unset): Also return the SQL the rule renders to. Off by default.
     """

    english: str
    kind: CompileEmailRuleRequestKind | Unset = UNSET
    include_sql: bool | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        english = self.english

        kind: str | Unset = UNSET
        if not isinstance(self.kind, Unset):
            kind = self.kind.value


        include_sql = self.include_sql


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "english": english,
        })
        if kind is not UNSET:
            field_dict["kind"] = kind
        if include_sql is not UNSET:
            field_dict["include_sql"] = include_sql

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        english = d.pop("english")

        _kind = d.pop("kind", UNSET)
        kind: CompileEmailRuleRequestKind | Unset
        if isinstance(_kind,  Unset):
            kind = UNSET
        else:
            kind = CompileEmailRuleRequestKind(_kind)




        include_sql = d.pop("include_sql", UNSET)

        compile_email_rule_request = cls(
            english=english,
            kind=kind,
            include_sql=include_sql,
        )

        return compile_email_rule_request

