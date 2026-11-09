from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.update_email_rule_result_current_type_0_sql import UpdateEmailRuleResultCurrentType0Sql
  from ..models.update_email_rule_result_current_type_0_tree import UpdateEmailRuleResultCurrentType0Tree





T = TypeVar("T", bound="UpdateEmailRuleResultCurrentType0")



@_attrs_define
class UpdateEmailRuleResultCurrentType0:
    """ 
        Attributes:
            version (int):
            english (str):
            tree (UpdateEmailRuleResultCurrentType0Tree):
            explanation (str):
            assumptions (list[str]):
            warnings (list[str]):
            compiled_by (str): Who produced the tree, as the caller stated it when saving (not verified), for example rule-
                compiler-v1 or member.
            vocabulary (str):
            created_at (datetime.datetime):
            sql (UpdateEmailRuleResultCurrentType0Sql | Unset): Present only when include_sql was true.
     """

    version: int
    english: str
    tree: UpdateEmailRuleResultCurrentType0Tree
    explanation: str
    assumptions: list[str]
    warnings: list[str]
    compiled_by: str
    vocabulary: str
    created_at: datetime.datetime
    sql: UpdateEmailRuleResultCurrentType0Sql | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.update_email_rule_result_current_type_0_sql import UpdateEmailRuleResultCurrentType0Sql # noqa: PLC0415
        from ..models.update_email_rule_result_current_type_0_tree import UpdateEmailRuleResultCurrentType0Tree # noqa: PLC0415
        version = self.version

        english = self.english

        tree = self.tree.to_dict()

        explanation = self.explanation

        assumptions = self.assumptions



        warnings = self.warnings



        compiled_by = self.compiled_by

        vocabulary = self.vocabulary

        created_at = self.created_at.isoformat()

        sql: dict[str, Any] | Unset = UNSET
        if not isinstance(self.sql, Unset):
            sql = self.sql.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "version": version,
            "english": english,
            "tree": tree,
            "explanation": explanation,
            "assumptions": assumptions,
            "warnings": warnings,
            "compiled_by": compiled_by,
            "vocabulary": vocabulary,
            "created_at": created_at,
        })
        if sql is not UNSET:
            field_dict["sql"] = sql

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.update_email_rule_result_current_type_0_sql import UpdateEmailRuleResultCurrentType0Sql # noqa: PLC0415
        from ..models.update_email_rule_result_current_type_0_tree import UpdateEmailRuleResultCurrentType0Tree # noqa: PLC0415
        d = dict(src_dict)
        version = d.pop("version")

        english = d.pop("english")

        tree = UpdateEmailRuleResultCurrentType0Tree.from_dict(d.pop("tree"))




        explanation = d.pop("explanation")

        assumptions = cast(list[str], d.pop("assumptions"))


        warnings = cast(list[str], d.pop("warnings"))


        compiled_by = d.pop("compiled_by")

        vocabulary = d.pop("vocabulary")

        created_at = datetime.datetime.fromisoformat(d.pop("created_at"))




        _sql = d.pop("sql", UNSET)
        sql: UpdateEmailRuleResultCurrentType0Sql | Unset
        if isinstance(_sql,  Unset):
            sql = UNSET
        else:
            sql = UpdateEmailRuleResultCurrentType0Sql.from_dict(_sql)




        update_email_rule_result_current_type_0 = cls(
            version=version,
            english=english,
            tree=tree,
            explanation=explanation,
            assumptions=assumptions,
            warnings=warnings,
            compiled_by=compiled_by,
            vocabulary=vocabulary,
            created_at=created_at,
            sql=sql,
        )


        update_email_rule_result_current_type_0.additional_properties = d
        return update_email_rule_result_current_type_0

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
