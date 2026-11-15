from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.compile_email_rule_result_sql import CompileEmailRuleResultSql
  from ..models.email_rule_body import EmailRuleBody





T = TypeVar("T", bound="CompileEmailRuleResult")



@_attrs_define
class CompileEmailRuleResult:
    """ 
        Attributes:
            rule (EmailRuleBody):
            explanation (str): What the rule matches: Primitive's reading of its tree, as every read of the rule gives it.
            assumptions (list[str]): Readings the compiler chose where the description was open to more than one. Whenever
                the rule holds a condition, question or confidence bar that no words of the description call for, this list also
                has a line starting "Added without the description asking for it:" naming it (several share a line when there
                are many).
            warnings (list[str]): Parts of the description the column contract cannot express, how the rule handles them,
                and the compiler's own notes on the rule (the Email Rules docs list them).
            sql (CompileEmailRuleResultSql | Unset): Present only when include_sql was true.
     """

    rule: EmailRuleBody
    explanation: str
    assumptions: list[str]
    warnings: list[str]
    sql: CompileEmailRuleResultSql | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.compile_email_rule_result_sql import CompileEmailRuleResultSql # noqa: PLC0415
        from ..models.email_rule_body import EmailRuleBody # noqa: PLC0415
        rule = self.rule.to_dict()

        explanation = self.explanation

        assumptions = self.assumptions



        warnings = self.warnings



        sql: dict[str, Any] | Unset = UNSET
        if not isinstance(self.sql, Unset):
            sql = self.sql.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "rule": rule,
            "explanation": explanation,
            "assumptions": assumptions,
            "warnings": warnings,
        })
        if sql is not UNSET:
            field_dict["sql"] = sql

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.compile_email_rule_result_sql import CompileEmailRuleResultSql # noqa: PLC0415
        from ..models.email_rule_body import EmailRuleBody # noqa: PLC0415
        d = dict(src_dict)
        rule = EmailRuleBody.from_dict(d.pop("rule"))




        explanation = d.pop("explanation")

        assumptions = cast(list[str], d.pop("assumptions"))


        warnings = cast(list[str], d.pop("warnings"))


        _sql = d.pop("sql", UNSET)
        sql: CompileEmailRuleResultSql | Unset
        if isinstance(_sql,  Unset):
            sql = UNSET
        else:
            sql = CompileEmailRuleResultSql.from_dict(_sql)




        compile_email_rule_result = cls(
            rule=rule,
            explanation=explanation,
            assumptions=assumptions,
            warnings=warnings,
            sql=sql,
        )


        compile_email_rule_result.additional_properties = d
        return compile_email_rule_result

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
