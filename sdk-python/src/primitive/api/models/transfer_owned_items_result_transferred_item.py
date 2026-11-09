from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="TransferOwnedItemsResultTransferredItem")



@_attrs_define
class TransferOwnedItemsResultTransferredItem:
    """ 
        Attributes:
            kind (str):
            id (str):
            rotated (bool | Unset):
     """

    kind: str
    id: str
    rotated: bool | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        kind = self.kind

        id = self.id

        rotated = self.rotated


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "kind": kind,
            "id": id,
        })
        if rotated is not UNSET:
            field_dict["rotated"] = rotated

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        kind = d.pop("kind")

        id = d.pop("id")

        rotated = d.pop("rotated", UNSET)

        transfer_owned_items_result_transferred_item = cls(
            kind=kind,
            id=id,
            rotated=rotated,
        )


        transfer_owned_items_result_transferred_item.additional_properties = d
        return transfer_owned_items_result_transferred_item

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
