from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.mail_routing_list_items_item_placement import MailRoutingListItemsItemPlacement
from uuid import UUID






T = TypeVar("T", bound="MailRoutingListItemsItem")



@_attrs_define
class MailRoutingListItemsItem:
    """ 
        Attributes:
            conversation_key (str):
            placement (MailRoutingListItemsItemPlacement):
            version (int):
            mutation_id (UUID):
            updated_at (str):
     """

    conversation_key: str
    placement: MailRoutingListItemsItemPlacement
    version: int
    mutation_id: UUID
    updated_at: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        conversation_key = self.conversation_key

        placement = self.placement.value

        version = self.version

        mutation_id = str(self.mutation_id)

        updated_at = self.updated_at


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "conversation_key": conversation_key,
            "placement": placement,
            "version": version,
            "mutation_id": mutation_id,
            "updated_at": updated_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        conversation_key = d.pop("conversation_key")

        placement = MailRoutingListItemsItemPlacement(d.pop("placement"))




        version = d.pop("version")

        mutation_id = UUID(d.pop("mutation_id"))




        updated_at = d.pop("updated_at")

        mail_routing_list_items_item = cls(
            conversation_key=conversation_key,
            placement=placement,
            version=version,
            mutation_id=mutation_id,
            updated_at=updated_at,
        )


        mail_routing_list_items_item.additional_properties = d
        return mail_routing_list_items_item

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
