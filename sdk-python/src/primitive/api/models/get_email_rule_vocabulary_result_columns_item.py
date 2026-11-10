from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.get_email_rule_vocabulary_result_columns_item_source import GetEmailRuleVocabularyResultColumnsItemSource
from ..models.get_email_rule_vocabulary_result_columns_item_type import GetEmailRuleVocabularyResultColumnsItemType
from typing import cast

if TYPE_CHECKING:
  from ..models.get_email_rule_vocabulary_result_columns_item_operators_item import GetEmailRuleVocabularyResultColumnsItemOperatorsItem





T = TypeVar("T", bound="GetEmailRuleVocabularyResultColumnsItem")



@_attrs_define
class GetEmailRuleVocabularyResultColumnsItem:
    """ 
        Attributes:
            name (str):
            type_ (GetEmailRuleVocabularyResultColumnsItemType):
            source (GetEmailRuleVocabularyResultColumnsItemSource): email: from the message itself. fact: from its
                classification.
            description (str):
            operators (list[GetEmailRuleVocabularyResultColumnsItemOperatorsItem]): Each operator allowed, and its value:
                none (no value), text, text_list (a list of texts), number, number_range ([low, high]) or date_time (ISO 8601
                with an offset from -12:00 to +14:00).
            min_confidence (bool): Whether a condition may set min_confidence (0 to 1), though not one under an odd number
                of nots. On a multi column it tests each value the condition names by that value's own confidence: contains its
                value, contains_any at least one value the email has, contains_all every value.
            options (list[str] | Unset): The only values it takes, on a column that has them.
     """

    name: str
    type_: GetEmailRuleVocabularyResultColumnsItemType
    source: GetEmailRuleVocabularyResultColumnsItemSource
    description: str
    operators: list[GetEmailRuleVocabularyResultColumnsItemOperatorsItem]
    min_confidence: bool
    options: list[str] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.get_email_rule_vocabulary_result_columns_item_operators_item import GetEmailRuleVocabularyResultColumnsItemOperatorsItem # noqa: PLC0415
        name = self.name

        type_ = self.type_.value

        source = self.source.value

        description = self.description

        operators = []
        for operators_item_data in self.operators:
            operators_item = operators_item_data.to_dict()
            operators.append(operators_item)



        min_confidence = self.min_confidence

        options: list[str] | Unset = UNSET
        if not isinstance(self.options, Unset):
            options = self.options




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "name": name,
            "type": type_,
            "source": source,
            "description": description,
            "operators": operators,
            "min_confidence": min_confidence,
        })
        if options is not UNSET:
            field_dict["options"] = options

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.get_email_rule_vocabulary_result_columns_item_operators_item import GetEmailRuleVocabularyResultColumnsItemOperatorsItem # noqa: PLC0415
        d = dict(src_dict)
        name = d.pop("name")

        type_ = GetEmailRuleVocabularyResultColumnsItemType(d.pop("type"))




        source = GetEmailRuleVocabularyResultColumnsItemSource(d.pop("source"))




        description = d.pop("description")

        operators = []
        _operators = d.pop("operators")
        for operators_item_data in (_operators):
            operators_item = GetEmailRuleVocabularyResultColumnsItemOperatorsItem.from_dict(operators_item_data)



            operators.append(operators_item)


        min_confidence = d.pop("min_confidence")

        options = cast(list[str], d.pop("options", UNSET))


        get_email_rule_vocabulary_result_columns_item = cls(
            name=name,
            type_=type_,
            source=source,
            description=description,
            operators=operators,
            min_confidence=min_confidence,
            options=options,
        )


        get_email_rule_vocabulary_result_columns_item.additional_properties = d
        return get_email_rule_vocabulary_result_columns_item

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
