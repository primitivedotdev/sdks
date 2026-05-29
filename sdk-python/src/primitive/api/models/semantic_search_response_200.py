from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.semantic_search_meta import SemanticSearchMeta
  from ..models.semantic_search_result import SemanticSearchResult





T = TypeVar("T", bound="SemanticSearchResponse200")



@_attrs_define
class SemanticSearchResponse200:
    """ 
        Attributes:
            success (bool):
            data (list[SemanticSearchResult]):
            meta (SemanticSearchMeta):
     """

    success: bool
    data: list[SemanticSearchResult]
    meta: SemanticSearchMeta
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.semantic_search_meta import SemanticSearchMeta
        from ..models.semantic_search_result import SemanticSearchResult
        success = self.success

        data = []
        for data_item_data in self.data:
            data_item = data_item_data.to_dict()
            data.append(data_item)



        meta = self.meta.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "success": success,
            "data": data,
            "meta": meta,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.semantic_search_meta import SemanticSearchMeta
        from ..models.semantic_search_result import SemanticSearchResult
        d = dict(src_dict)
        success = d.pop("success")

        data = []
        _data = d.pop("data")
        for data_item_data in (_data):
            data_item = SemanticSearchResult.from_dict(data_item_data)



            data.append(data_item)


        meta = SemanticSearchMeta.from_dict(d.pop("meta"))




        semantic_search_response_200 = cls(
            success=success,
            data=data,
            meta=meta,
        )


        semantic_search_response_200.additional_properties = d
        return semantic_search_response_200

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
