from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.list_activity_objects_result_items_item_receivers_change_after import ListActivityObjectsResultItemsItemReceiversChangeAfter
  from ..models.list_activity_objects_result_items_item_receivers_change_before import ListActivityObjectsResultItemsItemReceiversChangeBefore





T = TypeVar("T", bound="ListActivityObjectsResultItemsItemReceiversChange")



@_attrs_define
class ListActivityObjectsResultItemsItemReceiversChange:
    """ For a receivers_changed notice: who received the rule's matches before and after, in totals. They can be equal when
    only an owner or a webhook site changed; covering-me shows them by owner. A rotated key counts once here while the
    old one still works; covering-me counts both.

        Attributes:
            before (ListActivityObjectsResultItemsItemReceiversChangeBefore):
            after (ListActivityObjectsResultItemsItemReceiversChangeAfter):
     """

    before: ListActivityObjectsResultItemsItemReceiversChangeBefore
    after: ListActivityObjectsResultItemsItemReceiversChangeAfter
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.list_activity_objects_result_items_item_receivers_change_after import ListActivityObjectsResultItemsItemReceiversChangeAfter # noqa: PLC0415
        from ..models.list_activity_objects_result_items_item_receivers_change_before import ListActivityObjectsResultItemsItemReceiversChangeBefore # noqa: PLC0415
        before = self.before.to_dict()

        after = self.after.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "before": before,
            "after": after,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.list_activity_objects_result_items_item_receivers_change_after import ListActivityObjectsResultItemsItemReceiversChangeAfter # noqa: PLC0415
        from ..models.list_activity_objects_result_items_item_receivers_change_before import ListActivityObjectsResultItemsItemReceiversChangeBefore # noqa: PLC0415
        d = dict(src_dict)
        before = ListActivityObjectsResultItemsItemReceiversChangeBefore.from_dict(d.pop("before"))




        after = ListActivityObjectsResultItemsItemReceiversChangeAfter.from_dict(d.pop("after"))




        list_activity_objects_result_items_item_receivers_change = cls(
            before=before,
            after=after,
        )


        list_activity_objects_result_items_item_receivers_change.additional_properties = d
        return list_activity_objects_result_items_item_receivers_change

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
