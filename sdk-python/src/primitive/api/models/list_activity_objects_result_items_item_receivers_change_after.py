from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="ListActivityObjectsResultItemsItemReceiversChangeAfter")



@_attrs_define
class ListActivityObjectsResultItemsItemReceiversChangeAfter:
    """ 
        Attributes:
            keys (int):
            reads_in_full (int): Of the keys, how many also read your own mail beyond the rule.
            webhooks (int):
            shares (int):
     """

    keys: int
    reads_in_full: int
    webhooks: int
    shares: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        keys = self.keys

        reads_in_full = self.reads_in_full

        webhooks = self.webhooks

        shares = self.shares


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "keys": keys,
            "reads_in_full": reads_in_full,
            "webhooks": webhooks,
            "shares": shares,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        keys = d.pop("keys")

        reads_in_full = d.pop("reads_in_full")

        webhooks = d.pop("webhooks")

        shares = d.pop("shares")

        list_activity_objects_result_items_item_receivers_change_after = cls(
            keys=keys,
            reads_in_full=reads_in_full,
            webhooks=webhooks,
            shares=shares,
        )


        list_activity_objects_result_items_item_receivers_change_after.additional_properties = d
        return list_activity_objects_result_items_item_receivers_change_after

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
