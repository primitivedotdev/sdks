from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="SemanticSearchScoreBreakdown")



@_attrs_define
class SemanticSearchScoreBreakdown:
    """ Additive contributions to `score`. `semantic` and `keyword` are the
    raw signals times the mode's weight (null when not applicable);
    these plus `field_boost` and `recency` sum to `score` before each
    value is independently rounded to 5 decimal places.

        Attributes:
            semantic (float | None):
            keyword (float | None):
            field_boost (float):
            recency (float):
     """

    semantic: float | None
    keyword: float | None
    field_boost: float
    recency: float
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        semantic: float | None
        semantic = self.semantic

        keyword: float | None
        keyword = self.keyword

        field_boost = self.field_boost

        recency = self.recency


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "semantic": semantic,
            "keyword": keyword,
            "field_boost": field_boost,
            "recency": recency,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        def _parse_semantic(data: object) -> float | None:
            if data is None:
                return data
            return cast(float | None, data)

        semantic = _parse_semantic(d.pop("semantic"))


        def _parse_keyword(data: object) -> float | None:
            if data is None:
                return data
            return cast(float | None, data)

        keyword = _parse_keyword(d.pop("keyword"))


        field_boost = d.pop("field_boost")

        recency = d.pop("recency")

        semantic_search_score_breakdown = cls(
            semantic=semantic,
            keyword=keyword,
            field_boost=field_boost,
            recency=recency,
        )


        semantic_search_score_breakdown.additional_properties = d
        return semantic_search_score_breakdown

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
