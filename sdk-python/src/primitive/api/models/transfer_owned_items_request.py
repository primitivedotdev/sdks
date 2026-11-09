from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.transfer_owned_items_request_items_item import TransferOwnedItemsRequestItemsItem





T = TypeVar("T", bound="TransferOwnedItemsRequest")



@_attrs_define
class TransferOwnedItemsRequest:
    """ 
        Attributes:
            to_user_id (UUID):
            items (list[TransferOwnedItemsRequestItemsItem]):
     """

    to_user_id: UUID
    items: list[TransferOwnedItemsRequestItemsItem]





    def to_dict(self) -> dict[str, Any]:
        from ..models.transfer_owned_items_request_items_item import TransferOwnedItemsRequestItemsItem # noqa: PLC0415
        to_user_id = str(self.to_user_id)

        items = []
        for items_item_data in self.items:
            items_item = items_item_data.to_dict()
            items.append(items_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "to_user_id": to_user_id,
            "items": items,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.transfer_owned_items_request_items_item import TransferOwnedItemsRequestItemsItem # noqa: PLC0415
        d = dict(src_dict)
        to_user_id = UUID(d.pop("to_user_id"))




        items = []
        _items = d.pop("items")
        for items_item_data in (_items):
            items_item = TransferOwnedItemsRequestItemsItem.from_dict(items_item_data)



            items.append(items_item)


        transfer_owned_items_request = cls(
            to_user_id=to_user_id,
            items=items,
        )

        return transfer_owned_items_request

