from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.email_rule_sql import EmailRuleSql
  from ..models.email_rule_tree import EmailRuleTree





T = TypeVar("T", bound="CompiledEmailRule")



@_attrs_define
class CompiledEmailRule:
    """ 
        Attributes:
            tree (EmailRuleTree): A compiled rule. The server checks it against the column contract on save.
            explanation (str): What the rule matches.
            assumptions (list[str]): Readings chosen where the description was ambiguous.
            warnings (list[str]): What the column contract cannot express, and how the rule handles it.
            compiled_by (str): Opaque compiler version. Compare only for equality.
            sql (EmailRuleSql | Unset): The SQL a rule renders to.
     """

    tree: EmailRuleTree
    explanation: str
    assumptions: list[str]
    warnings: list[str]
    compiled_by: str
    sql: EmailRuleSql | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_sql import EmailRuleSql # noqa: PLC0415
        from ..models.email_rule_tree import EmailRuleTree # noqa: PLC0415
        tree = self.tree.to_dict()

        explanation = self.explanation

        assumptions = self.assumptions



        warnings = self.warnings



        compiled_by = self.compiled_by

        sql: dict[str, Any] | Unset = UNSET
        if not isinstance(self.sql, Unset):
            sql = self.sql.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "tree": tree,
            "explanation": explanation,
            "assumptions": assumptions,
            "warnings": warnings,
            "compiled_by": compiled_by,
        })
        if sql is not UNSET:
            field_dict["sql"] = sql

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_sql import EmailRuleSql # noqa: PLC0415
        from ..models.email_rule_tree import EmailRuleTree # noqa: PLC0415
        d = dict(src_dict)
        tree = EmailRuleTree.from_dict(d.pop("tree"))




        explanation = d.pop("explanation")

        assumptions = cast(list[str], d.pop("assumptions"))


        warnings = cast(list[str], d.pop("warnings"))


        compiled_by = d.pop("compiled_by")

        _sql = d.pop("sql", UNSET)
        sql: EmailRuleSql | Unset
        if isinstance(_sql,  Unset):
            sql = UNSET
        else:
            sql = EmailRuleSql.from_dict(_sql)




        compiled_email_rule = cls(
            tree=tree,
            explanation=explanation,
            assumptions=assumptions,
            warnings=warnings,
            compiled_by=compiled_by,
            sql=sql,
        )


        compiled_email_rule.additional_properties = d
        return compiled_email_rule

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
