from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.get_email_rule_vocabulary_result_tree_version import GetEmailRuleVocabularyResultTreeVersion
from typing import cast

if TYPE_CHECKING:
  from ..models.get_email_rule_vocabulary_result_columns_item import GetEmailRuleVocabularyResultColumnsItem
  from ..models.get_email_rule_vocabulary_result_limits import GetEmailRuleVocabularyResultLimits





T = TypeVar("T", bound="GetEmailRuleVocabularyResult")



@_attrs_define
class GetEmailRuleVocabularyResult:
    """ 
        Attributes:
            version (str):
            tree_version (GetEmailRuleVocabularyResultTreeVersion):
            columns (list[GetEmailRuleVocabularyResultColumnsItem]):
            limits (GetEmailRuleVocabularyResultLimits): The most nesting levels (a condition is one), conditions, list
                values, characters in a text value and questions; a trimmed question's length bounds; and the most bytes the
                tree takes as stored JSON.
     """

    version: str
    tree_version: GetEmailRuleVocabularyResultTreeVersion
    columns: list[GetEmailRuleVocabularyResultColumnsItem]
    limits: GetEmailRuleVocabularyResultLimits
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.get_email_rule_vocabulary_result_columns_item import GetEmailRuleVocabularyResultColumnsItem # noqa: PLC0415
        from ..models.get_email_rule_vocabulary_result_limits import GetEmailRuleVocabularyResultLimits # noqa: PLC0415
        version = self.version

        tree_version = self.tree_version.value

        columns = []
        for columns_item_data in self.columns:
            columns_item = columns_item_data.to_dict()
            columns.append(columns_item)



        limits = self.limits.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "version": version,
            "tree_version": tree_version,
            "columns": columns,
            "limits": limits,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.get_email_rule_vocabulary_result_columns_item import GetEmailRuleVocabularyResultColumnsItem # noqa: PLC0415
        from ..models.get_email_rule_vocabulary_result_limits import GetEmailRuleVocabularyResultLimits # noqa: PLC0415
        d = dict(src_dict)
        version = d.pop("version")

        tree_version = GetEmailRuleVocabularyResultTreeVersion(d.pop("tree_version"))




        columns = []
        _columns = d.pop("columns")
        for columns_item_data in (_columns):
            columns_item = GetEmailRuleVocabularyResultColumnsItem.from_dict(columns_item_data)



            columns.append(columns_item)


        limits = GetEmailRuleVocabularyResultLimits.from_dict(d.pop("limits"))




        get_email_rule_vocabulary_result = cls(
            version=version,
            tree_version=tree_version,
            columns=columns,
            limits=limits,
        )


        get_email_rule_vocabulary_result.additional_properties = d
        return get_email_rule_vocabulary_result

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
