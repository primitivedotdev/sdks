from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="DiscardContentResult")



@_attrs_define
class DiscardContentResult:
    """ 
        Attributes:
            discarded (bool): Always `true` on a 2xx response. The content is either now
                discarded as a result of this call, or was already discarded
                before this call ran.
            already_discarded (bool): `true` if the email's content was already discarded before
                this call ran (no work was done). `false` if this call was
                the one that performed the discard.
     """

    discarded: bool
    already_discarded: bool
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        discarded = self.discarded

        already_discarded = self.already_discarded


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "discarded": discarded,
            "already_discarded": already_discarded,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        discarded = d.pop("discarded")

        already_discarded = d.pop("already_discarded")

        discard_content_result = cls(
            discarded=discarded,
            already_discarded=already_discarded,
        )


        discard_content_result.additional_properties = d
        return discard_content_result

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
