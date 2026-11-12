from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.compile_email_rule_result_sql import CompileEmailRuleResultSql
  from ..models.email_rule_breadth import EmailRuleBreadth
  from ..models.email_rule_tree import EmailRuleTree





T = TypeVar("T", bound="CompileEmailRuleResult")



@_attrs_define
class CompileEmailRuleResult:
    """ 
        Attributes:
            tree (EmailRuleTree):
            explanation (str): What the rule matches, in plain English: only which emails, not what it grants or shares,
                which follows from its state, its scope and the keys, webhooks and people it reaches. The compiler leaves out a
                sentence that plainly says what the rule hands over.
            assumptions (list[str]): Readings the compiler chose where the description was open to more than one. Whenever
                the rule holds a condition, question or confidence bar that no words of the description call for, this list also
                has a line starting "Added without the description asking for it:" naming it (several share a line when there
                are many).
            warnings (list[str]): Parts of the description the column contract cannot express, and how the rule handles
                them. It also has notes on reading automated, from_mailing_list or sender_relationship, a sender address the
                description does not give, and a grant worded as a prohibition. When the rule has no questions and its
                conditions hold for all of the caller's recent classified mail (what a test of it covers by default), or for at
                least 90% of at least 20 emails, the first warning says so. That count is not made for a caller whose access
                shows headers only, or who could not run a test of the rule, and may also be skipped when the compile ran long
                or the count fails.
            compiled_by (str): An opaque name for the version of the rule compiler that produced the rule, such as rule-
                compiler-v1. Send it back as compiled_by when you save the rule.
            breadth (EmailRuleBreadth | None | Unset): How many of your recent emails its conditions hold for, counted over
                your own mailboxes whatever scope you save it with, warning or not. Null when not counted in full: a rule with
                questions, headers-only access, no test of it possible as you, or a count that failed or ran out of time. Writes
                ignore it, so a compile answer (without include_sql) can be sent back unchanged.
            sql (CompileEmailRuleResultSql | Unset): Present only when include_sql was true.
     """

    tree: EmailRuleTree
    explanation: str
    assumptions: list[str]
    warnings: list[str]
    compiled_by: str
    breadth: EmailRuleBreadth | None | Unset = UNSET
    sql: CompileEmailRuleResultSql | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.compile_email_rule_result_sql import CompileEmailRuleResultSql # noqa: PLC0415
        from ..models.email_rule_breadth import EmailRuleBreadth # noqa: PLC0415
        from ..models.email_rule_tree import EmailRuleTree # noqa: PLC0415
        tree = self.tree.to_dict()

        explanation = self.explanation

        assumptions = self.assumptions



        warnings = self.warnings



        compiled_by = self.compiled_by

        breadth: dict[str, Any] | None | Unset
        if isinstance(self.breadth, Unset):
            breadth = UNSET
        elif isinstance(self.breadth, EmailRuleBreadth):
            breadth = self.breadth.to_dict()
        else:
            breadth = self.breadth

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
        if breadth is not UNSET:
            field_dict["breadth"] = breadth
        if sql is not UNSET:
            field_dict["sql"] = sql

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.compile_email_rule_result_sql import CompileEmailRuleResultSql # noqa: PLC0415
        from ..models.email_rule_breadth import EmailRuleBreadth # noqa: PLC0415
        from ..models.email_rule_tree import EmailRuleTree # noqa: PLC0415
        d = dict(src_dict)
        tree = EmailRuleTree.from_dict(d.pop("tree"))




        explanation = d.pop("explanation")

        assumptions = cast(list[str], d.pop("assumptions"))


        warnings = cast(list[str], d.pop("warnings"))


        compiled_by = d.pop("compiled_by")

        def _parse_breadth(data: object) -> EmailRuleBreadth | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                breadth_type_1 = EmailRuleBreadth.from_dict(data)



                return breadth_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(EmailRuleBreadth | None | Unset, data)

        breadth = _parse_breadth(d.pop("breadth", UNSET))


        _sql = d.pop("sql", UNSET)
        sql: CompileEmailRuleResultSql | Unset
        if isinstance(_sql,  Unset):
            sql = UNSET
        else:
            sql = CompileEmailRuleResultSql.from_dict(_sql)




        compile_email_rule_result = cls(
            tree=tree,
            explanation=explanation,
            assumptions=assumptions,
            warnings=warnings,
            compiled_by=compiled_by,
            breadth=breadth,
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
