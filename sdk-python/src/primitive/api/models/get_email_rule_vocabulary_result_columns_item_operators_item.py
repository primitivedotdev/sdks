from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.get_email_rule_vocabulary_result_columns_item_operators_item_op import GetEmailRuleVocabularyResultColumnsItemOperatorsItemOp
from ..models.get_email_rule_vocabulary_result_columns_item_operators_item_value import GetEmailRuleVocabularyResultColumnsItemOperatorsItemValue






T = TypeVar("T", bound="GetEmailRuleVocabularyResultColumnsItemOperatorsItem")



@_attrs_define
class GetEmailRuleVocabularyResultColumnsItemOperatorsItem:
    """ 
        Attributes:
            op (GetEmailRuleVocabularyResultColumnsItemOperatorsItemOp):
            value (GetEmailRuleVocabularyResultColumnsItemOperatorsItemValue):
     """

    op: GetEmailRuleVocabularyResultColumnsItemOperatorsItemOp
    value: GetEmailRuleVocabularyResultColumnsItemOperatorsItemValue
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        op = self.op.value

        value = self.value.value


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "op": op,
            "value": value,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        op = GetEmailRuleVocabularyResultColumnsItemOperatorsItemOp(d.pop("op"))




        value = GetEmailRuleVocabularyResultColumnsItemOperatorsItemValue(d.pop("value"))




        get_email_rule_vocabulary_result_columns_item_operators_item = cls(
            op=op,
            value=value,
        )


        get_email_rule_vocabulary_result_columns_item_operators_item.additional_properties = d
        return get_email_rule_vocabulary_result_columns_item_operators_item

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
