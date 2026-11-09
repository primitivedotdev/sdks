from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.credentials_list_credentials_result_counts import CredentialsListCredentialsResultCounts
  from ..models.credentials_list_credentials_result_items_item import CredentialsListCredentialsResultItemsItem





T = TypeVar("T", bound="CredentialsListCredentialsResult")



@_attrs_define
class CredentialsListCredentialsResult:
    """ 
        Attributes:
            items (list[CredentialsListCredentialsResultItemsItem]):
            counts (CredentialsListCredentialsResultCounts):
     """

    items: list[CredentialsListCredentialsResultItemsItem]
    counts: CredentialsListCredentialsResultCounts
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.credentials_list_credentials_result_counts import CredentialsListCredentialsResultCounts # noqa: PLC0415
        from ..models.credentials_list_credentials_result_items_item import CredentialsListCredentialsResultItemsItem # noqa: PLC0415
        items = []
        for items_item_data in self.items:
            items_item = items_item_data.to_dict()
            items.append(items_item)



        counts = self.counts.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "items": items,
            "counts": counts,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.credentials_list_credentials_result_counts import CredentialsListCredentialsResultCounts # noqa: PLC0415
        from ..models.credentials_list_credentials_result_items_item import CredentialsListCredentialsResultItemsItem # noqa: PLC0415
        d = dict(src_dict)
        items = []
        _items = d.pop("items")
        for items_item_data in (_items):
            items_item = CredentialsListCredentialsResultItemsItem.from_dict(items_item_data)



            items.append(items_item)


        counts = CredentialsListCredentialsResultCounts.from_dict(d.pop("counts"))




        credentials_list_credentials_result = cls(
            items=items,
            counts=counts,
        )


        credentials_list_credentials_result.additional_properties = d
        return credentials_list_credentials_result

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
