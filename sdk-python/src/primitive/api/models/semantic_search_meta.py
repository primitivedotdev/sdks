from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.semantic_search_meta_mode import SemanticSearchMetaMode
from typing import cast

if TYPE_CHECKING:
  from ..models.semantic_search_coverage import SemanticSearchCoverage





T = TypeVar("T", bound="SemanticSearchMeta")



@_attrs_define
class SemanticSearchMeta:
    """ 
        Attributes:
            limit (int): Page size used for this request.
            cursor (None | str): Cursor for the next page, or null if there are no more results.
            mode (SemanticSearchMetaMode): Ranking mode used for this response.
            coverage (None | SemanticSearchCoverage): Index-coverage snapshot, present only when requested via
                `include: [coverage]`; otherwise null.
     """

    limit: int
    cursor: None | str
    mode: SemanticSearchMetaMode
    coverage: None | SemanticSearchCoverage
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.semantic_search_coverage import SemanticSearchCoverage
        limit = self.limit

        cursor: None | str
        cursor = self.cursor

        mode = self.mode.value

        coverage: dict[str, Any] | None
        if isinstance(self.coverage, SemanticSearchCoverage):
            coverage = self.coverage.to_dict()
        else:
            coverage = self.coverage


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "limit": limit,
            "cursor": cursor,
            "mode": mode,
            "coverage": coverage,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.semantic_search_coverage import SemanticSearchCoverage
        d = dict(src_dict)
        limit = d.pop("limit")

        def _parse_cursor(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        cursor = _parse_cursor(d.pop("cursor"))


        mode = SemanticSearchMetaMode(d.pop("mode"))




        def _parse_coverage(data: object) -> None | SemanticSearchCoverage:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                coverage_type_0 = SemanticSearchCoverage.from_dict(data)



                return coverage_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | SemanticSearchCoverage, data)

        coverage = _parse_coverage(d.pop("coverage"))


        semantic_search_meta = cls(
            limit=limit,
            cursor=cursor,
            mode=mode,
            coverage=coverage,
        )


        semantic_search_meta.additional_properties = d
        return semantic_search_meta

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
