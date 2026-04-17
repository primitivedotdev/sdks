from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.pagination_meta import PaginationMeta





T = TypeVar("T", bound="ListEnvelope")



@_attrs_define
class ListEnvelope:
    """ 
        Attributes:
            success (bool):
            meta (PaginationMeta):
     """

    success: bool
    meta: PaginationMeta
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.pagination_meta import PaginationMeta
        success = self.success

        meta = self.meta.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "success": success,
            "meta": meta,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.pagination_meta import PaginationMeta
        d = dict(src_dict)
        success = d.pop("success")

        meta = PaginationMeta.from_dict(d.pop("meta"))




        list_envelope = cls(
            success=success,
            meta=meta,
        )


        list_envelope.additional_properties = d
        return list_envelope

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
