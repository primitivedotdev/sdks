from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.transfer_owned_items_request_items_item_kind import TransferOwnedItemsRequestItemsItemKind
from uuid import UUID






T = TypeVar("T", bound="TransferOwnedItemsRequestItemsItem")



@_attrs_define
class TransferOwnedItemsRequestItemsItem:
    """ 
        Attributes:
            kind (TransferOwnedItemsRequestItemsItemKind):
            id (UUID):
            rotate (bool | Unset):
     """

    kind: TransferOwnedItemsRequestItemsItemKind
    id: UUID
    rotate: bool | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        kind = self.kind.value

        id = str(self.id)

        rotate = self.rotate


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "kind": kind,
            "id": id,
        })
        if rotate is not UNSET:
            field_dict["rotate"] = rotate

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        kind = TransferOwnedItemsRequestItemsItemKind(d.pop("kind"))




        id = UUID(d.pop("id"))




        rotate = d.pop("rotate", UNSET)

        transfer_owned_items_request_items_item = cls(
            kind=kind,
            id=id,
            rotate=rotate,
        )

        return transfer_owned_items_request_items_item

